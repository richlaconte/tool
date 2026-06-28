import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, ChangeEvent } from 'react'

import Area from './components/Area'
import CommandPalette from './components/CommandPalette'
import type { CommandPaletteOption } from './components/CommandPalette'
import {
  deleteArea,
  duplicateArea,
  restoreDeletedArea,
  type DeletedAreaSnapshot,
} from './areaActions'
import {
  DEFAULT_AREA_HEIGHT,
  DEFAULT_AREA_WIDTH,
  MIN_AREA_HEIGHT,
  MIN_AREA_WIDTH,
  resizeAreaDimensions,
} from './areaResize'
import {
  getAppKeyboardAction,
  getDialogKeyboardAction,
} from './appKeyboardLogic'
import {
  createCollaborationProfile,
  createPresenceState,
  getCollaborationChannelName,
  getCollaborationProfileFromCookie,
  pruneStalePresences,
  serializeCollaborationProfileCookie,
  upsertPresence,
  type CollaborationProfile,
  type PresenceState,
} from './collaboration'
import {
  clampCanvasZoom,
  formatCanvasZoom,
  getAnchorPreservingScroll,
  getCanvasWorldSize,
  getNextCanvasZoom,
  getZoomToFit,
  screenToCanvasPoint,
} from './canvasViewport'
import {
  applyAgentPatch,
  suggestDecisionLog,
  type AgentActionRecord,
  type AgentClient,
  type AgentPatch,
  type AgentPatchOperation,
} from './agentInterface'
import type { CssSlashCommand } from './cssSlashCommand'
import { removeCssSlashCommand } from './cssSlashCommand'
import type { ImageSlashCommand } from './imageSupport'
import {
  getImageFileValidationError,
  getImageUrlValidationError,
  removeImageSlashCommand,
} from './imageSupport'
import {
  getAreaAbsolutePosition,
  getChildAreas,
  getRootAreas,
  nestAreaIfContained,
} from './nestedAreas'
import {
  createDefaultPageState,
  PAGE_STORAGE_KEY,
  parsePageJson,
  stringifyPageState,
  type PageAppState,
} from './pagePersistence'
import {
  clampSnapGridSize,
  getActiveSnapGridSize,
  moveAreaWithSnapGrid,
} from './snapGrid'
import {
  buildShareUrl,
  createShareLinks,
  getShareAccessMode,
  regenerateShareLink,
  type ShareAccessMode,
} from './shareLinks'
import {
  getThemeColorContrastWarning,
  normalizeThemeColorToken,
  resolveThemeColorTokens,
  type ThemeColorToken,
} from './themeColors'
import { useCollaborativePageSync } from './useCollaborativePage'

export type BaseAreaState = {
  id: string
  parentId: string | null
  x: number
  y: number
  height: number
  width: number
  styles: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

export type TextAreaState = BaseAreaState & {
  type?: 'text'
  text: string
}

export type ImageAreaState = BaseAreaState & {
  type: 'image'
  assetId: string
  alt: string
}

export type AreaState = TextAreaState | ImageAreaState

export type AssetState = {
  id: string
  kind: 'image'
  mimeType: string
  width: number
  height: number
  storageKey: string
  createdAt: string
}

type SaveStatus = 'saved' | 'saving' | 'offline-changes'
type CollaborationStatus = 'connected' | 'offline'
type PresenceCssProperties = CSSProperties & {
  '--presence-color': string
}
type PendingImageInsert =
  | {
      kind: 'new'
      x: number
      y: number
      sourceAreaId?: string
      command?: ImageSlashCommand
    }
  | {
      kind: 'replace'
      areaId: string
    }

type CollaborationMessage =
  | {
      type: 'presence'
      senderId: string
      presence: PresenceState
    }
  | {
      type: 'state-request'
      senderId: string
    }
  | {
      type: 'state-sync'
      senderId: string
      state: PageAppState
    }

const COMMAND_PALETTE_OPTIONS: CommandPaletteOption[] = [
  {
    id: 'help',
    title: 'Help',
    description: 'Show keyboard shortcuts and editing tips',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Open editor preferences',
  },
  {
    id: 'page-styles',
    title: 'Page styles',
    description: 'Manage page-wide appearance',
  },
  {
    id: 'agent-suggestions',
    title: 'Agent suggestions',
    description: 'Review a suggested decision-log patch',
  },
  {
    id: 'share',
    title: 'Share',
    description: 'Create edit and view-only links',
  },
  {
    id: 'toggle-snap-grid',
    title: 'Toggle snap grid',
    description: 'Snap Area movement and resizing to page grid',
  },
  {
    id: 'insert-image',
    title: 'Insert image',
    description: 'Add a movable image to the page',
  },
  {
    id: 'zoom-in',
    title: 'Zoom in',
    description: 'Increase canvas zoom',
  },
  {
    id: 'zoom-out',
    title: 'Zoom out',
    description: 'Decrease canvas zoom',
  },
  {
    id: 'reset-zoom',
    title: 'Reset zoom',
    description: 'Return the canvas to 100%',
  },
  {
    id: 'zoom-to-fit',
    title: 'Zoom to fit',
    description: 'Fit all Areas in view',
  },
  {
    id: 'zoom-to-selection',
    title: 'Zoom to selection',
    description: 'Center the selected Area',
  },
]

const COMMAND_DIALOGS: Record<
  string,
  {
    title: string
    body: string
  }
> = {
  help: {
    title: 'Help',
    body: 'Click anywhere to create an Area. Type freely, or enter CSS commands like /border: 1px solid red to style the selected Area. Press Escape to leave an Area. Use Command or Control with +, -, or 0 to zoom the canvas.',
  },
  settings: {
    title: 'Settings',
    body: 'Settings will live here. For now, use the command palette to discover available editor actions.',
  },
  'page-styles': {
    title: 'Page styles',
    body: 'Page-wide style controls will live here, separate from per-Area /style commands.',
  },
  'agent-suggestions': {
    title: 'Agent proposal',
    body: 'Review suggested agent changes before applying them to the canvas.',
  },
  share: {
    title: 'Share',
    body: 'Create links for people who can edit this page or only view it.',
  },
}

const LOCAL_AGENT_CLIENT: AgentClient = {
  id: 'local-agent',
  displayName: 'Cascadery Agent',
  scopes: ['page:read', 'page:search', 'page:suggest', 'page:write'],
}

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable)

const isCommandPaletteTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest(
    '.command-palette, .command-palette-backdrop'
  ) !== null

const createFallbackAreaId = (nextId: number) => `area-${nextId}`

const createAreaId = (nextId: number) => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `area_${crypto.randomUUID()}`
  }

  return createFallbackAreaId(nextId)
}

const createAssetId = (nextId: number) => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `asset_${crypto.randomUUID()}`
  }

  return `asset-${nextId}`
}

const createThemeColorId = (nextId: number) => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `color_${crypto.randomUUID()}`
  }

  return `color-${nextId}`
}

const getInitialPageState = (pageId?: string): PageAppState => {
  const fallbackState = {
    page: createDefaultPageState(pageId ? { id: pageId } : undefined),
    areas: [],
    assets: [],
  }

  if (typeof localStorage === 'undefined') return fallbackState

  const savedJson = localStorage.getItem(PAGE_STORAGE_KEY)

  if (!savedJson) return fallbackState

  const result = parsePageJson(savedJson)

  if (!result.ok) return fallbackState
  if (pageId && result.state.page.id !== pageId) return fallbackState

  return result.state
}

const getInitialCollaborationProfile = () => {
  if (typeof document !== 'undefined') {
    const savedProfile = getCollaborationProfileFromCookie(
      document.cookie
    )

    if (savedProfile) return savedProfile
  }

  const profile = createCollaborationProfile()

  if (typeof document !== 'undefined') {
    document.cookie = serializeCollaborationProfileCookie(profile)
  }

  return profile
}

const getSaveStatusLabel = (saveStatus: SaveStatus) => {
  if (saveStatus === 'saving') return 'Saving...'
  if (saveStatus === 'offline-changes') return 'Offline changes'

  return 'Saved'
}

const getCollaborationStatusLabel = (
  collaborationStatus: CollaborationStatus
) =>
  collaborationStatus === 'connected'
    ? 'Connected'
    : 'Offline'

const getPresenceInitials = (userName: string) =>
  userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

const getCanvasPoint = (
  clientX: number,
  clientY: number,
  zoom = 1
) => {
  const canvas = document.getElementById('canvas')

  if (!canvas) {
    return {
      x: clientX,
      y: clientY,
    }
  }

  const canvasRect = canvas.getBoundingClientRect()

  return screenToCanvasPoint(clientX, clientY, {
    rectLeft: canvasRect.left,
    rectTop: canvasRect.top,
    scrollLeft: canvas.scrollLeft,
    scrollTop: canvas.scrollTop,
    zoom,
  })
}

const getViewportCenterPoint = (zoom = 1) =>
  getCanvasPoint(
    window.innerWidth / 2,
    window.innerHeight / 2,
    zoom
  )

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Image file could not be read.'))
    reader.onerror = () => reject(new Error('Image file could not be read.'))
    reader.readAsDataURL(file)
  })

const loadImageMetadata = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()

    image.onload = () =>
      resolve({
        width: image.naturalWidth || 240,
        height: image.naturalHeight || 160,
      })
    image.onerror = () => reject(new Error('Image could not be loaded.'))
    image.src = src
  })

const getInitialImageAreaSize = (width: number, height: number) => {
  if (width <= 0 || height <= 0) {
    return {
      width: 240,
      height: 160,
    }
  }

  const scale = Math.min(320 / width, 240 / height, 1)

  return {
    width: Math.max(80, Math.round(width * scale)),
    height: Math.max(80, Math.round(height * scale)),
  }
}

const getFileAltText = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()

const supportsAgentCssDeclaration = (property: string, value: string) =>
  typeof CSS === 'undefined' ? true : CSS.supports(property, value)

const getAgentOperationSummary = (operation: AgentPatchOperation) => {
  if (operation.op === 'createArea') {
    return operation.area.text.split('\n').find(Boolean) ?? 'Create Area'
  }

  if (operation.op === 'updateArea') {
    return `Update ${operation.areaId}`
  }

  if (operation.op === 'updateAreaStyles') {
    return `Style ${operation.areaId}`
  }

  if (operation.op === 'moveArea') {
    return `Move ${operation.areaId}`
  }

  if (operation.op === 'nestArea') {
    return operation.parentId
      ? `Nest ${operation.areaId}`
      : `Unnest ${operation.areaId}`
  }

  return `Delete ${operation.areaId}`
}

const getUrlAltText = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    const fileName = parsedUrl.pathname.split('/').pop() ?? ''

    return getFileAltText(fileName)
  } catch {
    return ''
  }
}

const requestImageAltText = (defaultAlt: string) =>
  window.prompt('Image description', defaultAlt) ?? defaultAlt

const getFirstImageFile = (files: FileList | File[]) =>
  Array.from(files).find((file) => file.type.startsWith('image/')) ?? null

function App({ pageId }: { pageId?: string }) {
  const [initialPageState] = useState(() => getInitialPageState(pageId))
  const [areas, setAreas] = useState<AreaState[]>(
    initialPageState.areas
  )
  const [assets, setAssets] = useState<AssetState[]>(
    initialPageState.assets
  )
  const [page, setPage] = useState(initialPageState.page)
  const [collaborationProfile, setCollaborationProfile] =
    useState<CollaborationProfile>(getInitialCollaborationProfile)
  const [remotePresences, setRemotePresences] = useState<
    PresenceState[]
  >([])
  const [collaborationStatus, setCollaborationStatus] =
    useState<CollaborationStatus>(() =>
      typeof BroadcastChannel === 'undefined' ||
      (typeof navigator !== 'undefined' && !navigator.onLine)
        ? 'offline'
        : 'connected'
    )
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(
    null
  )
  const [autoFocusAreaId, setAutoFocusAreaId] = useState<
    string | null
  >(null)
  const [commandPaletteQuery, setCommandPaletteQuery] = useState<
    string | null
  >(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [openDialogId, setOpenDialogId] = useState<string | null>(
    null
  )
  const [deletedAreaSnapshot, setDeletedAreaSnapshot] =
    useState<DeletedAreaSnapshot | null>(null)
  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>('saved')
  const [importError, setImportError] = useState<string | null>(
    null
  )
  const [agentProposal, setAgentProposal] =
    useState<AgentPatch | null>(null)
  const [agentAuditRecords, setAgentAuditRecords] = useState<
    AgentActionRecord[]
  >([])
  const [hasClickedCanvas, setHasClickedCanvas] = useState(false)
  const [themeColorName, setThemeColorName] = useState('')
  const [themeColorToken, setThemeColorToken] = useState('')
  const [themeColorValue, setThemeColorValue] =
    useState('#2563eb')
  const [copiedShareMode, setCopiedShareMode] =
    useState<ShareAccessMode | null>(null)
  const nextAreaId = useRef(0)
  const nextAssetId = useRef(0)
  const nextThemeColorId = useRef(0)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const collaborationChannelRef = useRef<BroadcastChannel | null>(
    null
  )
  const collaborationProfileRef = useRef(collaborationProfile)
  const selectedAreaIdRef = useRef<string | null>(null)
  const latestPageStateRef = useRef<PageAppState>({
    areas: initialPageState.areas,
    assets: initialPageState.assets,
    page: initialPageState.page,
  })
  const latestCursorRef = useRef<PresenceState['cursor']>(null)
  const isApplyingRemoteState = useRef(false)
  const hasMountedForSave = useRef(false)
  const hasMountedForCollaborationSync = useRef(false)
  const pendingImageInsert = useRef<PendingImageInsert | null>(null)
  const shareAccessMode = getShareAccessMode(
    typeof window === 'undefined' ? '' : window.location.search,
    page.settings.shareLinks
  )
  const isViewOnly = shareAccessMode === 'view'
  const isServerCollaborationEnabled = Boolean(pageId)
  const collaborativePageState = useMemo(
    () => ({
      areas,
      assets,
      page,
    }),
    [areas, assets, page]
  )
  const handleRemoteCollaborativeState = useCallback(
    (nextState: PageAppState) => {
      isApplyingRemoteState.current = true
      setPage(nextState.page)
      setAreas(nextState.areas)
      setAssets(nextState.assets)
    },
    []
  )
  const collaborativeSync = useCollaborativePageSync({
    enabled: isServerCollaborationEnabled,
    onRemoteState: handleRemoteCollaborativeState,
    pageId: page.id,
    state: collaborativePageState,
  })
  const displayedRemotePresences = isServerCollaborationEnabled
    ? collaborativeSync.remotePresences
    : remotePresences
  const displayedCollaborationStatus = isServerCollaborationEnabled
    ? collaborativeSync.connectionStatus === 'connected'
      ? 'connected'
      : 'offline'
    : collaborationStatus

  const getCanvasCenterAnchor = useCallback(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return {
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2,
      }
    }

    const rect = canvas.getBoundingClientRect()

    return {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
  }, [])

  const setCanvasZoomFromAnchor = useCallback(
    (
      nextZoomValue: number,
      anchor = getCanvasCenterAnchor()
    ) => {
      const canvas = canvasRef.current
      const nextZoom = clampCanvasZoom(nextZoomValue)

      if (!canvas) {
        setCanvasZoom(nextZoom)
        return
      }

      const rect = canvas.getBoundingClientRect()
      const scroll = getAnchorPreservingScroll({
        anchor,
        metrics: {
          rectLeft: rect.left,
          rectTop: rect.top,
          scrollLeft: canvas.scrollLeft,
          scrollTop: canvas.scrollTop,
          zoom: canvasZoom,
        },
        nextZoom,
      })

      setCanvasZoom(nextZoom)

      requestAnimationFrame(() => {
        canvas.scrollLeft = Math.max(0, scroll.scrollLeft)
        canvas.scrollTop = Math.max(0, scroll.scrollTop)
      })
    },
    [canvasZoom, getCanvasCenterAnchor]
  )

  const zoomCanvasByDirection = useCallback(
    (direction: -1 | 1, anchor = getCanvasCenterAnchor()) => {
      setCanvasZoomFromAnchor(
        getNextCanvasZoom(canvasZoom, direction),
        anchor
      )
    },
    [canvasZoom, getCanvasCenterAnchor, setCanvasZoomFromAnchor]
  )

  const resetCanvasZoom = useCallback(() => {
    setCanvasZoomFromAnchor(1)
  }, [setCanvasZoomFromAnchor])

  const zoomCanvasToItems = useCallback(
    (items: Array<{ x: number; y: number; width: number; height: number }>) => {
      const canvas = canvasRef.current

      if (!canvas) {
        setCanvasZoom(1)
        return
      }

      const result = getZoomToFit(items, {
        height: canvas.clientHeight,
        width: canvas.clientWidth,
      })

      setCanvasZoom(result.zoom)

      requestAnimationFrame(() => {
        canvas.scrollLeft = result.scrollLeft
        canvas.scrollTop = result.scrollTop
      })
    },
    []
  )

  const zoomCanvasToFit = useCallback(() => {
    zoomCanvasToItems(
      areas.map((area) => ({
        ...getAreaAbsolutePosition(areas, area.id),
        height: area.height,
        width: area.width,
      }))
    )
  }, [areas, zoomCanvasToItems])

  const zoomCanvasToSelection = useCallback(() => {
    const selectedArea = selectedAreaId
      ? areas.find((area) => area.id === selectedAreaId)
      : null

    if (!selectedArea) {
      zoomCanvasToFit()
      return
    }

    zoomCanvasToItems([
      {
        ...getAreaAbsolutePosition(areas, selectedArea.id),
        height: selectedArea.height,
        width: selectedArea.width,
      },
    ])
  }, [areas, selectedAreaId, zoomCanvasToFit, zoomCanvasToItems])

  const publishPresence = useCallback(
    (cursor: PresenceState['cursor'] = latestCursorRef.current) => {
      const presence = createPresenceState(
        collaborationProfile,
        {
          cursor,
          selectedAreaId,
        },
        Date.now()
      )

      collaborativeSync.setPresence(presence)

      collaborationChannelRef.current?.postMessage({
        type: 'presence',
        senderId: collaborationProfile.clientId,
        presence,
      } satisfies CollaborationMessage)
    },
    [collaborationProfile, collaborativeSync, selectedAreaId]
  )

  const updateCollaborationUserName = (userName: string) => {
    const nextProfile = {
      ...collaborationProfile,
      userName,
    }

    setCollaborationProfile(nextProfile)

    if (typeof document !== 'undefined') {
      document.cookie =
        serializeCollaborationProfileCookie(nextProfile)
    }
  }

  useEffect(() => {
    latestPageStateRef.current = {
      areas,
      assets,
      page,
    }
  }, [areas, assets, page])

  useEffect(() => {
    collaborationProfileRef.current = collaborationProfile
  }, [collaborationProfile])

  useEffect(() => {
    selectedAreaIdRef.current = selectedAreaId
  }, [selectedAreaId])

  useEffect(() => {
    if (isServerCollaborationEnabled) {
      collaborationChannelRef.current?.close()
      collaborationChannelRef.current = null
      return
    }

    if (typeof BroadcastChannel === 'undefined') {
      return
    }

    const clientId = collaborationProfile.clientId
    const channel = new BroadcastChannel(
      getCollaborationChannelName(page.id)
    )
    collaborationChannelRef.current = channel

    channel.onmessage = (event: MessageEvent<CollaborationMessage>) => {
      const message = event.data

      if (!message || message.senderId === clientId) {
        return
      }

      if (message.type === 'presence') {
        setRemotePresences((currentPresences) =>
          pruneStalePresences(
            upsertPresence(
              currentPresences,
              message.presence,
              clientId
            )
          )
        )
        return
      }

      if (message.type === 'state-request') {
        if (isViewOnly) return

        channel.postMessage({
          type: 'state-sync',
          senderId: clientId,
          state: latestPageStateRef.current,
        } satisfies CollaborationMessage)
        channel.postMessage({
          type: 'presence',
          senderId: clientId,
          presence: createPresenceState(
            collaborationProfileRef.current,
            {
              cursor: latestCursorRef.current,
              selectedAreaId: selectedAreaIdRef.current,
            },
            Date.now()
          ),
        } satisfies CollaborationMessage)
        return
      }

      isApplyingRemoteState.current = true
      setPage(message.state.page)
      setAreas(message.state.areas)
      setAssets(message.state.assets)
    }

    const handleOnline = () => setCollaborationStatus('connected')
    const handleOffline = () => setCollaborationStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    channel.postMessage({
      type: 'presence',
      senderId: clientId,
      presence: createPresenceState(
        collaborationProfileRef.current,
        {
          cursor: latestCursorRef.current,
          selectedAreaId: selectedAreaIdRef.current,
        },
        Date.now()
      ),
    } satisfies CollaborationMessage)
    channel.postMessage({
      type: 'state-request',
      senderId: clientId,
    } satisfies CollaborationMessage)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      channel.close()
      if (collaborationChannelRef.current === channel) {
        collaborationChannelRef.current = null
      }
      setRemotePresences([])
    }
  }, [
    collaborationProfile.clientId,
    isServerCollaborationEnabled,
    isViewOnly,
    page.id,
  ])

  useEffect(() => {
    if (!hasMountedForCollaborationSync.current) {
      hasMountedForCollaborationSync.current = true
      return
    }

    if (isApplyingRemoteState.current) {
      isApplyingRemoteState.current = false
      return
    }

    if (
      isServerCollaborationEnabled ||
      isViewOnly ||
      collaborationStatus !== 'connected'
    ) {
      return
    }

    const syncTimer = window.setTimeout(() => {
      collaborationChannelRef.current?.postMessage({
        type: 'state-sync',
        senderId: collaborationProfile.clientId,
        state: {
          areas,
          assets,
          page,
        },
      } satisfies CollaborationMessage)
    }, 60)

    return () => window.clearTimeout(syncTimer)
  }, [
    areas,
    assets,
    collaborationProfile.clientId,
    collaborationStatus,
    isServerCollaborationEnabled,
    isViewOnly,
    page,
  ])

  useEffect(() => {
    const canvas = document.getElementById('canvas')

    if (!canvas) return

    const handlePointerMove = (event: PointerEvent) => {
      const cursor = getCanvasPoint(
        event.clientX,
        event.clientY,
        canvasZoom
      )

      latestCursorRef.current = cursor
      publishPresence(cursor)
    }

    const handlePointerLeave = () => {
      latestCursorRef.current = null
      publishPresence(null)
    }

    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [canvasZoom, publishPresence])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return

      event.preventDefault()
      zoomCanvasByDirection(event.deltaY < 0 ? 1 : -1, {
        clientX: event.clientX,
        clientY: event.clientY,
      })
    }

    canvas.addEventListener('wheel', handleWheel, {
      passive: false,
    })

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [zoomCanvasByDirection])

  useEffect(() => {
    collaborationChannelRef.current?.postMessage({
      type: 'presence',
      senderId: collaborationProfile.clientId,
      presence: createPresenceState(
        collaborationProfile,
        {
          cursor: latestCursorRef.current,
          selectedAreaId,
        },
        Date.now()
      ),
    } satisfies CollaborationMessage)
  }, [collaborationProfile, selectedAreaId])

  useEffect(() => {
    const pruneTimer = window.setInterval(() => {
      setRemotePresences((currentPresences) =>
        pruneStalePresences(currentPresences)
      )
    }, 5000)

    return () => window.clearInterval(pruneTimer)
  }, [])

  useEffect(() => {
    if (!hasMountedForSave.current) {
      hasMountedForSave.current = true
      return
    }

    if (typeof localStorage === 'undefined') {
      const offlineTimer = window.setTimeout(() => {
        setSaveStatus('offline-changes')
      }, 0)

      return () => window.clearTimeout(offlineTimer)
    }

    const savingTimer = window.setTimeout(() => {
      setSaveStatus('saving')
    }, 0)

    const saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          PAGE_STORAGE_KEY,
          stringifyPageState({ areas, assets, page })
        )
        setSaveStatus('saved')
      } catch {
        setSaveStatus('offline-changes')
      }
    }, 400)

    return () => {
      window.clearTimeout(savingTimer)
      window.clearTimeout(saveTimer)
    }
  }, [areas, assets, page])

  useEffect(() => {
    const handleClick = (e: PointerEvent) => {
      if (isViewOnly) return

      const target = e.target as HTMLElement

      if (!target.classList.contains('canvas-world')) return

      e.preventDefault()
      setHasClickedCanvas(true)

      const point = getCanvasPoint(e.clientX, e.clientY, canvasZoom)
      const id = createAreaId(nextAreaId.current)
      nextAreaId.current += 1
      const createdAt = new Date().toISOString()

      setAreas((prev) => [
        ...prev,
        {
          id,
          parentId: null,
          x: point.x,
          y: point.y,
          height: DEFAULT_AREA_HEIGHT,
          width: DEFAULT_AREA_WIDTH,
          text: '',
          styles: {},
          createdAt,
          updatedAt: createdAt,
        },
      ])
      setSelectedAreaId(id)
      setAutoFocusAreaId(id)
    }

    document.addEventListener('pointerdown', handleClick)

    return () => {
      document.removeEventListener('pointerdown', handleClick)
    }
  }, [canvasZoom, isViewOnly])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isEditingTarget = isEditableTarget(e.target)
      const isPaletteTarget = isCommandPaletteTarget(e.target)
      const hasSystemModifier = e.metaKey || e.ctrlKey

      if (
        openDialogId === null &&
        commandPaletteQuery === null &&
        !isEditingTarget &&
        !isPaletteTarget
      ) {
        if (hasSystemModifier && (e.key === '+' || e.key === '=')) {
          e.preventDefault()
          zoomCanvasByDirection(1)
          return
        }

        if (hasSystemModifier && e.key === '-') {
          e.preventDefault()
          zoomCanvasByDirection(-1)
          return
        }

        if (hasSystemModifier && e.key === '0') {
          e.preventDefault()
          resetCanvasZoom()
          return
        }

        if (e.shiftKey && e.key === '1') {
          e.preventDefault()
          zoomCanvasToFit()
          return
        }

        if (e.shiftKey && e.key === '2') {
          e.preventDefault()
          zoomCanvasToSelection()
          return
        }
      }

      const keyboardAction = getAppKeyboardAction({
        key: e.key,
        hasSelectedArea: selectedAreaId !== null,
        isCommandPaletteOpen: commandPaletteQuery !== null,
        isDialogOpen: openDialogId !== null,
        isEditableTarget: isEditingTarget,
        isCommandPaletteTarget: isPaletteTarget,
        hasModifier: e.metaKey || e.ctrlKey || e.altKey,
      })

      if (keyboardAction === 'ignore') return

      e.preventDefault()

      if (keyboardAction === 'deselect-area') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }

        setSelectedAreaId(null)
        return
      }

      if (keyboardAction === 'close-command-palette') {
        setCommandPaletteQuery(null)
        return
      }

      setCommandPaletteQuery(e.key === 'Escape' ? '' : e.key)
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    commandPaletteQuery,
    openDialogId,
    resetCanvasZoom,
    selectedAreaId,
    zoomCanvasByDirection,
    zoomCanvasToFit,
    zoomCanvasToSelection,
  ])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openDialogId === null) return

      const keyboardAction = getDialogKeyboardAction({
        key: e.key,
        isCommandPaletteTarget: isCommandPaletteTarget(e.target),
      })

      if (keyboardAction === 'close-dialog') {
        e.preventDefault()
        setOpenDialogId(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openDialogId])

  const updateSnapGrid = (
    patch:
      | Partial<PageAppState['page']['settings']['snapGrid']>
      | ((
          current: PageAppState['page']['settings']['snapGrid']
        ) => Partial<PageAppState['page']['settings']['snapGrid']>)
  ) => {
    if (isViewOnly) return

    setPage((currentPage) => {
      const nextPatch =
        typeof patch === 'function'
          ? patch(currentPage.settings.snapGrid)
          : patch

      return {
        ...currentPage,
        settings: {
          ...currentPage.settings,
          snapGrid: {
            ...currentPage.settings.snapGrid,
            ...nextPatch,
          },
        },
      }
    })
  }

  const updateMcpAccess = (enabled: boolean) => {
    if (isViewOnly) return

    setPage((currentPage) => ({
      ...currentPage,
      settings: {
        ...currentPage.settings,
        mcp: {
          ...currentPage.settings.mcp,
          enabled,
        },
      },
    }))
  }

  const updateThemeColors = (
    updater: (colors: ThemeColorToken[]) => ThemeColorToken[]
  ) => {
    if (isViewOnly) return

    setPage((currentPage) => ({
      ...currentPage,
      settings: {
        ...currentPage.settings,
        theme: {
          ...currentPage.settings.theme,
          colors: updater(currentPage.settings.theme.colors),
        },
      },
    }))
  }

  const addThemeColor = () => {
    const name = themeColorName.trim()
    const token = normalizeThemeColorToken(
      themeColorToken || themeColorName
    )
    const value = themeColorValue.trim()

    if (!name || !token) {
      setImportError('Theme color needs a name and token.')
      return
    }

    if (
      typeof CSS !== 'undefined' &&
      !CSS.supports('color', value)
    ) {
      setImportError('Theme color must be a valid CSS color.')
      return
    }

    const now = new Date().toISOString()

    updateThemeColors((colors) => {
      const existingColor = colors.find(
        (color) => normalizeThemeColorToken(color.token) === token
      )
      const nextColor: ThemeColorToken = {
        id:
          existingColor?.id ??
          createThemeColorId(nextThemeColorId.current),
        name,
        token,
        value,
        createdAt: existingColor?.createdAt ?? now,
        updatedAt: now,
      }

      if (!existingColor) nextThemeColorId.current += 1

      return existingColor
        ? colors.map((color) =>
            color.id === existingColor.id ? nextColor : color
          )
        : [...colors, nextColor]
    })

    setThemeColorName('')
    setThemeColorToken('')
    setImportError(null)
  }

  const removeThemeColor = (colorId: string) => {
    updateThemeColors((colors) =>
      colors.filter((color) => color.id !== colorId)
    )
  }

  const ensureShareLinks = () => {
    if (isViewOnly) return

    setPage((currentPage) => {
      if (currentPage.settings.shareLinks) return currentPage

      return {
        ...currentPage,
        settings: {
          ...currentPage.settings,
          shareLinks: createShareLinks(currentPage.id),
        },
      }
    })
  }

  const createAgentSuggestion = () => {
    if (isViewOnly) return

    const proposal = suggestDecisionLog(
      {
        areas,
        assets,
        page,
      },
      LOCAL_AGENT_CLIENT
    )

    setAgentProposal(proposal)
    setOpenDialogId('agent-suggestions')
  }

  const applyAgentProposal = () => {
    if (isViewOnly || !agentProposal) return

    const result = applyAgentPatch(
      {
        areas,
        assets,
        page,
      },
      agentProposal,
      LOCAL_AGENT_CLIENT,
      {
        cssSupports: supportsAgentCssDeclaration,
      }
    )

    if (!result.ok) {
      setImportError(result.errors.join(' '))
      return
    }

    setAreas(result.state.areas)
    setAssets(result.state.assets)
    setPage(result.state.page)
    setAgentAuditRecords((currentRecords) => [
      result.auditRecord,
      ...currentRecords.slice(0, 9),
    ])
    setAgentProposal(null)
    setOpenDialogId(null)
    setImportError(null)
  }

  const rejectAgentProposal = () => {
    setAgentProposal(null)
    setOpenDialogId(null)
  }

  const regenerateShareUrl = (accessMode: ShareAccessMode) => {
    if (isViewOnly) return

    setPage((currentPage) => {
      if (!currentPage.settings.shareLinks) return currentPage

      return {
        ...currentPage,
        settings: {
          ...currentPage.settings,
          shareLinks: regenerateShareLink(
            currentPage.settings.shareLinks,
            accessMode
          ),
        },
      }
    })
    setCopiedShareMode(null)
  }

  const copyShareUrl = async (
    accessMode: ShareAccessMode,
    url: string
  ) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedShareMode(accessMode)
      setImportError(null)
    } catch {
      setImportError('Share link could not be copied.')
    }
  }

  const moveArea = (
    id: string,
    x: number,
    y: number,
    bypassSnapGrid = false
  ) => {
    if (isViewOnly) return

    setAreas((prev) =>
      moveAreaWithSnapGrid(prev, id, x, y, {
        snapGridSize: getActiveSnapGridSize(
          page.settings.snapGrid,
          bypassSnapGrid
        ),
      })
    )
  }

  const endAreaMove = (id: string) => {
    if (isViewOnly) return

    setAreas((prev) => nestAreaIfContained(prev, id))
  }

  const duplicateAreaById = (sourceAreaId: string) => {
    if (isViewOnly) return

    if (!areas.some((area) => area.id === sourceAreaId)) return

    const id = createAreaId(nextAreaId.current)
    nextAreaId.current += 1

    const result = duplicateArea(areas, sourceAreaId, id)

    setAreas(result.areas)
    setSelectedAreaId(result.selectedAreaId)
    setAutoFocusAreaId(result.selectedAreaId)
  }

  const deleteAreaById = (areaId: string) => {
    if (isViewOnly) return

    const result = deleteArea(areas, areaId)

    if (!result.deletedArea) return

    const deletedArea = result.deletedArea

    setAreas(result.areas)
    setDeletedAreaSnapshot(deletedArea)
    setSelectedAreaId((currentSelectedAreaId) => {
      const deletedAreaIds = new Set([
        areaId,
        ...deletedArea.descendantAreas.map((area) => area.id),
      ])

      return currentSelectedAreaId &&
        deletedAreaIds.has(currentSelectedAreaId)
        ? null
        : currentSelectedAreaId
    })
  }

  const undoDeletedArea = () => {
    if (isViewOnly) return

    if (!deletedAreaSnapshot) return

    setAreas((prev) =>
      restoreDeletedArea(prev, deletedAreaSnapshot)
    )
    setSelectedAreaId(deletedAreaSnapshot.area.id)
    setAutoFocusAreaId(deletedAreaSnapshot.area.id)
    setDeletedAreaSnapshot(null)
  }

  const resizeAreaById = (
    id: string,
    width: number,
    height: number,
    bypassSnapGrid = false
  ) => {
    if (isViewOnly) return

    setAreas((prev) => {
      const area = prev.find((currentArea) => currentArea.id === id)
      const parentArea = area?.parentId
        ? prev.find((currentArea) => currentArea.id === area.parentId)
        : null

      return resizeAreaDimensions(prev, id, width, height, {
        maxWidth: area
          ? Math.max(
              MIN_AREA_WIDTH,
              (parentArea?.width ?? window.innerWidth) - area.x
            )
          : undefined,
        maxHeight: area
          ? Math.max(
              MIN_AREA_HEIGHT,
              (parentArea?.height ?? window.innerHeight) - area.y
            )
          : undefined,
        snapGridSize: getActiveSnapGridSize(
          page.settings.snapGrid,
          bypassSnapGrid
        ),
      })
    })
  }

  const updateAreaText = (id: string, text: string) => {
    if (isViewOnly) return

    setAreas((prev) =>
      prev.map((area) =>
        area.id === id && area.type !== 'image'
          ? {
              ...area,
              text,
            }
          : area
      )
    )
  }

  const commitAreaCssCommand = (
    id: string,
    command: CssSlashCommand
  ) => {
    if (isViewOnly) return

    const resolvedValue = resolveThemeColorTokens(
      command.value,
      page.settings.theme.colors
    )

    setAreas((prev) =>
      prev.map((area) => {
        if (area.id !== id || area.type === 'image') return area

        const result = removeCssSlashCommand(area.text, command)

        return {
          ...area,
          text: result.text,
          styles: {
            ...area.styles,
            [command.property]: resolvedValue,
          },
        }
      })
    )
  }

  const insertImageAsset = ({
    alt,
    command,
    height,
    mimeType,
    sourceAreaId,
    src,
    width,
    x,
    y,
    replaceAreaId,
  }: {
    alt: string
    command?: ImageSlashCommand
    height: number
    mimeType: string
    sourceAreaId?: string
    src: string
    width: number
    x: number
    y: number
    replaceAreaId?: string
  }) => {
    if (isViewOnly) return

    const sourceAreaForSelection = sourceAreaId
      ? areas.find((area) => area.id === sourceAreaId)
      : null
    const replacesSourceArea =
      !!command &&
      sourceAreaForSelection?.type !== 'image' &&
      sourceAreaForSelection?.text.trim() === command.raw.trim()
    const assetId = createAssetId(nextAssetId.current)
    const areaId =
      replaceAreaId ??
      (replacesSourceArea && sourceAreaId
        ? sourceAreaId
        : createAreaId(nextAreaId.current))
    const createdAt = new Date().toISOString()
    const initialSize = getInitialImageAreaSize(width, height)
    const asset: AssetState = {
      id: assetId,
      kind: 'image',
      mimeType,
      width,
      height,
      storageKey: src,
      createdAt,
    }
    const imageArea: ImageAreaState = {
      id: areaId,
      type: 'image',
      parentId: null,
      x,
      y,
      width: initialSize.width,
      height: initialSize.height,
      assetId,
      alt,
      styles: {},
      createdAt,
      updatedAt: createdAt,
    }

    nextAssetId.current += 1
    if (!replaceAreaId && !replacesSourceArea) nextAreaId.current += 1

    setAssets((prev) => [...prev, asset])
    setHasClickedCanvas(true)

    setAreas((prev) => {
      if (replaceAreaId) {
        return prev.map((area) =>
          area.id === replaceAreaId
            ? {
                ...imageArea,
                id: area.id,
                parentId: area.parentId,
                x: area.x,
                y: area.y,
              }
            : area
        )
      }

      if (sourceAreaId && command) {
        const sourceArea = prev.find(
          (area): area is TextAreaState =>
            area.id === sourceAreaId && area.type !== 'image'
        )

        if (sourceArea && sourceArea.text.trim() === command.raw.trim()) {
          return prev.map((area) =>
            area.id === sourceAreaId
              ? {
                  ...imageArea,
                  id: sourceAreaId,
                  parentId: area.parentId,
                  x: area.x,
                  y: area.y,
                  createdAt: area.createdAt,
                }
              : area
          )
        }

        return [
          ...prev.map((area) => {
            if (area.id !== sourceAreaId || area.type === 'image') {
              return area
            }

            const result = removeImageSlashCommand(area.text, command)

            return {
              ...area,
              text: result.text,
            }
          }),
          imageArea,
        ]
      }

      return [...prev, imageArea]
    })
    setSelectedAreaId(areaId)
    setAutoFocusAreaId(areaId)
  }

  const insertImageFromSource = async ({
    alt,
    command,
    mimeType,
    sourceAreaId,
    src,
    x,
    y,
    replaceAreaId,
  }: {
    alt: string
    command?: ImageSlashCommand
    mimeType: string
    sourceAreaId?: string
    src: string
    x: number
    y: number
    replaceAreaId?: string
  }) => {
    if (isViewOnly) return

    try {
      const metadata = await loadImageMetadata(src)
      const resolvedAlt = requestImageAltText(alt)

      insertImageAsset({
        alt: resolvedAlt,
        command,
        height: metadata.height,
        mimeType,
        sourceAreaId,
        src,
        width: metadata.width,
        x,
        y,
        replaceAreaId,
      })
      setImportError(null)
    } catch {
      setImportError('Image could not be loaded.')
    }
  }

  const insertImageFromUrl = async (
    url: string,
    pendingInsert: PendingImageInsert
  ) => {
    if (isViewOnly) return

    const validationError = getImageUrlValidationError(url)

    if (validationError) {
      setImportError(validationError)
      return
    }

    await insertImageFromSource({
      alt: getUrlAltText(url),
      command:
        pendingInsert.kind === 'new'
          ? pendingInsert.command
          : undefined,
      mimeType: 'image/remote',
      sourceAreaId:
        pendingInsert.kind === 'new'
          ? pendingInsert.sourceAreaId
          : undefined,
      src: url,
      x: pendingInsert.kind === 'new' ? pendingInsert.x : 0,
      y: pendingInsert.kind === 'new' ? pendingInsert.y : 0,
      replaceAreaId:
        pendingInsert.kind === 'replace'
          ? pendingInsert.areaId
          : undefined,
    })
  }

  const insertImageFromFile = async (
    file: File,
    pendingInsert: PendingImageInsert
  ) => {
    if (isViewOnly) return

    const validationError = getImageFileValidationError(file)

    if (validationError) {
      setImportError(validationError)
      return
    }

    try {
      const src = await readFileAsDataUrl(file)

      await insertImageFromSource({
        alt: getFileAltText(file.name),
        command:
          pendingInsert.kind === 'new'
            ? pendingInsert.command
            : undefined,
        mimeType: file.type,
        sourceAreaId:
          pendingInsert.kind === 'new'
            ? pendingInsert.sourceAreaId
            : undefined,
        src,
        x: pendingInsert.kind === 'new' ? pendingInsert.x : 0,
        y: pendingInsert.kind === 'new' ? pendingInsert.y : 0,
        replaceAreaId:
          pendingInsert.kind === 'replace'
            ? pendingInsert.areaId
            : undefined,
      })
    } catch {
      setImportError('Image file could not be read.')
    }
  }

  const commitAreaImageCommand = (
    sourceAreaId: string,
    command: ImageSlashCommand
  ) => {
    if (isViewOnly) return

    const sourceArea = areas.find((area) => area.id === sourceAreaId)
    const insertPoint =
      sourceArea && sourceArea.type !== 'image'
        ? {
            x: sourceArea.x,
            y:
              sourceArea.text.trim() === command.raw.trim()
                ? sourceArea.y
                : sourceArea.y + sourceArea.height + 16,
          }
        : getViewportCenterPoint(canvasZoom)
    const pendingInsert: PendingImageInsert = {
      kind: 'new',
      x: insertPoint.x,
      y: insertPoint.y,
      sourceAreaId,
      command,
    }

    if (command.url) {
      void insertImageFromUrl(command.url, pendingInsert)
      return
    }

    pendingImageInsert.current = pendingInsert
    imageInputRef.current?.click()
  }

  const replaceImageById = (areaId: string) => {
    if (isViewOnly) return

    pendingImageInsert.current = {
      kind: 'replace',
      areaId,
    }
    imageInputRef.current?.click()
  }

  const updateImageAlt = (areaId: string, alt: string) => {
    if (isViewOnly) return

    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId && area.type === 'image'
          ? {
              ...area,
              alt,
            }
          : area
      )
    )
  }

  const exportPageJson = () => {
    const json = stringifyPageState({ areas, assets, page })
    const blob = new Blob([json], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `${page.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled-page'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importPageJson = async (e: ChangeEvent<HTMLInputElement>) => {
    if (isViewOnly) return

    const file = e.currentTarget.files?.[0]

    e.currentTarget.value = ''

    if (!file) return

    const result = parsePageJson(await file.text())

    if (!result.ok) {
      setImportError(result.error)
      return
    }

    setPage(result.state.page)
    setAreas(result.state.areas)
    setAssets(result.state.assets)
    setSelectedAreaId(null)
    setImportError(null)
  }

  const importImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    if (isViewOnly) return

    const file = e.currentTarget.files?.[0]
    const pendingInsert =
      pendingImageInsert.current ?? {
        kind: 'new',
        ...getViewportCenterPoint(canvasZoom),
      }

    e.currentTarget.value = ''
    pendingImageInsert.current = null

    if (!file) return

    await insertImageFromFile(file, pendingInsert)
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isViewOnly) return

      if (!e.clipboardData?.files.length) return

      const file = getFirstImageFile(e.clipboardData.files)

      if (!file) return

      e.preventDefault()
      void insertImageFromFile(file, {
        kind: 'new',
        ...getViewportCenterPoint(canvasZoom),
      })
    }

    document.addEventListener('paste', handlePaste)

    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  })

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isViewOnly) return

    if (getFirstImageFile(e.dataTransfer.files)) {
      e.preventDefault()
    }
  }

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (isViewOnly) return

    const file = getFirstImageFile(e.dataTransfer.files)

    if (!file) return

    e.preventDefault()
    void insertImageFromFile(file, {
      kind: 'new',
      ...getCanvasPoint(e.clientX, e.clientY, canvasZoom),
    })
  }

  const canvasWorldSize = getCanvasWorldSize(areas, {
    height:
      typeof window === 'undefined' ? 900 : window.innerHeight,
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
  })
  const canvasStyle = {
    backgroundColor: page.settings.background,
  } as CSSProperties
  const canvasWorldStyle = {
    '--canvas-ui-scale': `${1 / canvasZoom}`,
    '--canvas-world-height': `${canvasWorldSize.height}px`,
    '--canvas-world-width': `${canvasWorldSize.width}px`,
    '--canvas-zoom': `${canvasZoom}`,
    '--snap-grid-size': `${clampSnapGridSize(
      page.settings.snapGrid.size
    )}px`,
  } as CSSProperties & {
    '--canvas-ui-scale': string
    '--canvas-world-height': string
    '--canvas-world-width': string
    '--canvas-zoom': string
    '--snap-grid-size': string
  }
  const showThemeColorSwatches =
    page.settings.theme.colors.length > 0 &&
    (openDialogId === 'page-styles' || selectedAreaId !== null)
  const commandPaletteOptions = isViewOnly
    ? COMMAND_PALETTE_OPTIONS.filter((option) =>
        [
          'help',
          'settings',
          'share',
          'zoom-in',
          'zoom-out',
          'reset-zoom',
          'zoom-to-fit',
          'zoom-to-selection',
        ].includes(option.id)
      )
    : COMMAND_PALETTE_OPTIONS
  const currentUrl =
    typeof window === 'undefined'
      ? 'https://example.test/'
      : window.location.href
  const editShareUrl = page.settings.shareLinks
    ? buildShareUrl(
        currentUrl,
        'edit',
        page.settings.shareLinks.editToken
      )
    : ''
  const viewShareUrl = page.settings.shareLinks
    ? buildShareUrl(
        currentUrl,
        'view',
        page.settings.shareLinks.viewToken
      )
    : ''
  function renderArea(area: AreaState) {
    return (
      <Area
        key={area.id}
        area={area}
        asset={
          area.type === 'image'
            ? assets.find((asset) => asset.id === area.assetId)
            : undefined
        }
        themeColors={page.settings.theme.colors}
        isNewest={area.id === autoFocusAreaId}
        isSelected={area.id === selectedAreaId}
        isReadOnly={isViewOnly}
        canvasZoom={canvasZoom}
        onSelect={(areaId) => {
          if (!isViewOnly) setSelectedAreaId(areaId)
        }}
        onTextChange={updateAreaText}
        onMove={moveArea}
        onMoveEnd={endAreaMove}
        onDuplicate={duplicateAreaById}
        onDelete={deleteAreaById}
        onResize={resizeAreaById}
        onCommitCssCommand={commitAreaCssCommand}
        onCommitImageCommand={commitAreaImageCommand}
        onReplaceImage={replaceImageById}
        onChangeImageAlt={updateImageAlt}
        onDeselect={() => setSelectedAreaId(null)}
      >
        {getChildAreas(areas, area.id).map(renderArea)}
      </Area>
    )
  }

  return (
    <div
      id="canvas"
      ref={canvasRef}
      style={canvasStyle}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      <button
        className="site-brand"
        type="button"
        aria-label="Open command palette"
        onClick={() => setCommandPaletteQuery('')}
      >
        <img
          alt=""
          className="site-brand-mark"
          draggable="false"
          src="/logo.svg"
        />
        <span>cascadery</span>
      </button>

      <div className="page-persistence">
        {isViewOnly && (
          <span className="access-mode-badge access-mode-badge--view-only">
            View only
          </span>
        )}
        <span
          aria-live="polite"
          className={`save-status save-status--${saveStatus}`}
        >
          {getSaveStatusLabel(saveStatus)}
        </span>
        <button
          className="page-persistence-button"
          type="button"
          onClick={exportPageJson}
        >
          Export JSON
        </button>
        {!isViewOnly && (
          <button
            className="page-persistence-button"
            type="button"
            onClick={() => importInputRef.current?.click()}
          >
            Import JSON
          </button>
        )}
        <input
          ref={importInputRef}
          accept="application/json,.json"
          className="page-import-input"
          type="file"
          onChange={importPageJson}
        />
        <input
          ref={imageInputRef}
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="page-import-input"
          type="file"
          onChange={importImageFile}
        />
        {importError && (
          <span className="import-error" role="alert">
            {importError}
          </span>
        )}
      </div>

      <div
        aria-label="Collaboration presence"
        className="collaboration-presence"
      >
        <span
          className={`collaboration-status collaboration-status--${displayedCollaborationStatus}`}
        >
          {getCollaborationStatusLabel(displayedCollaborationStatus)}
        </span>
        <span
          className="presence-avatar presence-avatar--local"
          style={
            {
              '--presence-color': collaborationProfile.color,
            } as PresenceCssProperties
          }
          title={`You: ${collaborationProfile.userName}`}
        >
          {getPresenceInitials(collaborationProfile.userName)}
        </span>
        {displayedRemotePresences.map((presence) => (
          <span
            className="presence-avatar"
            key={presence.clientId}
            style={
              {
                '--presence-color': presence.color,
              } as PresenceCssProperties
            }
            title={presence.userName}
          >
            {getPresenceInitials(presence.userName)}
          </span>
        ))}
      </div>

      {!hasClickedCanvas && areas.length === 0 && (
        <div className="canvas-hint">
          <span>Click anywhere to begin.</span>
          <span>
            Press <kbd>esc</kbd> or start typing for options and settings.
          </span>
        </div>
      )}

      {showThemeColorSwatches && (
        <div className="theme-color-swatches" aria-label="Theme colors">
          {page.settings.theme.colors.map((color) => (
            <div className="theme-color-swatch" key={color.id}>
              <span
                className="theme-color-swatch-chip"
                style={{ backgroundColor: color.value }}
              />
              <span>{color.token}</span>
            </div>
          ))}
        </div>
      )}

      <div className="canvas-scroll-size" style={canvasWorldStyle}>
        <div
          className={`canvas-world${
            page.settings.snapGrid.visible
              ? ' canvas--grid-visible'
              : ''
          }`}
        >
          {getRootAreas(areas).map(renderArea)}

          <div
            className="remote-collaboration-layer"
            aria-hidden="true"
          >
            {displayedRemotePresences.map((presence) => {
              if (!presence.selectedAreaId) return null

              const area = areas.find(
                (currentArea) =>
                  currentArea.id === presence.selectedAreaId
              )

              if (!area) return null

              const position = getAreaAbsolutePosition(
                areas,
                area.id
              )

              return (
                <div
                  className="remote-selection-ring"
                  key={`${presence.clientId}-selection`}
                  style={
                    {
                      '--presence-color': presence.color,
                      height: area.height,
                      left: position.x,
                      top: position.y,
                      width: area.width,
                    } as PresenceCssProperties
                  }
                >
                  <span>{presence.userName}</span>
                </div>
              )
            })}
            {displayedRemotePresences.map((presence) =>
              presence.cursor ? (
                <div
                  className="remote-cursor"
                  key={`${presence.clientId}-cursor`}
                  style={
                    {
                      '--presence-color': presence.color,
                      left: presence.cursor.x,
                      top: presence.cursor.y,
                    } as PresenceCssProperties
                  }
                >
                  <span>{presence.userName}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>

      <CanvasZoomControls
        zoom={canvasZoom}
        onFit={zoomCanvasToFit}
        onReset={resetCanvasZoom}
        onZoomIn={() => zoomCanvasByDirection(1)}
        onZoomOut={() => zoomCanvasByDirection(-1)}
      />

      {deletedAreaSnapshot && (
        <div
          aria-live="polite"
          className="undo-toast"
          role="status"
        >
          <span>Area deleted</span>
          <button
            className="undo-toast-button"
            type="button"
            onClick={undoDeletedArea}
          >
            Undo
          </button>
        </div>
      )}

      {commandPaletteQuery !== null && (
        <CommandPalette
          query={commandPaletteQuery}
          options={commandPaletteOptions}
          onQueryChange={setCommandPaletteQuery}
          onOpenOption={(option) => {
            setCommandPaletteQuery(null)
            if (option.id === 'share') {
              ensureShareLinks()
              setOpenDialogId(option.id)
              return
            }
            if (option.id === 'toggle-snap-grid') {
              updateSnapGrid((current) => ({
                enabled: !current.enabled,
              }))
              return
            }
            if (option.id === 'insert-image') {
              pendingImageInsert.current = {
                kind: 'new',
                ...getViewportCenterPoint(canvasZoom),
              }
              imageInputRef.current?.click()
              return
            }
            if (option.id === 'zoom-in') {
              zoomCanvasByDirection(1)
              return
            }
            if (option.id === 'zoom-out') {
              zoomCanvasByDirection(-1)
              return
            }
            if (option.id === 'reset-zoom') {
              resetCanvasZoom()
              return
            }
            if (option.id === 'zoom-to-fit') {
              zoomCanvasToFit()
              return
            }
            if (option.id === 'zoom-to-selection') {
              zoomCanvasToSelection()
              return
            }
            if (option.id === 'agent-suggestions') {
              createAgentSuggestion()
              return
            }
            setOpenDialogId(option.id)
          }}
          onClose={() => setCommandPaletteQuery(null)}
        />
      )}

      {openDialogId !== null && COMMAND_DIALOGS[openDialogId] && (
        <div
          className="command-dialog-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setOpenDialogId(null)
          }}
        >
          <section
            className="command-dialog"
            role="dialog"
            aria-label={COMMAND_DIALOGS[openDialogId].title}
          >
            <h2>{COMMAND_DIALOGS[openDialogId].title}</h2>
            {openDialogId === 'share' ? (
              <div className="share-link-controls">
                <p>
                  Anyone with an edit link can change this page. View-only
                  links open a clean read mode.
                </p>
                {page.settings.shareLinks ? (
                  <>
                    <ShareLinkRow
                      accessMode="edit"
                      copiedShareMode={copiedShareMode}
                      description="Can create, edit, move, resize, delete, and change page settings."
                      label="Can edit"
                      url={editShareUrl}
                      onCopy={copyShareUrl}
                      onRegenerate={regenerateShareUrl}
                    />
                    <ShareLinkRow
                      accessMode="view"
                      copiedShareMode={copiedShareMode}
                      description="Can read the page without editing controls."
                      label="Can view"
                      url={viewShareUrl}
                      onCopy={copyShareUrl}
                      onRegenerate={regenerateShareUrl}
                    />
                  </>
                ) : (
                  <p>
                    Share links are available to the editor who creates
                    them.
                  </p>
                )}
              </div>
            ) : openDialogId === 'agent-suggestions' ? (
              <div className="agent-proposal">
                <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                {agentProposal ? (
                  <>
                    <div className="agent-proposal-summary">
                      <strong>Agent proposal</strong>
                      <span>
                        {agentProposal.operations.length} operation
                        {agentProposal.operations.length === 1
                          ? ''
                          : 's'}
                      </span>
                    </div>
                    <div className="agent-proposal-operations">
                      {agentProposal.operations.map(
                        (operation, operationIndex) => (
                          <div
                            className="agent-proposal-operation"
                            key={`${operation.op}-${operationIndex}`}
                          >
                            <code>{operation.op}</code>
                            <span>
                              {getAgentOperationSummary(operation)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                    <div className="agent-proposal-actions">
                      <button
                        className="agent-proposal-button"
                        type="button"
                        onClick={applyAgentProposal}
                      >
                        Apply proposal
                      </button>
                      <button
                        className="agent-proposal-button agent-proposal-button--secondary"
                        type="button"
                        onClick={rejectAgentProposal}
                      >
                        Reject proposal
                      </button>
                    </div>
                  </>
                ) : (
                  <p>No agent proposal is waiting for review.</p>
                )}
                {agentAuditRecords.length > 0 && (
                  <p className="agent-proposal-audit">
                    Last applied patch: {agentAuditRecords[0].patchId}
                  </p>
                )}
              </div>
            ) : openDialogId === 'settings' ? (
              <div className="settings-controls">
                <p>
                  Your name and color identify your cursor and selection
                  to other people on this page.
                </p>
                <label className="page-style-control">
                  <span>Collaboration display name</span>
                  <input
                    aria-label="Collaboration display name"
                    type="text"
                    value={collaborationProfile.userName}
                    onChange={(e) =>
                      updateCollaborationUserName(
                        e.currentTarget.value
                      )
                    }
                  />
                </label>
                <div className="settings-presence-preview">
                  <span
                    className="presence-avatar presence-avatar--local"
                    style={
                      {
                        '--presence-color':
                          collaborationProfile.color,
                      } as PresenceCssProperties
                    }
                  >
                    {getPresenceInitials(
                      collaborationProfile.userName
                    )}
                  </span>
                  <span>{collaborationProfile.color}</span>
                </div>
              </div>
            ) : openDialogId === 'page-styles' ? (
              <div className="page-style-controls">
                <section className="page-style-section">
                  <h3>Grid</h3>
                  <label className="page-style-control page-style-control--inline">
                    <input
                      aria-label="Snap to grid"
                      checked={page.settings.snapGrid.enabled}
                      type="checkbox"
                      onChange={(e) =>
                        updateSnapGrid({
                          enabled: e.currentTarget.checked,
                        })
                      }
                    />
                    <span>Snap to grid</span>
                  </label>
                  <label className="page-style-control page-style-control--inline">
                    <input
                      aria-label="Show grid"
                      checked={page.settings.snapGrid.visible}
                      type="checkbox"
                      onChange={(e) =>
                        updateSnapGrid({
                          visible: e.currentTarget.checked,
                        })
                      }
                    />
                    <span>Show grid</span>
                  </label>
                  <label className="page-style-control">
                    <span>Grid size</span>
                    <input
                      aria-label="Grid size"
                      inputMode="numeric"
                      min="4"
                      max="128"
                      step="1"
                      type="number"
                      value={page.settings.snapGrid.size}
                      onChange={(e) =>
                        updateSnapGrid({
                          size: clampSnapGridSize(
                            e.currentTarget.valueAsNumber
                          ),
                        })
                      }
                    />
                  </label>
                </section>
                <section className="page-style-section">
                  <h3>MCP access</h3>
                  <label className="page-style-control page-style-control--inline">
                    <input
                      aria-label="Allow MCP access"
                      checked={page.settings.mcp.enabled}
                      type="checkbox"
                      onChange={(e) =>
                        updateMcpAccess(e.currentTarget.checked)
                      }
                    />
                    <span>Allow MCP access</span>
                  </label>
                </section>
                <section className="page-style-section theme-color-editor">
                  <h3>Theme colors</h3>
                  <div className="theme-color-fields">
                    <label className="page-style-control">
                      <span>Name</span>
                      <input
                        aria-label="Theme color name"
                        placeholder="Business Blue"
                        type="text"
                        value={themeColorName}
                        onChange={(e) => {
                          const nextName = e.currentTarget.value
                          const tokenTracksName =
                            !themeColorToken.trim() ||
                            normalizeThemeColorToken(themeColorToken) ===
                              normalizeThemeColorToken(themeColorName)

                          setThemeColorName(nextName)
                          if (tokenTracksName) {
                            setThemeColorToken(
                              normalizeThemeColorToken(nextName)
                            )
                          }
                        }}
                      />
                    </label>
                    <label className="page-style-control">
                      <span>Token</span>
                      <input
                        aria-label="Theme color token"
                        placeholder="business-blue"
                        type="text"
                        value={themeColorToken}
                        onChange={(e) =>
                          setThemeColorToken(e.currentTarget.value)
                        }
                      />
                    </label>
                    <label className="page-style-control">
                      <span>Value</span>
                      <input
                        aria-label="Theme color value"
                        type="color"
                        value={themeColorValue}
                        onChange={(e) =>
                          setThemeColorValue(e.currentTarget.value)
                        }
                      />
                    </label>
                    <button
                      className="theme-color-add-button"
                      type="button"
                      onClick={addThemeColor}
                    >
                      Add color
                    </button>
                  </div>
                  {page.settings.theme.colors.length > 0 && (
                    <div className="theme-color-list">
                      {page.settings.theme.colors.map((color) => {
                        const contrastWarning =
                          getThemeColorContrastWarning(
                            color.value,
                            page.settings.background
                          )

                        return (
                          <div className="theme-color-row" key={color.id}>
                            <span
                              className="theme-color-row-chip"
                              style={{
                                backgroundColor: color.value,
                              }}
                            />
                            <span className="theme-color-row-text">
                              <strong>{color.name}</strong>
                              <code>{color.token}</code>
                              {contrastWarning && (
                                <span className="theme-color-warning">
                                  {contrastWarning}
                                </span>
                              )}
                            </span>
                            <button
                              aria-label={`Remove ${color.name}`}
                              className="theme-color-remove-button"
                              type="button"
                              onClick={() => removeThemeColor(color.id)}
                            >
                              Remove
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <p>{COMMAND_DIALOGS[openDialogId].body}</p>
            )}
            <button
              className="command-dialog-button"
              type="button"
              onClick={() => setOpenDialogId(null)}
            >
              Close
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

const ShareLinkRow = ({
  accessMode,
  copiedShareMode,
  description,
  label,
  url,
  onCopy,
  onRegenerate,
}: {
  accessMode: ShareAccessMode
  copiedShareMode: ShareAccessMode | null
  description: string
  label: string
  url: string
  onCopy: (accessMode: ShareAccessMode, url: string) => void
  onRegenerate: (accessMode: ShareAccessMode) => void
}) => (
  <div className="share-link-row">
    <div className="share-link-copy">
      <strong>{label}</strong>
      <span>{description}</span>
      <input
        aria-label={`${label} URL`}
        readOnly
        spellCheck={false}
        value={url}
      />
    </div>
    <div className="share-link-actions">
      <button
        aria-label={
          accessMode === 'edit'
            ? 'Copy edit link'
            : 'Copy view-only link'
        }
        className="share-link-button"
        type="button"
        onClick={() => onCopy(accessMode, url)}
      >
        {copiedShareMode === accessMode ? 'Copied' : 'Copy'}
      </button>
      <button
        className="share-link-button share-link-button--secondary"
        type="button"
        onClick={() => onRegenerate(accessMode)}
      >
        {accessMode === 'edit'
          ? 'Regenerate edit link'
          : 'Regenerate view link'}
      </button>
    </div>
  </div>
)

const CanvasZoomControls = ({
  zoom,
  onFit,
  onReset,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number
  onFit: () => void
  onReset: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}) => (
  <div className="canvas-zoom-controls" aria-label="Canvas zoom">
    <button
      aria-label="Zoom out"
      className="canvas-zoom-button"
      title="Zoom out"
      type="button"
      onClick={onZoomOut}
    >
      -
    </button>
    <button
      aria-label={`Reset zoom from ${formatCanvasZoom(zoom)} to 100%`}
      className="canvas-zoom-value"
      title="Reset zoom to 100%"
      type="button"
      onClick={onReset}
    >
      {formatCanvasZoom(zoom)}
    </button>
    <button
      aria-label="Zoom in"
      className="canvas-zoom-button"
      title="Zoom in"
      type="button"
      onClick={onZoomIn}
    >
      +
    </button>
    <button
      aria-label="Zoom to fit"
      className="canvas-zoom-button"
      title="Zoom to fit"
      type="button"
      onClick={onFit}
    >
      Fit
    </button>
  </div>
)

export default App
