import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, ChangeEvent } from 'react'

import Area from './components/Area'
import AreaStyleDialog from './components/AreaStyleDialog'
import CommandPalette from './components/CommandPalette'
import {
  deleteArea,
  duplicateArea,
  restoreDeletedArea,
  type DeletedAreaSnapshot,
} from './areaActions'
import {
  AREA_KINDS,
  AREA_LINK_CARDINALITIES,
  AREA_LINK_DIRECTIONS,
  AREA_LINK_KINDS,
  AREA_LINK_LABEL_VISIBILITIES,
  AREA_LINK_OPTIONALITIES,
  AREA_LINK_ROUTES,
  AREA_LINK_VISUAL_MODES,
  AREA_STATUSES,
  createAreaLink,
  getAreaMetadata,
  normalizeAreaLink,
  removeAreaLinksForDeletedAreas,
  setAreaMetadata,
  type AreaLink,
  type AreaLinkCardinality,
  type AreaLinkDirection,
  type AreaLinkEndpoint,
  type AreaLinkKind,
  type AreaLinkLabelVisibility,
  type AreaLinkOptionality,
  type AreaLinkRoute,
  type AreaLinkSchema,
  type AreaLinkSide,
  type AreaLinkVisual,
  type AreaLinkVisualMode,
  type AreaMetadata,
  type AreaStatus,
} from './areaMetadata'
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
  getContinuousCanvasZoom,
  getNextCanvasZoom,
  getZoomToFit,
  screenToCanvasPoint,
} from './canvasViewport'
import {
  applyAgentPatch,
  createAgentPatchForOperation,
  removeAgentPatchOperation,
  suggestDecisionLog,
  type AgentActionRecord,
  type AgentClient,
  type AgentPatch,
  type AgentPatchOperation,
} from './agentInterface'
import type { CssSlashCommand } from './cssSlashCommand'
import { removeCssSlashCommand } from './cssSlashCommand'
import { normalizeStyleValueInput } from './cssStyleCatalog'
import {
  addAreaEvidenceReference,
  createAreaEvidenceReference,
  removeAreaEvidenceReference,
  removeAreaEvidenceSlashCommand,
  type EvidenceSlashCommand,
} from './areaEvidence'
import type { ImageSlashCommand } from './imageSupport'
import {
  getImageFileContentValidationError,
  getImageFileValidationError,
  getImageUrlValidationError,
  removeImageSlashCommand,
} from './imageSupport'
import {
  GifSearchConfigurationError,
  createGiphySearchProvider,
  removeGifSlashCommand,
  toGifAssetSource,
  type GifAssetSource,
  type GifSearchResult,
  type GifSlashCommand,
} from './gifSearch'
import { readGiphyApiKey } from './gifSearchConfig'
import {
  getCandidateParentId,
  getAreaAbsolutePosition,
  getAreaAbsoluteRect,
  getChildAreas,
  getAreaDepth,
  getUnnestingSourceId,
  getRootAreas,
  nestAreaIfContained,
  reparentArea,
} from './nestedAreas'
import {
  getAreaBorderHit,
  getAreaEndpointPoint,
  moveSharedLinkEndpoint,
  snapLinkEndpointToExisting,
  type Point,
} from './linkGeometry'
import { getAreaLinkEditButtonOffset } from './areaLinkControls'
import {
  getOffscreenAreaIndicators,
  getOffscreenIndicatorAriaLabel,
  type OffscreenIndicator,
} from './offscreenAreaIndicators'
import {
  createDefaultPageState,
  PAGE_STORAGE_KEY,
  parsePageJson,
  stringifyPageState,
  type PageAppState,
} from './pagePersistence'
import {
  CONTEXT_KITS,
  getContextKitById,
  insertContextKit,
  type ContextKit,
} from './contextKits'
import { createAgentHandoffBrief } from './agentHandoff'
import {
  exportPageAsMarkdown,
  MARKDOWN_MIME_TYPE,
  JSON_CANVAS_MIME_TYPE,
  stringifyExportedPageState,
  stringifyPageAsJsonCanvas,
} from './pageExports'
import {
  addPageHistoryEntry,
  applyRestorePageStatePatch,
  createAgentHistoryEntry,
  createEmptyPageHistoryState,
  createImportHistoryEntry,
  getPageHistoryPatch,
  getRecentPageHistoryEvents,
  PAGE_HISTORY_STORAGE_KEY,
  parsePageHistoryJson,
  serializePageHistoryState,
  type ChangeActor,
  type PageChangeEvent,
} from './pageHistory'
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
import {
  getLatestMcpAgentActivity,
  getMcpAgentActivityLabel,
} from './mcpAgentActivity'
import { COMMAND_PALETTE_OPTIONS } from './commandPaletteOptions'

export type BaseAreaState = {
  id: string
  parentId: string | null
  x: number
  y: number
  height: number
  width: number
  styles: Record<string, string>
  metadata?: AreaMetadata
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
  source?: GifAssetSource
}

type SaveStatus = 'saved' | 'saving' | 'offline-changes'
type CollaborationStatus = 'connected' | 'offline'
type PresenceCssProperties = CSSProperties & {
  '--presence-color': string
}
type OffscreenIndicatorCssProperties = CSSProperties & {
  '--offscreen-indicator-x': string
  '--offscreen-indicator-y': string
  '--offscreen-indicator-rotation': string
}
type AreaLinkEditButtonCssProperties = CSSProperties & {
  '--area-link-label-offset': string
}
type CanvasViewportSnapshot = {
  x: number
  y: number
  width: number
  height: number
  pixelWidth: number
  pixelHeight: number
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
type RemovableSlashCommand = {
  start: number
  end: number
  raw: string
}
type RemoveSlashCommand = (
  text: string,
  command: Pick<RemovableSlashCommand, 'start' | 'end'>
) => {
  text: string
  caretIndex: number
}
type ActiveGifCommand = {
  areaId: string
  command: GifSlashCommand
}
type GifSearchState = {
  status:
    | 'idle'
    | 'missing-key'
    | 'loading'
    | 'ready'
    | 'empty'
    | 'error'
  results: GifSearchResult[]
  selectedIndex: number
  message?: string
}

type NestingPreviewState = {
  draggedAreaId: string | null
  candidateParentId: string | null
  unnestingFromParentId: string | null
}

type LinkDragState = {
  sourceAreaId: string
  sourceEndpoint: AreaLinkEndpoint
  pointer: Point
  targetAreaId: string | null
  targetEndpoint: AreaLinkEndpoint | null
}

type LinkEndpointName = 'from' | 'to'

type LinkEndpointDragState = {
  linkId: string
  endpointName: LinkEndpointName
  originalLinks: AreaLink[]
  originalEndpoint: AreaLinkEndpoint
  currentEndpoint: AreaLinkEndpoint
  targetEndpoint: AreaLinkEndpoint | null
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

const COMMAND_DIALOGS: Record<
  string,
  {
    title: string
    body: string
  }
> = {
  help: {
    title: 'Help',
    body: 'Map implementation context. Style it with CSS. Hand it to agents safely. Areas hold notes, decisions, tasks, risks, UI states, files, images, and evidence. Use /border: 1px solid red to style an Area, /ref src/App.tsx, then press Enter to ground it, and the handoff brief when an agent needs focused context.',
  },
  settings: {
    title: 'Settings',
    body: 'Page-level canvas preferences for collaboration, identity, and editor behavior.',
  },
  'page-styles': {
    title: 'Page styles',
    body: 'Page-wide canvas appearance, separate from per-Area CSS slash commands.',
  },
  'set-area-type': {
    title: 'Set Area type',
    body: 'Choose lightweight metadata for the selected Area.',
  },
  'link-selected-area': {
    title: 'Link selected Area',
    body: 'Create a visible relationship from the selected Area to another Area.',
  },
  'edit-area-link': {
    title: 'Edit connector',
    body: 'Refine the relationship, visual treatment, and schema details for this connector.',
  },
  'nest-selected-area': {
    title: 'Nest selected Area',
    body: 'Move the selected Area inside another Area while preserving its canvas position.',
  },
  'agent-suggestions': {
    title: 'Agent proposal',
    body: 'Review suggested agent changes before applying them to the canvas.',
  },
  'insert-context-kit': {
    title: 'Insert context kit',
    body: 'Choose a starter layout for a common developer context workflow.',
  },
  'add-evidence': {
    title: 'Add evidence',
    body: 'Attach a file, URL, issue, PR, commit, command, or note to the selected Area.',
  },
  'agent-handoff': {
    title: 'Agent handoff brief',
    body: 'Copy or export a deterministic Markdown brief from this context canvas.',
  },
  share: {
    title: 'Share',
    body: 'Create collaboration links for this implementation context canvas.',
  },
  history: {
    title: 'History',
    body: 'Recent recoverable page changes live here.',
  },
  'leave-canvas': {
    title: 'Are you sure you want to leave?',
    body: 'You will return to the Cascadery start screen. Your canvas URL will still open this page.',
  },
}

const ZOOM_COMMAND_OPTION_IDS = new Set([
  'zoom-in',
  'zoom-out',
  'reset-zoom',
  'zoom-to-fit',
  'zoom-to-selection',
])

const isZoomCommandOption = (option: { id: string }) =>
  ZOOM_COMMAND_OPTION_IDS.has(option.id)

const AREA_LINK_KIND_LABELS: Record<AreaLinkKind, string> = {
  'relates-to': 'Relates to',
  'depends-on': 'Depends on',
  implements: 'Implements',
  blocks: 'Blocks',
  answers: 'Answers',
  references: 'References',
  contains: 'Contains',
}

const AREA_LINK_VISUAL_MODE_LABELS: Record<
  AreaLinkVisualMode,
  string
> = {
  simple: 'Simple',
  semantic: 'Developer semantic',
  schema: 'Schema',
}

const AREA_LINK_DIRECTION_LABELS: Record<AreaLinkDirection, string> =
  {
    none: 'No arrow',
    forward: 'Forward',
    backward: 'Backward',
    both: 'Both directions',
  }

const AREA_LINK_ROUTE_LABELS: Record<AreaLinkRoute, string> = {
  auto: 'Auto',
  straight: 'Straight',
  orthogonal: 'Orthogonal',
}

const AREA_LINK_LABEL_VISIBILITY_LABELS: Record<
  AreaLinkLabelVisibility,
  string
> = {
  auto: 'Auto',
  always: 'Always',
  selected: 'Selected only',
}

const AREA_LINK_CARDINALITY_LABELS: Record<
  AreaLinkCardinality,
  string
> = {
  one: 'One',
  many: 'Many',
}

const AREA_LINK_OPTIONALITY_LABELS: Record<
  AreaLinkOptionality,
  string
> = {
  optional: 'Optional',
  required: 'Required',
  mixed: 'Mixed',
}

const LOCAL_AGENT_CLIENT: AgentClient = {
  id: 'local-agent',
  displayName: 'Cascadery Agent',
  scopes: ['page:read', 'page:search', 'page:suggest', 'page:write'],
}

const MCP_STATUS_CLIENT: AgentClient = {
  id: 'no-auth-mcp',
  displayName: 'No-auth MCP client',
  scopes: ['page:read', 'page:search', 'page:suggest'],
}

const MCP_STATUS_SCOPE_LABEL = MCP_STATUS_CLIENT.scopes.join(', ')
const MCP_STATUS_LABEL = `${MCP_STATUS_CLIENT.displayName}: ${MCP_STATUS_SCOPE_LABEL}`
const MCP_AGENT_ACTIVITY_POLL_INTERVAL_MS = 10_000
const LOCAL_HISTORY_ACTOR: ChangeActor = {
  kind: 'local-user',
  id: 'local-user',
  displayName: 'Local user',
}

const fetchMcpAgentActivityLabel = async (pageId: string) => {
  const response = await fetch('/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'mcp-agent-actions',
      method: 'resources/read',
      params: {
        uri: `cascadery://pages/${pageId}/agent-actions`,
      },
    }),
  })

  if (!response.ok) return null

  const payload = await response.json()
  const contentText = readJsonRpcTextContent(payload)

  if (!contentText) return null

  try {
    const content = JSON.parse(contentText)
    const contentRecord = readUnknownRecord(content)
    const latestActivity = getLatestMcpAgentActivity(
      contentRecord?.actions
    )

    return latestActivity
      ? getMcpAgentActivityLabel(latestActivity)
      : null
  } catch {
    return null
  }
}

const readJsonRpcTextContent = (value: unknown) => {
  const responseRecord = readUnknownRecord(value)
  const resultRecord = readUnknownRecord(responseRecord?.result)
  const contents = Array.isArray(resultRecord?.contents)
    ? resultRecord.contents
    : []
  const firstContent = readUnknownRecord(contents[0])

  return typeof firstContent?.text === 'string'
    ? firstContent.text
    : null
}

const readUnknownRecord = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

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

const createAreaLinkId = (nextId: number) => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `link_${crypto.randomUUID()}`
  }

  return `link-${nextId}`
}

const createEvidenceId = (nextId: number) => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `evidence_${crypto.randomUUID()}`
  }

  return `evidence-${nextId}`
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

const getInitialPageHistoryState = () => {
  if (typeof localStorage === 'undefined') {
    return createEmptyPageHistoryState()
  }

  const savedJson = localStorage.getItem(PAGE_HISTORY_STORAGE_KEY)

  return savedJson
    ? parsePageHistoryJson(savedJson)
    : createEmptyPageHistoryState()
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

const getHistoryActionLabel = (event: PageChangeEvent) => {
  if (event.actionType === 'agent-proposal') return 'Agent proposal'
  if (event.actionType === 'import') return 'Import'
  if (event.actionType === 'restore') return 'Restore'

  return 'Page change'
}

const getHistoryEventTimeLabel = (createdAt: string) => {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) return createdAt

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
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

const getInitialCanvasViewportSnapshot = (): CanvasViewportSnapshot => {
  const width = typeof window === 'undefined' ? 1440 : window.innerWidth
  const height = typeof window === 'undefined' ? 900 : window.innerHeight

  return {
    x: 0,
    y: 0,
    width,
    height,
    pixelWidth: width,
    pixelHeight: height,
  }
}

const getCanvasViewportSnapshot = (
  canvas: HTMLDivElement,
  zoom: number
): CanvasViewportSnapshot => ({
  x: canvas.scrollLeft / zoom,
  y: canvas.scrollTop / zoom,
  width: canvas.clientWidth / zoom,
  height: canvas.clientHeight / zoom,
  pixelWidth: canvas.clientWidth,
  pixelHeight: canvas.clientHeight,
})

const areCanvasViewportSnapshotsEqual = (
  first: CanvasViewportSnapshot,
  second: CanvasViewportSnapshot
) =>
  first.x === second.x &&
  first.y === second.y &&
  first.width === second.width &&
  first.height === second.height &&
  first.pixelWidth === second.pixelWidth &&
  first.pixelHeight === second.pixelHeight

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

const getAreaLinkLine = (areas: AreaState[], link: AreaLink) => {
  const fromArea = areas.find((area) => area.id === link.fromAreaId)
  const toArea = areas.find((area) => area.id === link.toAreaId)

  if (!fromArea || !toArea) return null

  const fromPosition = getAreaAbsolutePosition(areas, fromArea.id)
  const toPosition = getAreaAbsolutePosition(areas, toArea.id)
  const fromCenter = {
    x: fromPosition.x + fromArea.width / 2,
    y: fromPosition.y + fromArea.height / 2,
  }
  const toCenter = {
    x: toPosition.x + toArea.width / 2,
    y: toPosition.y + toArea.height / 2,
  }
  const fromPoint = getAreaLinkAnchorPoint(
    fromArea,
    fromPosition,
    link.from,
    toCenter
  )
  const toPoint = getAreaLinkAnchorPoint(
    toArea,
    toPosition,
    link.to,
    fromCenter
  )

  return {
    x1: fromPoint.x,
    y1: fromPoint.y,
    x2: toPoint.x,
    y2: toPoint.y,
    labelX: (fromPoint.x + toPoint.x) / 2,
    labelY: (fromPoint.y + toPoint.y) / 2,
  }
}

const getAreaLinkAnchorPoint = (
  area: AreaState,
  position: { x: number; y: number },
  endpoint: AreaLinkEndpoint | undefined,
  toward: { x: number; y: number }
) => {
  if (endpoint?.side) {
    return getAreaEndpointPoint(
      {
        ...position,
        width: area.width,
        height: area.height,
      },
      endpoint
    )
  }

  const anchor = endpoint?.anchor
  const center = {
    x: position.x + area.width / 2,
    y: position.y + area.height / 2,
  }
  const resolvedAnchor =
    !anchor || anchor === 'auto'
      ? Math.abs(toward.x - center.x) >= Math.abs(toward.y - center.y)
        ? toward.x >= center.x
          ? 'right'
          : 'left'
        : toward.y >= center.y
          ? 'bottom'
          : 'top'
      : anchor

  if (resolvedAnchor === 'left') {
    return {
      x: position.x,
      y: center.y,
    }
  }

  if (resolvedAnchor === 'right') {
    return {
      x: position.x + area.width,
      y: center.y,
    }
  }

  if (resolvedAnchor === 'top') {
    return {
      x: center.x,
      y: position.y,
    }
  }

  if (resolvedAnchor === 'bottom') {
    return {
      x: center.x,
      y: position.y + area.height,
    }
  }

  return center
}

const getAreaLinkLabel = (link: AreaLink) =>
  link.label?.trim() ||
  link.schema?.fieldLabel?.trim() ||
  AREA_LINK_KIND_LABELS[link.kind]

const shouldShowAreaLinkLabel = (link: AreaLink, isSelected: boolean) =>
  link.visual?.labelVisibility === 'always' ||
  isSelected ||
  Boolean(link.label?.trim())

const getAreaLinkMarkerUrl = (
  link: AreaLink,
  direction: 'start' | 'end'
) => {
  const linkDirection = link.visual?.direction ?? 'forward'

  if (direction === 'start') {
    return linkDirection === 'backward' || linkDirection === 'both'
      ? 'url(#area-link-arrow)'
      : undefined
  }

  return linkDirection === 'forward' || linkDirection === 'both'
    ? 'url(#area-link-arrow)'
    : undefined
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

function App({
  giphyApiKey,
  pageId,
  serverAccessMode,
}: {
  giphyApiKey?: string
  pageId?: string
  serverAccessMode?: ShareAccessMode
}) {
  const [initialPageState] = useState(() => getInitialPageState(pageId))
  const [areas, setAreas] = useState<AreaState[]>(
    initialPageState.areas
  )
  const [assets, setAssets] = useState<AssetState[]>(
    initialPageState.assets
  )
  const [links, setLinks] = useState<AreaLink[]>(
    initialPageState.links ?? []
  )
  const [page, setPage] = useState(initialPageState.page)
  const [pageHistory, setPageHistory] = useState(
    getInitialPageHistoryState
  )
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
  const [canvasViewport, setCanvasViewport] = useState(
    getInitialCanvasViewportSnapshot
  )
  const [openDialogId, setOpenDialogId] = useState<string | null>(
    null
  )
  const [styleDialogAreaId, setStyleDialogAreaId] = useState<
    string | null
  >(null)
  const [deletedAreaSnapshot, setDeletedAreaSnapshot] =
    useState<DeletedAreaSnapshot | null>(null)
  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>('saved')
  const [importError, setImportError] = useState<string | null>(
    null
  )
  const [agentProposal, setAgentProposal] =
    useState<AgentPatch | null>(null)
  const [agentProposalError, setAgentProposalError] = useState<
    string | null
  >(null)
  const [agentAuditRecords, setAgentAuditRecords] = useState<
    AgentActionRecord[]
  >([])
  const [mcpAgentActivity, setMcpAgentActivity] = useState<{
    label: string | null
    pageId: string
  } | null>(null)
  const [, setHasClickedCanvas] = useState(false)
  const [themeColorName, setThemeColorName] = useState('')
  const [themeColorToken, setThemeColorToken] = useState('')
  const [themeColorValue, setThemeColorValue] =
    useState('#2563eb')
  const [linkTargetAreaId, setLinkTargetAreaId] = useState('')
  const [linkKind, setLinkKind] =
    useState<AreaLinkKind>('relates-to')
  const [linkLabel, setLinkLabel] = useState('')
  const [linkVisualMode, setLinkVisualMode] =
    useState<AreaLinkVisualMode>('simple')
  const [linkDirection, setLinkDirection] =
    useState<AreaLinkDirection>('forward')
  const [linkRoute, setLinkRoute] =
    useState<AreaLinkRoute>('auto')
  const [linkLabelVisibility, setLinkLabelVisibility] =
    useState<AreaLinkLabelVisibility>('auto')
  const [linkFromCardinality, setLinkFromCardinality] =
    useState<AreaLinkCardinality>('one')
  const [linkToCardinality, setLinkToCardinality] =
    useState<AreaLinkCardinality>('many')
  const [linkOptionality, setLinkOptionality] =
    useState<AreaLinkOptionality>('required')
  const [linkFieldLabel, setLinkFieldLabel] = useState('')
  const [selectedLinkId, setSelectedLinkId] = useState<
    string | null
  >(null)
  const [linkFlyoutLinkId, setLinkFlyoutLinkId] = useState<
    string | null
  >(null)
  const [nestTargetAreaId, setNestTargetAreaId] = useState('')
  const [nestingPreview, setNestingPreview] =
    useState<NestingPreviewState>({
      draggedAreaId: null,
      candidateParentId: null,
      unnestingFromParentId: null,
    })
  const [linkDrag, setLinkDragState] = useState<LinkDragState | null>(
    null
  )
  const [, setEndpointDragState] =
    useState<LinkEndpointDragState | null>(null)
  const [activeGifCommand, setActiveGifCommand] =
    useState<ActiveGifCommand | null>(null)
  const [gifSearchState, setGifSearchState] =
    useState<GifSearchState>({
      status: 'idle',
      results: [],
      selectedIndex: 0,
    })
  const [copiedShareMode, setCopiedShareMode] =
    useState<ShareAccessMode | null>(null)
  const nextAreaId = useRef(0)
  const nextAssetId = useRef(0)
  const nextThemeColorId = useRef(0)
  const nextAreaLinkId = useRef(0)
  const nextEvidenceId = useRef(0)
  const linkDragRef = useRef<LinkDragState | null>(null)
  const endpointDragRef = useRef<LinkEndpointDragState | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const canvasZoomRef = useRef(canvasZoom)
  const wheelZoomDeltaRef = useRef(0)
  const wheelZoomAnchorRef = useRef<{
    clientX: number
    clientY: number
  } | null>(null)
  const wheelZoomFrameRef = useRef<number | null>(null)
  const canvasViewportFrameRef = useRef<number | null>(null)
  const collaborationChannelRef = useRef<BroadcastChannel | null>(
    null
  )
  const collaborationProfileRef = useRef(collaborationProfile)

  const setLinkDrag = (nextState: LinkDragState | null) => {
    linkDragRef.current = nextState
    setLinkDragState(nextState)
  }

  const setEndpointDrag = (
    nextState: LinkEndpointDragState | null
  ) => {
    endpointDragRef.current = nextState
    setEndpointDragState(nextState)
  }
  const selectedAreaIdRef = useRef<string | null>(null)
  const latestPageStateRef = useRef<PageAppState>({
    areas: initialPageState.areas,
    assets: initialPageState.assets,
    links: initialPageState.links ?? [],
    page: initialPageState.page,
  })
  const latestCursorRef = useRef<PresenceState['cursor']>(null)
  const isApplyingRemoteState = useRef(false)
  const hasMountedForSave = useRef(false)
  const hasMountedForCollaborationSync = useRef(false)
  const pendingImageInsert = useRef<PendingImageInsert | null>(null)
  const gifSearchProvider = useMemo(
    () =>
      createGiphySearchProvider({
        apiKey: giphyApiKey?.trim() ? giphyApiKey : readGiphyApiKey(),
      }),
    [giphyApiKey]
  )
  const shareAccessMode =
    serverAccessMode ??
    getShareAccessMode(
      typeof window === 'undefined' ? '' : window.location.search,
      page.settings.shareLinks
    )
  const isViewOnly = shareAccessMode === 'view'
  const shouldShowEditorChrome = !isViewOnly
  const shouldShowEmptyState =
    shouldShowEditorChrome && areas.length === 0
  const shouldEnableCanvasZoom = shouldShowEditorChrome && !shouldShowEmptyState
  const isServerCollaborationEnabled = Boolean(pageId)
  const collaborativePageState = useMemo(
    () => ({
      areas,
      assets,
      links,
      page,
    }),
    [areas, assets, links, page]
  )
  const handleRemoteCollaborativeState = useCallback(
    (nextState: PageAppState) => {
      isApplyingRemoteState.current = true
      setPage(nextState.page)
      setAreas(nextState.areas)
      setAssets(nextState.assets)
      setLinks(nextState.links ?? [])
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
  const mcpAgentActivityLabel =
    page.settings.mcp.enabled && mcpAgentActivity?.pageId === page.id
      ? mcpAgentActivity.label
      : null
  const recentHistoryEvents = useMemo(
    () => getRecentPageHistoryEvents(pageHistory, page.id),
    [page.id, pageHistory]
  )
  const styleDialogArea = styleDialogAreaId
    ? areas.find((area) => area.id === styleDialogAreaId) ?? null
    : null

  useEffect(() => {
    if (!isViewOnly) return

    const cleanupFrame = requestAnimationFrame(() => {
      setSelectedAreaId(null)
      setCommandPaletteQuery(null)
      setOpenDialogId(null)
      setStyleDialogAreaId(null)
      setLinkFlyoutLinkId(null)
    })

    return () => cancelAnimationFrame(cleanupFrame)
  }, [isViewOnly])

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

  useEffect(() => {
    canvasZoomRef.current = canvasZoom
  }, [canvasZoom])

  const updateCanvasViewport = useCallback(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const nextViewport = getCanvasViewportSnapshot(
      canvas,
      canvasZoomRef.current
    )

    setCanvasViewport((currentViewport) =>
      areCanvasViewportSnapshotsEqual(currentViewport, nextViewport)
        ? currentViewport
        : nextViewport
    )
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const scheduleViewportUpdate = () => {
      if (canvasViewportFrameRef.current !== null) return

      canvasViewportFrameRef.current = requestAnimationFrame(() => {
        canvasViewportFrameRef.current = null
        updateCanvasViewport()
      })
    }
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(scheduleViewportUpdate)

    scheduleViewportUpdate()
    canvas.addEventListener('scroll', scheduleViewportUpdate, {
      passive: true,
    })
    window.addEventListener('resize', scheduleViewportUpdate)
    resizeObserver?.observe(canvas)

    return () => {
      canvas.removeEventListener('scroll', scheduleViewportUpdate)
      window.removeEventListener('resize', scheduleViewportUpdate)
      resizeObserver?.disconnect()

      if (canvasViewportFrameRef.current !== null) {
        cancelAnimationFrame(canvasViewportFrameRef.current)
        canvasViewportFrameRef.current = null
      }
    }
  }, [canvasZoom, updateCanvasViewport])

  const setCanvasZoomFromAnchor = useCallback(
    (
      nextZoomValue: number,
      anchor = getCanvasCenterAnchor()
    ) => {
      const canvas = canvasRef.current
      const nextZoom = clampCanvasZoom(nextZoomValue)

      if (!canvas) {
        canvasZoomRef.current = nextZoom
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
          zoom: canvasZoomRef.current,
        },
        nextZoom,
      })

      canvasZoomRef.current = nextZoom
      setCanvasZoom(nextZoom)

      requestAnimationFrame(() => {
        canvas.scrollLeft = Math.max(0, scroll.scrollLeft)
        canvas.scrollTop = Math.max(0, scroll.scrollTop)
      })
    },
    [getCanvasCenterAnchor]
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

  const zoomCanvasContinuously = useCallback(
    (
      deltaY: number,
      anchor = getCanvasCenterAnchor()
    ) => {
      wheelZoomDeltaRef.current += deltaY
      wheelZoomAnchorRef.current = anchor

      if (wheelZoomFrameRef.current !== null) return

      wheelZoomFrameRef.current = requestAnimationFrame(() => {
        wheelZoomFrameRef.current = null

        const nextDeltaY = wheelZoomDeltaRef.current
        const nextAnchor =
          wheelZoomAnchorRef.current ?? getCanvasCenterAnchor()

        wheelZoomDeltaRef.current = 0
        wheelZoomAnchorRef.current = null

        setCanvasZoomFromAnchor(
          getContinuousCanvasZoom(
            canvasZoomRef.current,
            nextDeltaY
          ),
          nextAnchor
        )
      })
    },
    [getCanvasCenterAnchor, setCanvasZoomFromAnchor]
  )

  useEffect(
    () => () => {
      if (wheelZoomFrameRef.current === null) return

      cancelAnimationFrame(wheelZoomFrameRef.current)
      wheelZoomFrameRef.current = null
    },
    []
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

  const panToOffscreenIndicator = useCallback(
    (indicator: OffscreenIndicator) => {
      const canvas = canvasRef.current

      if (!canvas) return

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const nextScrollLeft = Math.max(
        0,
        indicator.targetBounds.x * canvasZoom +
          (indicator.targetBounds.width * canvasZoom) / 2 -
          canvas.clientWidth / 2
      )
      const nextScrollTop = Math.max(
        0,
        indicator.targetBounds.y * canvasZoom +
          (indicator.targetBounds.height * canvasZoom) / 2 -
          canvas.clientHeight / 2
      )

      canvas.scrollTo({
        left: nextScrollLeft,
        top: nextScrollTop,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
    },
    [canvasZoom]
  )

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
      links,
      page,
    }
  }, [areas, assets, links, page])

  useEffect(() => {
    collaborationProfileRef.current = collaborationProfile
  }, [collaborationProfile])

  useEffect(() => {
    selectedAreaIdRef.current = selectedAreaId
  }, [selectedAreaId])

  useEffect(() => {
    if (
      selectedLinkId &&
      !links.some((link) => link.id === selectedLinkId)
    ) {
      const timeout = window.setTimeout(() => {
        setSelectedLinkId(null)
      }, 0)

      return () => window.clearTimeout(timeout)
    }
  }, [links, selectedLinkId])

  useEffect(() => {
    if (
      linkFlyoutLinkId &&
      (openDialogId !== null ||
        !selectedLinkId ||
        linkFlyoutLinkId !== selectedLinkId ||
        !links.some((link) => link.id === linkFlyoutLinkId))
    ) {
      const timeout = window.setTimeout(() => {
        setLinkFlyoutLinkId(null)
      }, 0)

      return () => window.clearTimeout(timeout)
    }
  }, [linkFlyoutLinkId, links, openDialogId, selectedLinkId])

  const handleGifCommandActive = useCallback(
    (areaId: string, command: GifSlashCommand | null) => {
      setActiveGifCommand((current) => {
        if (!command) {
          return current?.areaId === areaId ? null : current
        }

        if (
          current?.areaId === areaId &&
          current.command.raw === command.raw &&
          current.command.start === command.start &&
          current.command.end === command.end &&
          current.command.query === command.query
        ) {
          return current
        }

        return {
          areaId,
          command,
        }
      })
    },
    []
  )

  useEffect(() => {
    if (!activeGifCommand || isViewOnly) {
      const timeout = window.setTimeout(() => {
        setGifSearchState({
          status: 'idle',
          results: [],
          selectedIndex: 0,
        })
      }, 0)

      return () => window.clearTimeout(timeout)
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setGifSearchState((current) => ({
        status: 'loading',
        results: current.results,
        selectedIndex: 0,
      }))

      const request = activeGifCommand.command.query
        ? gifSearchProvider.search(activeGifCommand.command.query, {
            limit: 6,
            rating: 'pg',
            signal: controller.signal,
          })
        : gifSearchProvider.trending({
            limit: 6,
            rating: 'pg',
            signal: controller.signal,
          })

      void request
        .then((results) => {
          if (controller.signal.aborted) return

          setGifSearchState({
            status: results.length > 0 ? 'ready' : 'empty',
            results,
            selectedIndex: 0,
            message:
              results.length > 0
                ? undefined
                : activeGifCommand.command.query
                  ? `No GIFs found for "${activeGifCommand.command.query}".`
                  : 'No trending GIFs found.',
          })

          if (results[0]) {
            void gifSearchProvider.registerEvent?.(results[0], 'view')
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return

          setGifSearchState({
            status:
              error instanceof GifSearchConfigurationError
                ? 'missing-key'
                : 'error',
            results: [],
            selectedIndex: 0,
            message:
              error instanceof GifSearchConfigurationError
                ? 'GIF search is not configured.'
                : 'GIF search is temporarily unavailable. Try again in a moment.',
          })
        })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [activeGifCommand, gifSearchProvider, isViewOnly])

  useEffect(() => {
    if (!activeGifCommand) return

    const handlePointerDown = (event: PointerEvent) => {
      const target =
        event.target instanceof HTMLElement ? event.target : null

      if (
        target?.closest('.gif-search-flyout') ||
        target?.closest('.area-shell')
      ) {
        return
      }

      setActiveGifCommand(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [activeGifCommand])

  useEffect(() => {
    if (
      !page.settings.mcp.enabled ||
      !pageId ||
      typeof fetch === 'undefined'
    ) {
      return
    }

    let isCancelled = false

    const loadMcpAgentActivity = async () => {
      const activityLabel = await fetchMcpAgentActivityLabel(page.id)

      if (!isCancelled) {
        setMcpAgentActivity({
          label: activityLabel,
          pageId: page.id,
        })
      }
    }

    void loadMcpAgentActivity()

    const activityTimer = window.setInterval(
      loadMcpAgentActivity,
      MCP_AGENT_ACTIVITY_POLL_INTERVAL_MS
    )

    return () => {
      isCancelled = true
      window.clearInterval(activityTimer)
    }
  }, [page.id, page.settings.mcp.enabled, pageId])

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
      setLinks(message.state.links ?? [])
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
          links,
          page,
        },
      } satisfies CollaborationMessage)
    }, 60)

    return () => window.clearTimeout(syncTimer)
  }, [
    areas,
    assets,
    links,
    collaborationProfile.clientId,
    collaborationStatus,
    isServerCollaborationEnabled,
    isViewOnly,
    page,
  ])

  useEffect(() => {
    const canvas = document.getElementById('canvas')

    if (isViewOnly) return
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
  }, [canvasZoom, isViewOnly, publishPresence])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!shouldEnableCanvasZoom) return
    if (!canvas) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          '.command-palette, .command-palette-backdrop, .command-dialog, .command-dialog-backdrop'
        )
      ) {
        return
      }

      event.preventDefault()
      zoomCanvasContinuously(event.deltaY, {
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
  }, [shouldEnableCanvasZoom, zoomCanvasContinuously])

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
          stringifyPageState({ areas, assets, links, page })
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
  }, [areas, assets, links, page])

  useEffect(() => {
    if (typeof localStorage === 'undefined') return

    try {
      localStorage.setItem(
        PAGE_HISTORY_STORAGE_KEY,
        serializePageHistoryState(pageHistory)
      )
    } catch {
      // History persistence is best-effort; page save status is tracked separately.
    }
  }, [pageHistory])

  useEffect(() => {
    const handleClick = (e: PointerEvent) => {
      if (isViewOnly) return

      const target = e.target as HTMLElement

      if (!target.classList.contains('canvas-world')) return

      e.preventDefault()

      if (linkFlyoutLinkId) {
        setLinkFlyoutLinkId(null)
        return
      }

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
      setSelectedLinkId(null)
      setLinkFlyoutLinkId(null)
      setAutoFocusAreaId(id)
    }

    document.addEventListener('pointerdown', handleClick)

    return () => {
      document.removeEventListener('pointerdown', handleClick)
    }
  }, [canvasZoom, isViewOnly, linkFlyoutLinkId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isEditingTarget = isEditableTarget(e.target)
      const isPaletteTarget = isCommandPaletteTarget(e.target)
      const hasSystemModifier = e.metaKey || e.ctrlKey

      if (
        !isViewOnly &&
        e.key === 'Escape' &&
        (linkDragRef.current || endpointDragRef.current)
      ) {
        e.preventDefault()
        setLinkDrag(null)
        if (endpointDragRef.current) {
          setLinks(endpointDragRef.current.originalLinks)
        }
        setEndpointDrag(null)
        return
      }

      if (
        selectedLinkId &&
        !isViewOnly &&
        !isEditingTarget &&
        commandPaletteQuery === null &&
        openDialogId === null &&
        styleDialogArea === null
      ) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setLinkFlyoutLinkId(null)
          setSelectedLinkId(null)
          return
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          setLinks((prev) =>
            prev.filter((link) => link.id !== selectedLinkId)
          )
          setLinkFlyoutLinkId(null)
          setSelectedLinkId(null)
          return
        }

        if (e.key === 'Enter') {
          e.preventDefault()
          setLinkFlyoutLinkId(selectedLinkId)
          return
        }
      }

      if (
        openDialogId === null &&
        commandPaletteQuery === null &&
        !isEditingTarget &&
        !isPaletteTarget &&
        !shouldShowEmptyState
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
        isDialogOpen:
          openDialogId !== null || styleDialogArea !== null,
        isEditableTarget: isEditingTarget,
        isCommandPaletteTarget: isPaletteTarget,
        isReadOnly: isViewOnly,
        hasModifier: e.metaKey || e.ctrlKey || e.altKey,
        hasMetaOrCtrlModifier: hasSystemModifier,
        hasShiftModifier: e.shiftKey,
        hasAltModifier: e.altKey,
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

      setCommandPaletteQuery(
        keyboardAction === 'open-empty-command-palette' ||
          e.key === 'Escape'
          ? ''
          : e.key
      )
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    commandPaletteQuery,
    isViewOnly,
    openDialogId,
    resetCanvasZoom,
    selectedAreaId,
    selectedLinkId,
    shouldShowEmptyState,
    styleDialogArea,
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

  const applyAreaStyle = (
    areaId: string,
    property: string,
    value: string
  ) => {
    if (isViewOnly) return

    const normalizedValue = normalizeStyleValueInput(value)

    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              styles: {
                ...area.styles,
                [property]: normalizedValue,
              },
            }
          : area
      )
    )
  }

  const removeAreaStyle = (areaId: string, property: string) => {
    if (isViewOnly) return

    setAreas((prev) =>
      prev.map((area) => {
        if (area.id !== areaId) return area

        const nextStyles = {
          ...area.styles,
        }

        delete nextStyles[property]

        return {
          ...area,
          styles: nextStyles,
        }
      })
    )
  }

  const updateSelectedAreaMetadata = (
    metadataPatch: Partial<AreaMetadata>
  ) => {
    if (isViewOnly || !selectedAreaId) return

    setAreas((prev) =>
      prev.map((area) =>
        area.id === selectedAreaId
          ? setAreaMetadata(area, metadataPatch)
          : area
      )
    )
  }

  const addEvidenceToSelectedArea = (target: string) => {
    if (isViewOnly || !selectedAreaId) return

    const trimmedTarget = target.trim()
    if (!trimmedTarget) return

    const evidence = createAreaEvidenceReference({
      id: createEvidenceId(nextEvidenceId.current),
      target: trimmedTarget,
    })

    nextEvidenceId.current += 1

    setAreas((prev) =>
      prev.map((area) =>
        area.id === selectedAreaId
          ? addAreaEvidenceReference(area, evidence)
          : area
      )
    )
    setImportError(null)
  }

  const requestEvidenceForSelectedArea = () => {
    if (isViewOnly || !selectedAreaId) return

    const target = window.prompt('Evidence reference')
    if (target === null) return

    addEvidenceToSelectedArea(target)
  }

  const commitAreaEvidenceCommand = (
    id: string,
    command: EvidenceSlashCommand
  ) => {
    if (isViewOnly) return

    const evidence = createAreaEvidenceReference({
      id: createEvidenceId(nextEvidenceId.current),
      target: command.target,
    })

    nextEvidenceId.current += 1

    setAreas((prev) =>
      prev.map((area) => {
        if (area.id !== id || area.type === 'image') return area

        const result = removeAreaEvidenceSlashCommand(
          area.text,
          command
        )

        return addAreaEvidenceReference(
          {
            ...area,
            text: result.text,
          },
          evidence
        )
      })
    )
  }

  const removeEvidenceFromArea = (
    areaId: string,
    evidenceId: string
  ) => {
    if (isViewOnly) return

    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? removeAreaEvidenceReference(area, evidenceId)
          : area
      )
    )
  }

  const getCreateLinkVisual = (): AreaLinkVisual => ({
    mode: linkVisualMode,
    direction: linkDirection,
    route: linkRoute,
    labelVisibility: linkLabelVisibility,
  })

  const getCreateLinkSchema = (): AreaLinkSchema | undefined =>
    linkVisualMode === 'schema'
      ? {
          fromCardinality: linkFromCardinality,
          toCardinality: linkToCardinality,
          optionality: linkOptionality,
          ...(linkFieldLabel.trim()
            ? { fieldLabel: linkFieldLabel.trim() }
            : {}),
        }
      : undefined

  const getAreaEndpointAtCanvasPoint = (
    point: Point,
    {
      ignoreAreaId,
      snap = true,
    }: {
      ignoreAreaId?: string
      snap?: boolean
    } = {}
  ) => {
    for (let index = areas.length - 1; index >= 0; index -= 1) {
      const area = areas[index]

      if (!area || area.id === ignoreAreaId) continue

      const rect = getAreaAbsoluteRect(areas, area.id)
      const hit = getAreaBorderHit(rect, point, 12)

      if (!hit) continue

      const endpoint = snap
        ? snapLinkEndpointToExisting({
            area: rect,
            areaId: area.id,
            links,
            maxDistance: 12,
            side: hit.side,
            position: hit.position,
          })
        : {
            areaId: area.id,
            side: hit.side,
            position: hit.position,
            behavior: 'fixed' as const,
          }

      return {
        areaId: area.id,
        endpoint,
      }
    }

    return null
  }

  const getSourceEndpoint = (
    areaId: string,
    side: AreaLinkSide,
    position: number
  ): AreaLinkEndpoint => {
    const rect = getAreaAbsoluteRect(areas, areaId)

    return snapLinkEndpointToExisting({
      area: rect,
      areaId,
      links,
      maxDistance: 12,
      side,
      position,
    })
  }

  const getEndpointCanvasPoint = (
    endpoint: AreaLinkEndpoint
  ): Point | null => {
    if (!endpoint.side) return null

    const area = areas.find(
      (currentArea) => currentArea.id === endpoint.areaId
    )

    if (!area) return null

    return getAreaEndpointPoint(
      getAreaAbsoluteRect(areas, endpoint.areaId),
      endpoint
    )
  }

  const getLinkDragLine = (drag: LinkDragState) => {
    const sourcePoint = getEndpointCanvasPoint(drag.sourceEndpoint)

    if (!sourcePoint) return null

    const targetPoint = drag.targetEndpoint
      ? getEndpointCanvasPoint(drag.targetEndpoint)
      : drag.pointer

    if (!targetPoint) return null

    return {
      x1: sourcePoint.x,
      y1: sourcePoint.y,
      x2: targetPoint.x,
      y2: targetPoint.y,
    }
  }

  const beginAreaLinkDrag = (
    areaId: string,
    side: AreaLinkSide,
    position: number,
    clientX: number,
    clientY: number
  ) => {
    if (isViewOnly) return

    const pointer = getCanvasPoint(clientX, clientY, canvasZoom)

    setSelectedAreaId(areaId)
    setSelectedLinkId(null)
    setLinkFlyoutLinkId(null)
    setOpenDialogId(null)
    setLinkDrag({
      sourceAreaId: areaId,
      sourceEndpoint: getSourceEndpoint(areaId, side, position),
      pointer,
      targetAreaId: null,
      targetEndpoint: null,
    })
  }

  const updateAreaLinkDrag = (clientX: number, clientY: number) => {
    const currentDrag = linkDragRef.current

    if (!currentDrag || isViewOnly) return

    const pointer = getCanvasPoint(clientX, clientY, canvasZoom)
    const target = getAreaEndpointAtCanvasPoint(pointer, {
      ignoreAreaId: currentDrag.sourceAreaId,
    })

    setLinkDrag({
      ...currentDrag,
      pointer,
      targetAreaId: target?.areaId ?? null,
      targetEndpoint: target?.endpoint ?? null,
    })
  }

  const finishAreaLinkDrag = (clientX: number, clientY: number) => {
    updateAreaLinkDrag(clientX, clientY)

    const currentDrag = linkDragRef.current

    if (
      !currentDrag ||
      !currentDrag.targetAreaId ||
      !currentDrag.targetEndpoint ||
      currentDrag.targetAreaId === currentDrag.sourceAreaId ||
      isViewOnly
    ) {
      setLinkDrag(null)
      return
    }

    const link = createAreaLink({
      id: createAreaLinkId(nextAreaLinkId.current),
      fromAreaId: currentDrag.sourceAreaId,
      toAreaId: currentDrag.targetAreaId,
      kind: 'relates-to',
      from: currentDrag.sourceEndpoint,
      to: currentDrag.targetEndpoint,
      visual: {
        mode: 'simple',
        direction: 'forward',
        route: 'straight',
        labelVisibility: 'auto',
      },
    })

    nextAreaLinkId.current += 1
    setLinks((prev) => [...prev, link])
    setSelectedAreaId(null)
    setSelectedLinkId(link.id)
    setLinkFlyoutLinkId(null)
    setLinkDrag(null)
  }

  const cancelAreaLinkDrag = () => {
    setLinkDrag(null)
  }

  const getFixedEndpointFromRenderedPoint = (
    link: AreaLink,
    endpointName: LinkEndpointName,
    point: Point
  ): AreaLinkEndpoint => {
    const endpoint = endpointName === 'from' ? link.from : link.to
    const areaId =
      endpoint?.areaId ??
      (endpointName === 'from' ? link.fromAreaId : link.toAreaId)

    if (endpoint?.side) {
      return {
        ...endpoint,
        areaId,
        position: endpoint.position ?? 0.5,
        behavior: 'fixed',
      }
    }

    const hit = getAreaBorderHit(
      getAreaAbsoluteRect(areas, areaId),
      point,
      6
    )

    return {
      areaId,
      side: hit?.side ?? 'right',
      position: hit?.position ?? 0.5,
      behavior: 'fixed',
    }
  }

  const beginAreaLinkEndpointDrag = (
    link: AreaLink,
    endpointName: LinkEndpointName,
    point: Point
  ) => {
    if (isViewOnly) return

    const fixedEndpoint = getFixedEndpointFromRenderedPoint(
      link,
      endpointName,
      point
    )

    setSelectedAreaId(null)
    setSelectedLinkId(link.id)
    setLinkFlyoutLinkId(null)
    setEndpointDrag({
      linkId: link.id,
      endpointName,
      originalLinks: links,
      originalEndpoint: fixedEndpoint,
      currentEndpoint: fixedEndpoint,
      targetEndpoint: null,
    })
  }

  const updateAreaLinkEndpointDrag = (
    clientX: number,
    clientY: number,
    splitEndpoint = false
  ) => {
    const currentDrag = endpointDragRef.current

    if (!currentDrag || isViewOnly) return

    const pointer = getCanvasPoint(clientX, clientY, canvasZoom)
    const target = getAreaEndpointAtCanvasPoint(pointer, {
      snap: !splitEndpoint,
    })

    if (!target) {
      setLinks(currentDrag.originalLinks)
      setEndpointDrag({
        ...currentDrag,
        currentEndpoint: currentDrag.originalEndpoint,
        targetEndpoint: null,
      })
      return
    }

    const nextEndpoint = target.endpoint

    setLinks((prev) =>
      splitEndpoint
        ? prev.map((link) =>
            link.id === currentDrag.linkId
              ? normalizeAreaLink({
                  ...link,
                  [currentDrag.endpointName]: nextEndpoint,
                  updatedAt: new Date().toISOString(),
                })
              : link
          )
        : moveSharedLinkEndpoint(prev, {
            from: currentDrag.currentEndpoint,
            to: nextEndpoint,
          }).map((link) =>
            link.id === currentDrag.linkId
              ? normalizeAreaLink({
                  ...link,
                  updatedAt: new Date().toISOString(),
                })
              : link
          )
    )
    setEndpointDrag({
      ...currentDrag,
      currentEndpoint: nextEndpoint,
      targetEndpoint: nextEndpoint,
    })
  }

  const finishAreaLinkEndpointDrag = () => {
    const currentDrag = endpointDragRef.current

    if (currentDrag && !currentDrag.targetEndpoint) {
      setLinks(currentDrag.originalLinks)
    }

    setEndpointDrag(null)
  }

  const cancelAreaLinkEndpointDrag = () => {
    const currentDrag = endpointDragRef.current

    if (currentDrag) {
      setLinks(currentDrag.originalLinks)
    }

    setEndpointDrag(null)
  }

  const openLinkDialogForArea = (areaId: string) => {
    if (isViewOnly) return

    setSelectedAreaId(areaId)
    setSelectedLinkId(null)
    setLinkFlyoutLinkId(null)
    setLinkTargetAreaId(
      areas.find((area) => area.id !== areaId)?.id ?? ''
    )
    setOpenDialogId('link-selected-area')
  }

  const createSelectedAreaLink = () => {
    if (isViewOnly || !selectedAreaId) return

    if (!linkTargetAreaId || linkTargetAreaId === selectedAreaId) {
      setImportError('Choose another Area to link to.')
      return
    }

    const link = createAreaLink({
      id: createAreaLinkId(nextAreaLinkId.current),
      fromAreaId: selectedAreaId,
      toAreaId: linkTargetAreaId,
      kind: linkKind,
      label: linkLabel,
      from: {
        areaId: selectedAreaId,
        anchor: 'auto',
      },
      to: {
        areaId: linkTargetAreaId,
        anchor: 'auto',
      },
      visual: getCreateLinkVisual(),
      schema: getCreateLinkSchema(),
    })

    nextAreaLinkId.current += 1
    setLinks((prev) => [...prev, link])
    setSelectedLinkId(link.id)
    setLinkFlyoutLinkId(null)
    setLinkLabel('')
    setLinkFieldLabel('')
    setImportError(null)
    setOpenDialogId(null)
  }

  const updateSelectedAreaLink = (
    patch: Partial<Omit<AreaLink, 'id' | 'createdAt'>>
  ) => {
    if (isViewOnly || !selectedLinkId) return

    const now = new Date().toISOString()

    setLinks((prev) =>
      prev.map((link) =>
        link.id === selectedLinkId
          ? normalizeAreaLink({
              ...link,
              ...patch,
              updatedAt: now,
            })
          : link
      )
    )
  }

  const updateSelectedAreaLinkVisual = (
    visualPatch: Partial<AreaLinkVisual>
  ) => {
    const selectedLink = links.find(
      (link) => link.id === selectedLinkId
    )

    if (!selectedLink) return

    updateSelectedAreaLink({
      visual: {
        mode: selectedLink.visual?.mode ?? 'semantic',
        direction: selectedLink.visual?.direction ?? 'forward',
        route: selectedLink.visual?.route ?? 'auto',
        labelVisibility:
          selectedLink.visual?.labelVisibility ?? 'auto',
        ...visualPatch,
      },
    })
  }

  const updateSelectedAreaLinkSchema = (
    schemaPatch: Partial<AreaLinkSchema>
  ) => {
    const selectedLink = links.find(
      (link) => link.id === selectedLinkId
    )

    if (!selectedLink) return

    updateSelectedAreaLink({
      schema: {
        fromCardinality:
          selectedLink.schema?.fromCardinality ?? 'one',
        toCardinality: selectedLink.schema?.toCardinality ?? 'many',
        optionality: selectedLink.schema?.optionality ?? 'required',
        ...selectedLink.schema,
        ...schemaPatch,
      },
    })
  }

  const deleteSelectedAreaLink = () => {
    if (isViewOnly || !selectedLinkId) return

    setLinks((prev) =>
      prev.filter((link) => link.id !== selectedLinkId)
    )
    setLinkFlyoutLinkId(null)
    setSelectedLinkId(null)
    setOpenDialogId(null)
  }

  const requestServerShareLink = async (
    accessMode: ShareAccessMode
  ) => {
    const response = await fetch(
      `/api/pages/${page.id}/share-links`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessMode,
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Share link could not be created.')
    }

    const payload = (await response.json()) as {
      accessMode?: unknown
      url?: unknown
    }

    if (
      payload.accessMode !== accessMode ||
      typeof payload.url !== 'string'
    ) {
      throw new Error('Share link response was invalid.')
    }

    const url = new URL(payload.url)
    const token = url.searchParams.get('token')

    if (!token) {
      throw new Error('Share link response was missing a token.')
    }

    return {
      accessMode,
      token,
    }
  }

  const updateShareLinkToken = (
    accessMode: ShareAccessMode,
    token: string
  ) => {
    const now = new Date().toISOString()

    setPage((currentPage) => {
      const currentLinks = currentPage.settings.shareLinks ?? {
        pageId: currentPage.id,
        editToken: '',
        viewToken: '',
        createdAt: now,
        updatedAt: now,
        revokedAt: null,
      }

      return {
        ...currentPage,
        settings: {
          ...currentPage.settings,
          shareLinks: {
            ...currentLinks,
            editToken:
              accessMode === 'edit'
                ? token
                : currentLinks.editToken,
            viewToken:
              accessMode === 'view'
                ? token
                : currentLinks.viewToken,
            updatedAt: now,
          },
        },
      }
    })
  }

  const ensureShareLinks = async () => {
    if (isViewOnly) return

    if (pageId) {
      if (
        page.settings.shareLinks?.editToken &&
        page.settings.shareLinks.viewToken
      ) {
        return
      }

      try {
        const editLink = await requestServerShareLink('edit')
        updateShareLinkToken(editLink.accessMode, editLink.token)

        const viewLink = await requestServerShareLink('view')
        updateShareLinkToken(viewLink.accessMode, viewLink.token)
        setImportError(null)
      } catch {
        setImportError('Share links could not be created.')
      }
      return
    }

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
        links,
        page,
      },
      LOCAL_AGENT_CLIENT
    )

    setAgentProposal(proposal)
    setAgentProposalError(null)
    setOpenDialogId('agent-suggestions')
  }

  const applyAgentProposal = () => {
    if (isViewOnly || !agentProposal) return

    const result = applyAgentPatch(
      {
        areas,
        assets,
        links,
        page,
      },
      agentProposal,
      LOCAL_AGENT_CLIENT,
      {
        cssSupports: supportsAgentCssDeclaration,
      }
    )

    if (!result.ok) {
      setAgentProposalError(result.errors.join(' '))
      return
    }

    setAreas(result.state.areas)
    setAssets(result.state.assets)
    setLinks(result.state.links ?? [])
    setPage(result.state.page)
    setAgentAuditRecords((currentRecords) => [
      result.auditRecord,
      ...currentRecords.slice(0, 9),
    ])
    setPageHistory((currentHistory) =>
      addPageHistoryEntry(
        currentHistory,
        createAgentHistoryEntry(result.auditRecord)
      )
    )
    setAgentProposal(null)
    setAgentProposalError(null)
    setOpenDialogId(null)
    setImportError(null)
  }

  const applyAgentProposalOperation = (operationIndex: number) => {
    if (isViewOnly || !agentProposal) return

    const operationPatch = createAgentPatchForOperation(
      agentProposal,
      operationIndex
    )

    if (!operationPatch) return

    const result = applyAgentPatch(
      {
        areas,
        assets,
        links,
        page,
      },
      operationPatch,
      LOCAL_AGENT_CLIENT,
      {
        cssSupports: supportsAgentCssDeclaration,
      }
    )

    if (!result.ok) {
      setAgentProposalError(result.errors.join(' '))
      return
    }

    const nextProposal = removeAgentPatchOperation(
      agentProposal,
      operationIndex
    )

    setAreas(result.state.areas)
    setAssets(result.state.assets)
    setLinks(result.state.links ?? [])
    setPage(result.state.page)
    setAgentAuditRecords((currentRecords) => [
      result.auditRecord,
      ...currentRecords.slice(0, 9),
    ])
    setPageHistory((currentHistory) =>
      addPageHistoryEntry(
        currentHistory,
        createAgentHistoryEntry(result.auditRecord)
      )
    )
    setAgentProposal(nextProposal)
    setAgentProposalError(null)
    setOpenDialogId(nextProposal ? 'agent-suggestions' : null)
    setImportError(null)
  }

  const rejectAgentProposal = () => {
    setAgentProposal(null)
    setAgentProposalError(null)
    setOpenDialogId(null)
  }

  const rejectAgentProposalOperation = (operationIndex: number) => {
    if (!agentProposal) return

    const nextProposal = removeAgentPatchOperation(
      agentProposal,
      operationIndex
    )

    setAgentProposal(nextProposal)
    setAgentProposalError(null)
    setOpenDialogId(nextProposal ? 'agent-suggestions' : null)
  }

  const regenerateShareUrl = async (accessMode: ShareAccessMode) => {
    if (isViewOnly) return

    if (pageId) {
      try {
        const link = await requestServerShareLink(accessMode)
        updateShareLinkToken(link.accessMode, link.token)
        setCopiedShareMode(null)
        setImportError(null)
      } catch {
        setImportError('Share link could not be regenerated.')
      }
      return
    }

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

    setAreas((prev) => {
      const nextAreas = moveAreaWithSnapGrid(prev, id, x, y, {
        snapGridSize: getActiveSnapGridSize(
          page.settings.snapGrid,
          bypassSnapGrid
        ),
      })

      setNestingPreview({
        draggedAreaId: id,
        candidateParentId: getCandidateParentId(nextAreas, id),
        unnestingFromParentId: getUnnestingSourceId(nextAreas, id),
      })

      return nextAreas
    })
  }

  const beginAreaMove = (id: string) => {
    if (isViewOnly) return

    setNestingPreview({
      draggedAreaId: id,
      candidateParentId: null,
      unnestingFromParentId: null,
    })
  }

  const endAreaMove = (id: string) => {
    if (isViewOnly) return

    setAreas((prev) => nestAreaIfContained(prev, id))
    setNestingPreview({
      draggedAreaId: null,
      candidateParentId: null,
      unnestingFromParentId: null,
    })
  }

  const unnestSelectedArea = () => {
    if (isViewOnly || !selectedAreaId) return

    setAreas((prev) => reparentArea(prev, selectedAreaId, null))
    setOpenDialogId(null)
  }

  const nestSelectedAreaIntoTarget = () => {
    if (isViewOnly || !selectedAreaId || !nestTargetAreaId) return

    setAreas((prev) =>
      reparentArea(prev, selectedAreaId, nestTargetAreaId)
    )
    setOpenDialogId(null)
  }

  const addChildAreaToSelectedArea = () => {
    if (isViewOnly || !selectedAreaId) return

    const parentArea = areas.find((area) => area.id === selectedAreaId)
    if (!parentArea) return

    const id = createAreaId(nextAreaId.current)
    nextAreaId.current += 1
    const createdAt = new Date().toISOString()

    setAreas((prev) => [
      ...prev,
      {
        id,
        parentId: selectedAreaId,
        x: 16,
        y: 16,
        height: DEFAULT_AREA_HEIGHT,
        width: Math.min(
          DEFAULT_AREA_WIDTH,
          Math.max(120, parentArea.width - 32)
        ),
        text: '',
        styles: {},
        createdAt,
        updatedAt: createdAt,
      },
    ])
    setSelectedAreaId(id)
    setSelectedLinkId(null)
    setAutoFocusAreaId(id)
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
    const deletedAreaIds = new Set([
      areaId,
      ...deletedArea.descendantAreas.map((area) => area.id),
    ])

    setAreas(result.areas)
    setLinks((currentLinks) =>
      removeAreaLinksForDeletedAreas(currentLinks, deletedAreaIds)
    )
    setDeletedAreaSnapshot(deletedArea)
    setSelectedAreaId((currentSelectedAreaId) => {
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
    removeCommand = removeImageSlashCommand,
    source,
    sourceAreaId,
    src,
    width,
    x,
    y,
    replaceAreaId,
  }: {
    alt: string
    command?: RemovableSlashCommand
    height: number
    mimeType: string
    removeCommand?: RemoveSlashCommand
    source?: GifAssetSource
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
      ...(source ? { source } : {}),
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

            const result = removeCommand(area.text, command)

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
    setSelectedLinkId(null)
    setAutoFocusAreaId(areaId)
  }

  const insertGifResult = (result: GifSearchResult) => {
    if (isViewOnly || !activeGifCommand) return

    const sourceArea = areas.find(
      (area) => area.id === activeGifCommand.areaId
    )
    const fallbackPoint = getViewportCenterPoint(canvasZoom)
    const sourceAreaUsesOnlyCommand =
      sourceArea?.type !== 'image' &&
      sourceArea?.text.trim() === activeGifCommand.command.raw.trim()

    insertImageAsset({
      alt: result.title,
      command: activeGifCommand.command,
      height: result.height,
      mimeType: 'image/gif',
      removeCommand: removeGifSlashCommand,
      source: toGifAssetSource(result),
      sourceAreaId: activeGifCommand.areaId,
      src: result.animatedUrl,
      width: result.width,
      x: sourceArea ? sourceArea.x : fallbackPoint.x,
      y: sourceArea
        ? sourceAreaUsesOnlyCommand
          ? sourceArea.y
          : sourceArea.y + sourceArea.height + 16
        : fallbackPoint.y,
    })
    void gifSearchProvider.registerEvent?.(result, 'send')
    setActiveGifCommand(null)
    setGifSearchState({
      status: 'idle',
      results: [],
      selectedIndex: 0,
    })
  }

  const moveGifSelection = (delta: number) => {
    setGifSearchState((current) => {
      if (current.results.length === 0) return current

      const nextIndex =
        (current.selectedIndex + delta + current.results.length) %
        current.results.length

      return {
        ...current,
        selectedIndex: nextIndex,
      }
    })
  }

  useEffect(() => {
    if (!activeGifCommand) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'Escape') {
        event.preventDefault()
        setActiveGifCommand(null)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveGifSelection(1)
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveGifSelection(-1)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveGifSelection(3)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveGifSelection(-3)
        return
      }

      if (event.key === 'Enter') {
        const result =
          gifSearchState.results[gifSearchState.selectedIndex]

        if (!result) return

        event.preventDefault()
        insertGifResult(result)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeGifCommand, gifSearchState])

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

    const validationError =
      getImageFileValidationError(file) ??
      (await getImageFileContentValidationError(file))

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

  const getPageExportSlug = () =>
    page.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled-page'

  const downloadPageFile = ({
    contents,
    extension,
    mimeType,
  }: {
    contents: string
    extension: string
    mimeType: string
  }) => {
    const blob = new Blob([contents], {
      type: mimeType,
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `${getPageExportSlug()}.${extension}`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getCurrentPageAppState = (): PageAppState => ({
    areas,
    assets,
    links,
    page,
  })

  const exportPageJson = () => {
    downloadPageFile({
      contents: stringifyExportedPageState(getCurrentPageAppState()),
      extension: 'json',
      mimeType: 'application/json',
    })
  }

  const exportPageMarkdown = () => {
    downloadPageFile({
      contents: exportPageAsMarkdown(getCurrentPageAppState()),
      extension: 'md',
      mimeType: MARKDOWN_MIME_TYPE,
    })
  }

  const exportPageJsonCanvas = () => {
    downloadPageFile({
      contents: stringifyPageAsJsonCanvas(getCurrentPageAppState()),
      extension: 'canvas',
      mimeType: JSON_CANVAS_MIME_TYPE,
    })
  }

  const exportAgentHandoffBrief = () => {
    downloadPageFile({
      contents: createAgentHandoffBrief(getCurrentPageAppState()).markdown,
      extension: 'handoff.md',
      mimeType: MARKDOWN_MIME_TYPE,
    })
  }

  const copyAgentHandoffBrief = async () => {
    try {
      await navigator.clipboard.writeText(
        createAgentHandoffBrief(getCurrentPageAppState()).markdown
      )
      setImportError(null)
    } catch {
      setImportError('Handoff brief could not be copied.')
    }
  }

  const insertContextKitById = (kitId: string) => {
    if (isViewOnly) return

    const kit = getContextKitById(kitId)
    if (!kit) return

    const areaIdStart = nextAreaId.current
    const linkIdStart = nextAreaLinkId.current
    const shouldCenterKit = areas.length > 0
    const center = shouldCenterKit
      ? getViewportCenterPoint(canvasZoom)
      : { x: 0, y: 0 }
    const nextState = insertContextKit(
      {
        areas,
        assets,
        links,
        page,
      },
      kit,
      {
        createAreaId: (index) => createAreaId(areaIdStart + index),
        createLinkId: (index) => createAreaLinkId(linkIdStart + index),
        offsetX: shouldCenterKit ? center.x - 260 : 0,
        offsetY: shouldCenterKit ? center.y - 160 : 0,
      }
    )

    nextAreaId.current += kit.areas.length
    nextAreaLinkId.current += kit.links?.length ?? 0
    setAreas(nextState.areas)
    setAssets(nextState.assets)
    setLinks(nextState.links ?? [])
    setSelectedAreaId(nextState.selectedAreaId)
    setAutoFocusAreaId(nextState.selectedAreaId)
    setHasClickedCanvas(true)
    setOpenDialogId(null)
    setImportError(null)
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

    setPageHistory((currentHistory) =>
      addPageHistoryEntry(
        currentHistory,
        createImportHistoryEntry({
          actor: LOCAL_HISTORY_ACTOR,
          beforeState: {
            areas,
            assets,
            links,
            page,
          },
          importedAreaCount: result.state.areas.length,
          pageId: result.state.page.id,
        })
      )
    )
    setPage(result.state.page)
    setAreas(result.state.areas)
    setAssets(result.state.assets)
    setLinks(result.state.links ?? [])
    setSelectedAreaId(null)
    setImportError(null)
  }

  const undoHistoryEvent = (event: PageChangeEvent) => {
    if (isViewOnly || !event.undoPatchId) return

    const patch = getPageHistoryPatch(pageHistory, event.undoPatchId)

    if (!patch) return

    if (patch.kind === 'restore-page-state') {
      const restoredState = applyRestorePageStatePatch(
        {
          areas,
          assets,
          links,
          page,
        },
        patch
      )

      setPage(restoredState.page)
      setAreas(restoredState.areas)
      setAssets(restoredState.assets)
      setLinks(restoredState.links ?? [])
      setSelectedAreaId(null)
      setOpenDialogId(null)
      setImportError(null)
      return
    }

    const result = applyAgentPatch(
      {
        areas,
        assets,
        links,
        page,
      },
      patch.patch,
      LOCAL_AGENT_CLIENT,
      {
        cssSupports: supportsAgentCssDeclaration,
      }
    )

    if (!result.ok) {
      setImportError(result.errors.join(' '))
      return
    }

    setPage(result.state.page)
    setAreas(result.state.areas)
    setAssets(result.state.assets)
    setLinks(result.state.links ?? [])
    setAgentAuditRecords((currentRecords) => [
      result.auditRecord,
      ...currentRecords.slice(0, 9),
    ])
    setOpenDialogId(null)
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
    shouldShowEditorChrome &&
    page.settings.theme.colors.length > 0 &&
    (openDialogId === 'page-styles' || selectedAreaId !== null)
  const commandPaletteOptions = shouldShowEditorChrome
    ? shouldShowEmptyState
      ? COMMAND_PALETTE_OPTIONS.filter(
          (option) => !isZoomCommandOption(option)
        )
      : COMMAND_PALETTE_OPTIONS
    : []
  const shouldShowOffscreenAreaIndicators =
    !shouldShowEmptyState &&
    areas.length > 0 &&
    commandPaletteQuery === null &&
    openDialogId === null &&
    styleDialogAreaId === null
  const offscreenAreaIndicators = useMemo(
    () =>
      shouldShowOffscreenAreaIndicators
        ? getOffscreenAreaIndicators({
            areas,
            viewport: {
              x: canvasViewport.x,
              y: canvasViewport.y,
              width: canvasViewport.width,
              height: canvasViewport.height,
            },
            viewportPixelSize: {
              width: canvasViewport.pixelWidth,
              height: canvasViewport.pixelHeight,
            },
            zoom: canvasZoom,
            safeInsets: shouldShowEditorChrome
              ? {
                  top: 88,
                  right: 24,
                  bottom: 84,
                  left: 24,
                }
              : {
                  top: 76,
                  right: 24,
                  bottom: 24,
                  left: 24,
                },
          })
        : [],
    [
      areas,
      canvasViewport,
      canvasZoom,
      shouldShowEditorChrome,
      shouldShowOffscreenAreaIndicators,
    ]
  )
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
  const selectedArea = selectedAreaId
    ? areas.find((area) => area.id === selectedAreaId) ?? null
    : null
  const selectedLink = selectedLinkId
    ? links.find((link) => link.id === selectedLinkId) ?? null
    : null
  const selectedLinkLine = selectedLink
    ? getAreaLinkLine(areas, selectedLink)
    : null
  const linkDragLine = linkDrag ? getLinkDragLine(linkDrag) : null
  const selectedLinkVisual = selectedLink?.visual ?? {
    mode: 'semantic' as const,
    direction: 'forward' as const,
    route: 'auto' as const,
    labelVisibility: 'auto' as const,
  }
  const selectedLinkSchema = selectedLink?.schema ?? {}
  const activeGifArea = activeGifCommand
    ? areas.find((area) => area.id === activeGifCommand.areaId) ?? null
    : null
  const activeGifAreaPosition = activeGifArea
    ? getAreaAbsolutePosition(areas, activeGifArea.id)
    : null
  const gifFlyoutStyle = activeGifAreaPosition
    ? ({
        left: activeGifAreaPosition.x,
        top:
          activeGifAreaPosition.y +
          (activeGifArea?.height ?? DEFAULT_AREA_HEIGHT) +
          10,
      } as CSSProperties)
    : undefined
  const selectedAreaMetadata = selectedArea
    ? getAreaMetadata(selectedArea)
    : null
  const agentHandoffBrief = createAgentHandoffBrief({
    areas,
    assets,
    links,
    page,
  })
  const linkTargetAreas = selectedAreaId
    ? areas.filter((area) => area.id !== selectedAreaId)
    : []
  const nestTargetAreas = selectedAreaId
    ? areas.filter((area) => area.id !== selectedAreaId)
    : []
  const handleBrandClick = () => {
    if (shouldShowEmptyState) {
      setCommandPaletteQuery('')
      return
    }

    setOpenDialogId('leave-canvas')
  }
  const leaveCanvasForStart = () => {
    setOpenDialogId(null)
    setCommandPaletteQuery(null)
    setSelectedAreaId(null)
    setSelectedLinkId(null)
    setLinkFlyoutLinkId(null)
    setStyleDialogAreaId(null)
    setHasClickedCanvas(false)

    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/')
      window.location.assign('/')
    }
  }
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
        isDragging={area.id === nestingPreview.draggedAreaId}
        isNestingTarget={area.id === nestingPreview.candidateParentId}
        isUnnestingSource={
          area.id === nestingPreview.unnestingFromParentId
        }
        isLinkTarget={area.id === linkDrag?.targetAreaId}
        isReadOnly={isViewOnly}
        nestingDepth={getAreaDepth(areas, area.id)}
        canvasZoom={canvasZoom}
        onSelect={(areaId) => {
          if (!isViewOnly) {
            setSelectedAreaId(areaId)
            setSelectedLinkId(null)
            setLinkFlyoutLinkId(null)
          }
        }}
        onTextChange={updateAreaText}
        onMoveStart={beginAreaMove}
        onMove={moveArea}
        onMoveEnd={endAreaMove}
        onBeginLinkDrag={beginAreaLinkDrag}
        onUpdateLinkDrag={updateAreaLinkDrag}
        onEndLinkDrag={finishAreaLinkDrag}
        onCancelLinkDrag={cancelAreaLinkDrag}
        onDuplicate={duplicateAreaById}
        onDelete={deleteAreaById}
        onOpenStyles={(areaId) => {
          if (isViewOnly) return

          setSelectedAreaId(areaId)
          setSelectedLinkId(null)
          setLinkFlyoutLinkId(null)
          setStyleDialogAreaId(areaId)
        }}
        onOpenLinkDialog={openLinkDialogForArea}
        onResize={resizeAreaById}
        onCommitCssCommand={commitAreaCssCommand}
        onCommitImageCommand={commitAreaImageCommand}
        onGifCommandActive={handleGifCommandActive}
        onCommitEvidenceCommand={commitAreaEvidenceCommand}
        onRemoveEvidence={removeEvidenceFromArea}
        onReplaceImage={replaceImageById}
        onChangeImageAlt={updateImageAlt}
        onDeselect={() => {
          setSelectedAreaId(null)
          setSelectedLinkId(null)
          setLinkFlyoutLinkId(null)
        }}
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
      {shouldShowEditorChrome && (
        <button
          className="site-brand"
          type="button"
          aria-label="Open Cascadery menu"
          onClick={handleBrandClick}
        >
          <img
            alt=""
            className="site-brand-mark"
            draggable="false"
            src="/logo.svg"
          />
          <span>cascadery</span>
        </button>
      )}

      {isViewOnly && (
        <a
          className="view-only-create-canvas"
          href="/"
          aria-label="Create your own Cascadery canvas"
        >
          Create your own Cascadery canvas
        </a>
      )}

      {shouldShowEditorChrome && (
        <div className="page-persistence">
          {page.settings.mcp.enabled && (
            <button
              aria-label={`Disable MCP access for ${MCP_STATUS_LABEL}`}
              className="mcp-status-badge"
              title={`${MCP_STATUS_LABEL}. Click to disable MCP access for this page.`}
              type="button"
              onClick={() => updateMcpAccess(false)}
            >
              MCP exposed
            </button>
          )}
          {mcpAgentActivityLabel && (
            <span
              aria-live="polite"
              className="mcp-activity-status"
              title={mcpAgentActivityLabel}
            >
              {mcpAgentActivityLabel}
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
          <button
            className="page-persistence-button"
            type="button"
            onClick={exportPageMarkdown}
          >
            Export Markdown
          </button>
          <button
            className="page-persistence-button"
            type="button"
            onClick={exportPageJsonCanvas}
          >
            Export Canvas
          </button>
          <button
            className="page-persistence-button"
            type="button"
            onClick={() => importInputRef.current?.click()}
          >
            Import JSON
          </button>
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
      )}

      {shouldShowEditorChrome && (
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
      )}

      {shouldShowEmptyState && (
        <div className="canvas-hint">
          <strong>Map implementation context.</strong>
          <span>Click anywhere to start, or choose a context kit.</span>
          <div className="context-kit-buttons" aria-label="Context kits">
            {CONTEXT_KITS.map((kit) => (
              <button
                className="context-kit-button"
                key={kit.id}
                type="button"
                onClick={() => insertContextKitById(kit.id)}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span>{kit.title}</span>
                <small>{kit.description}</small>
              </button>
            ))}
          </div>
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
          <svg
            aria-label="Area connectors"
            className="area-link-layer"
          >
            <defs>
              <marker
                id="area-link-arrow"
                markerHeight="8"
                markerWidth="8"
                orient="auto-start-reverse"
                refX="7"
                refY="4"
                viewBox="0 0 8 8"
              >
                <path d="M1 1 7 4 1 7z" />
              </marker>
            </defs>
            {links.map((link) => {
              const line = getAreaLinkLine(areas, link)
              const isSelected = link.id === selectedLinkId
              const lineClassName = [
                'area-link-line',
                isSelected ? 'area-link-line--selected' : '',
                link.visual?.mode === 'schema'
                  ? 'area-link-line--schema'
                  : '',
                link.kind === 'references' ||
                link.kind === 'relates-to'
                  ? 'area-link-line--loose'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')

              if (!line) return null

              return (
                <g
                  aria-label={`Connector ${getAreaLinkLabel(link)}`}
                  className="area-link-group"
                  key={link.id}
                >
                  <line
                    className="area-link-hit-target"
                    role="button"
                    tabIndex={isViewOnly ? -1 : 0}
                    x1={line.x1}
                    x2={line.x2}
                    y1={line.y1}
                    y2={line.y2}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      if (isViewOnly) return

                      setSelectedAreaId(null)
                      setSelectedLinkId(link.id)
                      setLinkFlyoutLinkId(null)
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      if (isViewOnly) return

                      setSelectedAreaId(null)
                      setSelectedLinkId(link.id)
                      setLinkFlyoutLinkId(null)
                      setOpenDialogId('edit-area-link')
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  />
                  <line
                    className={lineClassName}
                    markerEnd={getAreaLinkMarkerUrl(link, 'end')}
                    markerStart={getAreaLinkMarkerUrl(link, 'start')}
                    x1={line.x1}
                    x2={line.x2}
                    y1={line.y1}
                    y2={line.y2}
                  />
                  {link.visual?.mode === 'schema' && (
                    <>
                      <circle
                        aria-hidden="true"
                        className="area-link-endpoint-mark"
                        cx={line.x1}
                        cy={line.y1}
                        r="3"
                      />
                      <circle
                        aria-hidden="true"
                        className="area-link-endpoint-mark"
                        cx={line.x2}
                        cy={line.y2}
                        r="3"
                      />
                    </>
                  )}
                  {shouldShowAreaLinkLabel(link, isSelected) && (
                    <text
                      className="area-link-label"
                      dominantBaseline="middle"
                      textAnchor="middle"
                      x={line.labelX}
                      y={line.labelY - 10}
                    >
                      {getAreaLinkLabel(link)}
                    </text>
                  )}
                </g>
              )
            })}
            {linkDragLine && (
              <line
                aria-hidden="true"
                className="area-link-preview-line"
                x1={linkDragLine.x1}
                x2={linkDragLine.x2}
                y1={linkDragLine.y1}
                y2={linkDragLine.y2}
              />
            )}
          </svg>

          {getRootAreas(areas).map(renderArea)}

          {shouldShowEditorChrome &&
            selectedLink &&
            selectedLinkLine &&
            !isViewOnly && (
              <svg
                aria-label="Selected connector controls"
                className="area-link-control-layer"
              >
                <circle
                  aria-label="Move connector start"
                  className="area-link-endpoint-handle"
                  cx={selectedLinkLine.x1}
                  cy={selectedLinkLine.y1}
                  r="7"
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    beginAreaLinkEndpointDrag(selectedLink, 'from', {
                      x: selectedLinkLine.x1,
                      y: selectedLinkLine.y1,
                    })
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={(e) => {
                    updateAreaLinkEndpointDrag(
                      e.clientX,
                      e.clientY,
                      e.altKey
                    )
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    finishAreaLinkEndpointDrag()
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                  }}
                  onPointerCancel={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    cancelAreaLinkEndpointDrag()
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                  }}
                />
                <circle
                  aria-label="Move connector end"
                  className="area-link-endpoint-handle"
                  cx={selectedLinkLine.x2}
                  cy={selectedLinkLine.y2}
                  r="7"
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    beginAreaLinkEndpointDrag(selectedLink, 'to', {
                      x: selectedLinkLine.x2,
                      y: selectedLinkLine.y2,
                    })
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={(e) => {
                    updateAreaLinkEndpointDrag(
                      e.clientX,
                      e.clientY,
                      e.altKey
                    )
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    finishAreaLinkEndpointDrag()
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                  }}
                  onPointerCancel={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    cancelAreaLinkEndpointDrag()
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                  }}
                />
              </svg>
            )}

          {shouldShowEditorChrome &&
            selectedLink &&
            selectedLinkLine &&
            openDialogId === null && (
              <button
                aria-label="Edit connector"
                className="area-link-edit-button"
                style={{
                  left: selectedLinkLine.labelX,
                  top: selectedLinkLine.labelY - 10,
                  '--area-link-label-offset': `${getAreaLinkEditButtonOffset(
                    getAreaLinkLabel(selectedLink)
                  )}px`,
                } as AreaLinkEditButtonCssProperties}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setLinkFlyoutLinkId((currentLinkId) =>
                    currentLinkId === selectedLink.id
                      ? null
                      : selectedLink.id
                  )
                }}
              >
                Edit
              </button>
            )}

          {shouldShowEditorChrome &&
            selectedLink &&
            selectedLinkLine &&
            linkFlyoutLinkId === selectedLink.id &&
            openDialogId === null && (
              <div
                className="area-link-flyout"
                style={{
                  left: selectedLinkLine.labelX,
                  top: selectedLinkLine.labelY,
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="area-link-flyout-header">
                  <strong>{getAreaLinkLabel(selectedLink)}</strong>
                  <button
                    aria-label="Close connector menu"
                    className="area-link-flyout-close"
                    type="button"
                    onClick={() => setLinkFlyoutLinkId(null)}
                  >
                    x
                  </button>
                </div>
                <div className="area-link-flyout-row">
                  {AREA_LINK_KINDS.filter(
                    (kind) => kind !== 'contains'
                  ).map((kind) => (
                    <button
                      className={`area-link-flyout-chip${
                        selectedLink.kind === kind
                          ? ' area-link-flyout-chip--selected'
                          : ''
                      }`}
                      key={kind}
                      type="button"
                      onClick={() =>
                        updateSelectedAreaLink({
                          kind,
                        })
                      }
                    >
                      {AREA_LINK_KIND_LABELS[kind]}
                    </button>
                  ))}
                </div>
                <div className="area-link-flyout-row">
                  {AREA_LINK_DIRECTIONS.map((direction) => (
                    <button
                      className={`area-link-flyout-chip${
                        selectedLinkVisual.direction === direction
                          ? ' area-link-flyout-chip--selected'
                          : ''
                      }`}
                      key={direction}
                      type="button"
                      onClick={() =>
                        updateSelectedAreaLinkVisual({
                          direction,
                        })
                      }
                    >
                      {AREA_LINK_DIRECTION_LABELS[direction]}
                    </button>
                  ))}
                </div>
                <label className="area-link-flyout-label">
                  <span>Label</span>
                  <input
                    aria-label="Connector label"
                    type="text"
                    value={selectedLink.label ?? ''}
                    onChange={(e) =>
                      updateSelectedAreaLink({
                        label: e.currentTarget.value,
                      })
                    }
                  />
                </label>
                <div className="area-link-flyout-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkFlyoutLinkId(null)
                      setOpenDialogId('edit-area-link')
                    }}
                  >
                    More
                  </button>
                  <button
                    className="area-link-flyout-danger"
                    type="button"
                    onClick={deleteSelectedAreaLink}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

          {shouldShowEditorChrome &&
            activeGifCommand &&
            gifFlyoutStyle && (
              <GifSearchFlyout
                query={activeGifCommand.command.query}
                selectedIndex={gifSearchState.selectedIndex}
                state={gifSearchState}
                style={gifFlyoutStyle}
                onClose={() => setActiveGifCommand(null)}
                onSelectIndex={(selectedIndex) =>
                  setGifSearchState((current) => ({
                    ...current,
                    selectedIndex,
                  }))
                }
                onInsert={insertGifResult}
              />
            )}

          {shouldShowEditorChrome && (
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
          )}
        </div>
      </div>

      {offscreenAreaIndicators.length > 0 && (
        <OffscreenAreaIndicators
          indicators={offscreenAreaIndicators}
          onActivate={panToOffscreenIndicator}
        />
      )}

      {shouldEnableCanvasZoom && (
        <CanvasZoomControls
          zoom={canvasZoom}
          onFit={zoomCanvasToFit}
          onReset={resetCanvasZoom}
          onZoomIn={() => zoomCanvasByDirection(1)}
          onZoomOut={() => zoomCanvasByDirection(-1)}
        />
      )}

      {shouldShowEditorChrome && deletedAreaSnapshot && (
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

      {shouldShowEditorChrome && commandPaletteQuery !== null && (
        <CommandPalette
          query={commandPaletteQuery}
          options={commandPaletteOptions}
          onQueryChange={setCommandPaletteQuery}
          onOpenOption={(option) => {
            setCommandPaletteQuery(null)
            if (option.id === 'share') {
              void ensureShareLinks()
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
            if (option.id === 'insert-gif') {
              const point = selectedArea
                ? {
                    x: selectedArea.x,
                    y: selectedArea.y + selectedArea.height + 16,
                  }
                : getViewportCenterPoint(canvasZoom)
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
                  text: '/gif ',
                  styles: {},
                  createdAt,
                  updatedAt: createdAt,
                },
              ])
              setSelectedAreaId(id)
              setSelectedLinkId(null)
              setAutoFocusAreaId(id)
              setHasClickedCanvas(true)
              setActiveGifCommand({
                areaId: id,
                command: {
                  start: 0,
                  end: 5,
                  raw: '/gif ',
                  query: '',
                },
              })
              return
            }
            if (option.id === 'insert-context-kit') {
              setOpenDialogId(option.id)
              return
            }
            if (option.id === 'agent-handoff') {
              setOpenDialogId(option.id)
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
            if (
              option.id === 'set-area-type' ||
              option.id === 'link-selected-area' ||
              option.id === 'nest-selected-area' ||
              option.id === 'unnest-selected-area' ||
              option.id === 'add-child-area' ||
              option.id === 'add-evidence'
            ) {
              if (!selectedAreaId) {
                setImportError('Select an Area first.')
                return
              }

              if (option.id === 'unnest-selected-area') {
                unnestSelectedArea()
                return
              }

              if (option.id === 'add-child-area') {
                addChildAreaToSelectedArea()
                return
              }

              if (option.id === 'add-evidence') {
                requestEvidenceForSelectedArea()
                return
              }

              if (
                option.id === 'link-selected-area' &&
                !linkTargetAreaId
              ) {
                setLinkTargetAreaId(
                  areas.find((area) => area.id !== selectedAreaId)?.id ??
                    ''
                )
              }

              if (
                option.id === 'nest-selected-area' &&
                !nestTargetAreaId
              ) {
                setNestTargetAreaId(
                  areas.find((area) => area.id !== selectedAreaId)?.id ??
                    ''
                )
              }

              setSelectedLinkId(null)
              setOpenDialogId(option.id)
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

      {shouldShowEditorChrome && styleDialogArea && (
        <AreaStyleDialog
          area={styleDialogArea}
          themeColors={page.settings.theme.colors}
          onApplyStyle={(property, value) =>
            applyAreaStyle(styleDialogArea.id, property, value)
          }
          onRemoveStyle={(property) =>
            removeAreaStyle(styleDialogArea.id, property)
          }
          onClose={() => setStyleDialogAreaId(null)}
        />
      )}

      {shouldShowEditorChrome &&
        openDialogId !== null &&
        COMMAND_DIALOGS[openDialogId] && (
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
              {openDialogId === 'leave-canvas' ? (
                <div className="leave-canvas-confirmation">
                  <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                  <div className="command-dialog-actions">
                    <button
                      className="command-dialog-button"
                      type="button"
                      onClick={() => setOpenDialogId(null)}
                    >
                      No, stay
                    </button>
                    <button
                      className="command-dialog-button command-dialog-button--danger"
                      type="button"
                      onClick={leaveCanvasForStart}
                    >
                      Yes, leave
                    </button>
                  </div>
                </div>
              ) : openDialogId === 'share' ? (
                <div className="share-link-controls">
                <p>
                  Anyone with an edit link can change this context canvas.
                  View-only links open a clean read mode.
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
            ) : openDialogId === 'set-area-type' ? (
              <div className="area-metadata-controls">
                <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                {selectedArea && selectedAreaMetadata ? (
                  <>
                    <label className="page-style-control">
                      <span>Type</span>
                      <select
                        aria-label="Area type"
                        value={selectedAreaMetadata.kind}
                        onChange={(e) =>
                          updateSelectedAreaMetadata({
                            kind: e.currentTarget
                              .value as AreaMetadata['kind'],
                          })
                        }
                      >
                        {AREA_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="page-style-control">
                      <span>Status</span>
                      <select
                        aria-label="Area status"
                        value={selectedAreaMetadata.status ?? ''}
                        onChange={(e) => {
                          const nextStatus = e.currentTarget.value

                          updateSelectedAreaMetadata({
                            status: nextStatus
                              ? (nextStatus as AreaStatus)
                              : undefined,
                          })
                        }}
                      >
                        <option value="">No status</option>
                        {AREA_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <p>Select an Area first.</p>
                )}
              </div>
            ) : openDialogId === 'nest-selected-area' ? (
              <div className="area-link-controls">
                <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                {selectedArea && nestTargetAreas.length > 0 ? (
                  <>
                    <label className="page-style-control">
                      <span>Parent Area</span>
                      <select
                        aria-label="Parent Area"
                        value={nestTargetAreaId}
                        onChange={(e) =>
                          setNestTargetAreaId(e.currentTarget.value)
                        }
                      >
                        {nestTargetAreas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.type === 'image'
                              ? area.alt || area.id
                              : area.text.trim().split('\n')[0] ||
                                area.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="area-link-create-button"
                      type="button"
                      onClick={nestSelectedAreaIntoTarget}
                    >
                      Nest Area
                    </button>
                  </>
                ) : (
                  <p>Add another Area before nesting.</p>
                )}
              </div>
            ) : openDialogId === 'link-selected-area' ? (
              <div className="area-link-controls">
                <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                {selectedArea && linkTargetAreas.length > 0 ? (
                  <>
                    <label className="page-style-control">
                      <span>Target Area</span>
                      <select
                        aria-label="Link target Area"
                        value={linkTargetAreaId}
                        onChange={(e) =>
                          setLinkTargetAreaId(e.currentTarget.value)
                        }
                      >
                        {linkTargetAreas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.type === 'image'
                              ? area.alt || area.id
                              : area.text.trim().split('\n')[0] ||
                                area.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="page-style-control">
                      <span>Relationship</span>
                      <select
                        aria-label="Link relationship"
                        value={linkKind}
                        onChange={(e) =>
                          setLinkKind(
                            e.currentTarget.value as AreaLinkKind
                          )
                        }
                      >
                        {AREA_LINK_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {AREA_LINK_KIND_LABELS[kind]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="page-style-control">
                      <span>Visual mode</span>
                      <select
                        aria-label="Connector visual mode"
                        value={linkVisualMode}
                        onChange={(e) =>
                          setLinkVisualMode(
                            e.currentTarget
                              .value as AreaLinkVisualMode
                          )
                        }
                      >
                        {AREA_LINK_VISUAL_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {AREA_LINK_VISUAL_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="area-link-field-grid">
                      <label className="page-style-control">
                        <span>Direction</span>
                        <select
                          aria-label="Connector direction"
                          value={linkDirection}
                          onChange={(e) =>
                            setLinkDirection(
                              e.currentTarget
                                .value as AreaLinkDirection
                            )
                          }
                        >
                          {AREA_LINK_DIRECTIONS.map((direction) => (
                            <option key={direction} value={direction}>
                              {AREA_LINK_DIRECTION_LABELS[direction]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="page-style-control">
                        <span>Route</span>
                        <select
                          aria-label="Connector route"
                          value={linkRoute}
                          onChange={(e) =>
                            setLinkRoute(
                              e.currentTarget.value as AreaLinkRoute
                            )
                          }
                        >
                          {AREA_LINK_ROUTES.map((route) => (
                            <option key={route} value={route}>
                              {AREA_LINK_ROUTE_LABELS[route]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="page-style-control">
                        <span>Label visibility</span>
                        <select
                          aria-label="Connector label visibility"
                          value={linkLabelVisibility}
                          onChange={(e) =>
                            setLinkLabelVisibility(
                              e.currentTarget
                                .value as AreaLinkLabelVisibility
                            )
                          }
                        >
                          {AREA_LINK_LABEL_VISIBILITIES.map(
                            (visibility) => (
                              <option
                                key={visibility}
                                value={visibility}
                              >
                                {
                                  AREA_LINK_LABEL_VISIBILITY_LABELS[
                                    visibility
                                  ]
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                    <label className="page-style-control">
                      <span>Label</span>
                      <input
                        aria-label="Link label"
                        type="text"
                        value={linkLabel}
                        onChange={(e) =>
                          setLinkLabel(e.currentTarget.value)
                        }
                      />
                    </label>
                    {linkVisualMode === 'schema' && (
                      <section className="area-link-schema-fields">
                        <h3>Schema details</h3>
                        <div className="area-link-field-grid">
                          <label className="page-style-control">
                            <span>From cardinality</span>
                            <select
                              aria-label="From cardinality"
                              value={linkFromCardinality}
                              onChange={(e) =>
                                setLinkFromCardinality(
                                  e.currentTarget
                                    .value as AreaLinkCardinality
                                )
                              }
                            >
                              {AREA_LINK_CARDINALITIES.map(
                                (cardinality) => (
                                  <option
                                    key={cardinality}
                                    value={cardinality}
                                  >
                                    {
                                      AREA_LINK_CARDINALITY_LABELS[
                                        cardinality
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                          <label className="page-style-control">
                            <span>To cardinality</span>
                            <select
                              aria-label="To cardinality"
                              value={linkToCardinality}
                              onChange={(e) =>
                                setLinkToCardinality(
                                  e.currentTarget
                                    .value as AreaLinkCardinality
                                )
                              }
                            >
                              {AREA_LINK_CARDINALITIES.map(
                                (cardinality) => (
                                  <option
                                    key={cardinality}
                                    value={cardinality}
                                  >
                                    {
                                      AREA_LINK_CARDINALITY_LABELS[
                                        cardinality
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                          <label className="page-style-control">
                            <span>Optionality</span>
                            <select
                              aria-label="Connector optionality"
                              value={linkOptionality}
                              onChange={(e) =>
                                setLinkOptionality(
                                  e.currentTarget
                                    .value as AreaLinkOptionality
                                )
                              }
                            >
                              {AREA_LINK_OPTIONALITIES.map(
                                (optionality) => (
                                  <option
                                    key={optionality}
                                    value={optionality}
                                  >
                                    {
                                      AREA_LINK_OPTIONALITY_LABELS[
                                        optionality
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                        </div>
                        <label className="page-style-control">
                          <span>Field label</span>
                          <input
                            aria-label="Schema field label"
                            type="text"
                            value={linkFieldLabel}
                            onChange={(e) =>
                              setLinkFieldLabel(
                                e.currentTarget.value
                              )
                            }
                          />
                        </label>
                      </section>
                    )}
                    <button
                      className="area-link-create-button"
                      type="button"
                      onClick={createSelectedAreaLink}
                    >
                      Create link
                    </button>
                  </>
                ) : (
                  <p>Add another Area before creating a link.</p>
                )}
              </div>
            ) : openDialogId === 'edit-area-link' ? (
              <div className="area-link-controls">
                <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                {selectedLink ? (
                  <>
                    <label className="page-style-control">
                      <span>Relationship</span>
                      <select
                        aria-label="Edit connector relationship"
                        value={selectedLink.kind}
                        onChange={(e) =>
                          updateSelectedAreaLink({
                            kind: e.currentTarget
                              .value as AreaLinkKind,
                          })
                        }
                      >
                        {AREA_LINK_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {AREA_LINK_KIND_LABELS[kind]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="page-style-control">
                      <span>Label</span>
                      <input
                        aria-label="Edit connector label"
                        type="text"
                        value={selectedLink.label ?? ''}
                        onChange={(e) =>
                          updateSelectedAreaLink({
                            label: e.currentTarget.value,
                          })
                        }
                      />
                    </label>
                    <label className="page-style-control">
                      <span>Visual mode</span>
                      <select
                        aria-label="Edit connector visual mode"
                        value={selectedLinkVisual.mode}
                        onChange={(e) => {
                          const nextMode = e.currentTarget
                            .value as AreaLinkVisualMode

                          updateSelectedAreaLinkVisual({
                            mode: nextMode,
                          })

                          if (nextMode === 'schema') {
                            updateSelectedAreaLinkSchema({})
                          }
                        }}
                      >
                        {AREA_LINK_VISUAL_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {AREA_LINK_VISUAL_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="area-link-field-grid">
                      <label className="page-style-control">
                        <span>Direction</span>
                        <select
                          aria-label="Edit connector direction"
                          value={selectedLinkVisual.direction}
                          onChange={(e) =>
                            updateSelectedAreaLinkVisual({
                              direction: e.currentTarget
                                .value as AreaLinkDirection,
                            })
                          }
                        >
                          {AREA_LINK_DIRECTIONS.map((direction) => (
                            <option key={direction} value={direction}>
                              {AREA_LINK_DIRECTION_LABELS[direction]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="page-style-control">
                        <span>Route</span>
                        <select
                          aria-label="Edit connector route"
                          value={selectedLinkVisual.route}
                          onChange={(e) =>
                            updateSelectedAreaLinkVisual({
                              route: e.currentTarget
                                .value as AreaLinkRoute,
                            })
                          }
                        >
                          {AREA_LINK_ROUTES.map((route) => (
                            <option key={route} value={route}>
                              {AREA_LINK_ROUTE_LABELS[route]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="page-style-control">
                        <span>Label visibility</span>
                        <select
                          aria-label="Edit connector label visibility"
                          value={selectedLinkVisual.labelVisibility}
                          onChange={(e) =>
                            updateSelectedAreaLinkVisual({
                              labelVisibility: e.currentTarget
                                .value as AreaLinkLabelVisibility,
                            })
                          }
                        >
                          {AREA_LINK_LABEL_VISIBILITIES.map(
                            (visibility) => (
                              <option
                                key={visibility}
                                value={visibility}
                              >
                                {
                                  AREA_LINK_LABEL_VISIBILITY_LABELS[
                                    visibility
                                  ]
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                    {selectedLinkVisual.mode === 'schema' && (
                      <section className="area-link-schema-fields">
                        <h3>Schema details</h3>
                        <div className="area-link-field-grid">
                          <label className="page-style-control">
                            <span>From cardinality</span>
                            <select
                              aria-label="Edit from cardinality"
                              value={
                                selectedLinkSchema.fromCardinality ??
                                'one'
                              }
                              onChange={(e) =>
                                updateSelectedAreaLinkSchema({
                                  fromCardinality: e.currentTarget
                                    .value as AreaLinkCardinality,
                                })
                              }
                            >
                              {AREA_LINK_CARDINALITIES.map(
                                (cardinality) => (
                                  <option
                                    key={cardinality}
                                    value={cardinality}
                                  >
                                    {
                                      AREA_LINK_CARDINALITY_LABELS[
                                        cardinality
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                          <label className="page-style-control">
                            <span>To cardinality</span>
                            <select
                              aria-label="Edit to cardinality"
                              value={
                                selectedLinkSchema.toCardinality ??
                                'many'
                              }
                              onChange={(e) =>
                                updateSelectedAreaLinkSchema({
                                  toCardinality: e.currentTarget
                                    .value as AreaLinkCardinality,
                                })
                              }
                            >
                              {AREA_LINK_CARDINALITIES.map(
                                (cardinality) => (
                                  <option
                                    key={cardinality}
                                    value={cardinality}
                                  >
                                    {
                                      AREA_LINK_CARDINALITY_LABELS[
                                        cardinality
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                          <label className="page-style-control">
                            <span>Optionality</span>
                            <select
                              aria-label="Edit connector optionality"
                              value={
                                selectedLinkSchema.optionality ??
                                'required'
                              }
                              onChange={(e) =>
                                updateSelectedAreaLinkSchema({
                                  optionality: e.currentTarget
                                    .value as AreaLinkOptionality,
                                })
                              }
                            >
                              {AREA_LINK_OPTIONALITIES.map(
                                (optionality) => (
                                  <option
                                    key={optionality}
                                    value={optionality}
                                  >
                                    {
                                      AREA_LINK_OPTIONALITY_LABELS[
                                        optionality
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                        </div>
                        <label className="page-style-control">
                          <span>Field label</span>
                          <input
                            aria-label="Edit schema field label"
                            type="text"
                            value={selectedLinkSchema.fieldLabel ?? ''}
                            onChange={(e) =>
                              updateSelectedAreaLinkSchema({
                                fieldLabel: e.currentTarget.value,
                              })
                            }
                          />
                        </label>
                      </section>
                    )}
                    <div className="command-dialog-actions">
                      <button
                        className="command-dialog-button command-dialog-button--secondary"
                        type="button"
                        onClick={() => setOpenDialogId(null)}
                      >
                        Done
                      </button>
                      <button
                        className="command-dialog-button command-dialog-button--danger"
                        type="button"
                        onClick={deleteSelectedAreaLink}
                      >
                        Delete connector
                      </button>
                    </div>
                  </>
                ) : (
                  <p>Select a connector first.</p>
                )}
              </div>
            ) : openDialogId === 'agent-suggestions' ? (
              <div className="agent-proposal">
                <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                {agentProposalError && (
                  <p className="agent-proposal-error" role="alert">
                    {agentProposalError}
                  </p>
                )}
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
                            <div className="agent-proposal-operation-copy">
                              <code>{operation.op}</code>
                              <span>
                                {getAgentOperationSummary(operation)}
                              </span>
                            </div>
                            <div className="agent-proposal-operation-actions">
                              <button
                                className="agent-proposal-mini-button"
                                type="button"
                                onClick={() =>
                                  applyAgentProposalOperation(
                                    operationIndex
                                  )
                                }
                              >
                                Apply operation
                              </button>
                              <button
                                className="agent-proposal-mini-button agent-proposal-mini-button--secondary"
                                type="button"
                                onClick={() =>
                                  rejectAgentProposalOperation(
                                    operationIndex
                                  )
                                }
                              >
                                Reject operation
                              </button>
                            </div>
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
            ) : openDialogId === 'history' ? (
              <div className="history-dialog">
                <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                {recentHistoryEvents.length > 0 ? (
                  <div className="history-events">
                    {recentHistoryEvents.map((event) => (
                      <div className="history-event" key={event.id}>
                        <div className="history-event-copy">
                          <strong>{event.summary}</strong>
                          <span>
                            {getHistoryActionLabel(event)} by{' '}
                            {event.actor.displayName} at{' '}
                            {getHistoryEventTimeLabel(event.createdAt)}
                          </span>
                        </div>
                        {event.reversible && event.undoPatchId ? (
                          <button
                            className="history-event-button"
                            type="button"
                            onClick={() => undoHistoryEvent(event)}
                          >
                            {event.actionType === 'import'
                              ? 'Restore previous page'
                              : 'Undo patch'}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No recent changes yet.</p>
                )}
              </div>
            ) : openDialogId === 'insert-context-kit' ? (
              <ContextKitPicker
                kits={CONTEXT_KITS}
                onInsert={insertContextKitById}
              />
            ) : openDialogId === 'agent-handoff' ? (
              <div className="agent-handoff-dialog">
                <p>{COMMAND_DIALOGS[openDialogId].body}</p>
                {agentHandoffBrief.warnings.length > 0 && (
                  <div className="agent-handoff-warnings">
                    <strong>Warnings</strong>
                    <ul>
                      {agentHandoffBrief.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <pre className="agent-handoff-preview">
                  {agentHandoffBrief.markdown}
                </pre>
                <div className="agent-handoff-actions">
                  <button
                    className="agent-proposal-button"
                    type="button"
                    onClick={copyAgentHandoffBrief}
                  >
                    Copy Markdown
                  </button>
                  <button
                    className="agent-proposal-button agent-proposal-button--secondary"
                    type="button"
                    onClick={exportAgentHandoffBrief}
                  >
                    Export Markdown
                  </button>
                </div>
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
            {openDialogId !== 'leave-canvas' && (
              <button
                className="command-dialog-button"
                type="button"
                onClick={() => setOpenDialogId(null)}
              >
                Close
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

const ContextKitPicker = ({
  kits,
  onInsert,
}: {
  kits: ContextKit[]
  onInsert: (kitId: string) => void
}) => (
  <div className="context-kit-picker">
    <p>Start with a compact map for the work in front of you.</p>
    <div className="context-kit-picker-list">
      {kits.map((kit) => (
        <button
          className="context-kit-picker-button"
          key={kit.id}
          type="button"
          onClick={() => onInsert(kit.id)}
        >
          <span>{kit.title}</span>
          <small>{kit.description}</small>
        </button>
      ))}
    </div>
  </div>
)

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

const GifSearchFlyout = ({
  query,
  selectedIndex,
  state,
  style,
  onClose,
  onInsert,
  onSelectIndex,
}: {
  query: string
  selectedIndex: number
  state: GifSearchState
  style: CSSProperties
  onClose: () => void
  onInsert: (result: GifSearchResult) => void
  onSelectIndex: (index: number) => void
}) => (
  <section
    aria-label="GIF search results"
    className="gif-search-flyout"
    style={style}
    onPointerDown={(event) => event.stopPropagation()}
  >
    <div className="gif-search-header">
      <div>
        <strong>{query ? `GIFs for "${query}"` : 'Trending GIFs'}</strong>
        <span>
          {state.status === 'loading'
            ? 'Searching...'
            : 'Choose a result to insert'}
        </span>
      </div>
      <button
        aria-label="Close GIF search"
        className="gif-search-close"
        type="button"
        onClick={onClose}
      >
        x
      </button>
    </div>
    {state.status === 'missing-key' || state.status === 'error' ? (
      <p className="gif-search-message" role="status">
        {state.message}
      </p>
    ) : state.status === 'empty' ? (
      <p className="gif-search-message" role="status">
        {state.message}
      </p>
    ) : (
      <div className="gif-search-grid" role="listbox">
        {state.results.map((result, index) => (
          <button
            aria-label={`Insert ${result.title}`}
            aria-selected={index === selectedIndex}
            className={`gif-search-result${
              index === selectedIndex
                ? ' gif-search-result--selected'
                : ''
            }`}
            key={result.providerAssetId}
            role="option"
            type="button"
            onClick={() => onInsert(result)}
            onMouseEnter={() => onSelectIndex(index)}
          >
            <img
              alt={result.title}
              draggable="false"
              src={result.stillUrl ?? result.previewUrl}
            />
          </button>
        ))}
      </div>
    )}
    <div className="gif-search-footer">
      <span>Powered by GIPHY</span>
    </div>
  </section>
)

const OffscreenAreaIndicators = ({
  indicators,
  onActivate,
}: {
  indicators: OffscreenIndicator[]
  onActivate: (indicator: OffscreenIndicator) => void
}) => (
  <div className="offscreen-area-indicators" aria-label="Offscreen areas">
    {indicators.map((indicator) => (
      <button
        aria-label={getOffscreenIndicatorAriaLabel(indicator)}
        className="offscreen-area-indicator"
        key={indicator.id}
        style={
          {
            '--offscreen-indicator-x': `${indicator.viewportPosition.x}px`,
            '--offscreen-indicator-y': `${indicator.viewportPosition.y}px`,
            '--offscreen-indicator-rotation': `${indicator.rotationDegrees}deg`,
          } as OffscreenIndicatorCssProperties
        }
        title={getOffscreenIndicatorAriaLabel(indicator)}
        type="button"
        onClick={() => onActivate(indicator)}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <svg
          aria-hidden="true"
          className="offscreen-area-indicator__arrow"
          focusable="false"
          viewBox="0 0 20 20"
        >
          <path d="M4 10h10M10 5l5 5-5 5" />
        </svg>
        {indicator.count > 1 && (
          <span className="offscreen-area-indicator__count">
            {indicator.count > 9 ? '10+' : indicator.count}
          </span>
        )}
      </button>
    ))}
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
