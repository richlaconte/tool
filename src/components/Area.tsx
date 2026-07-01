import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import type { AreaState, AssetState } from '../App'
import { getAreaShellZIndex } from '../areaLayering'
import {
  getAreaMetadata,
  type AreaEvidenceReference,
  type AreaLinkSide,
} from '../areaMetadata'
import { getVisibleAreaContentHeight } from '../areaResize'
import {
  findEvidenceSlashCommand,
  findEvidenceSlashCommandCandidate,
  getAreaEvidenceLabel,
  type EvidenceSlashCommand,
  type EvidenceSlashCommandCandidate,
} from '../areaEvidence'
import {
  findCssSlashCommand,
  type CssSlashCommand,
} from '../cssSlashCommand'
import {
  findImageSlashCommand,
  type ImageSlashCommand,
} from '../imageSupport'
import {
  findGifSlashCommand,
  type GifSlashCommand,
} from '../gifSearch'
import { resizeWithPreservedAspectRatio } from '../imageResize'
import {
  resolveThemeColorTokens,
  type ThemeColorToken,
} from '../themeColors'

type AreaProps = {
  area: AreaState
  asset?: AssetState
  children?: ReactNode
  themeColors: ThemeColorToken[]
  isNewest: boolean
  isSelected: boolean
  isDragging: boolean
  isNestingTarget: boolean
  isUnnestingSource: boolean
  isLinkTarget: boolean
  isReadOnly: boolean
  nestingDepth: number
  canvasZoom: number
  onSelect: (id: string) => void
  onTextChange: (id: string, text: string) => void
  onMoveStart: (id: string) => void
  onMove: (
    id: string,
    x: number,
    y: number,
    bypassSnapGrid?: boolean
  ) => void
  onMoveEnd: (id: string) => void
  onBeginLinkDrag: (
    id: string,
    side: AreaLinkSide,
    position: number,
    clientX: number,
    clientY: number
  ) => void
  onUpdateLinkDrag: (clientX: number, clientY: number) => void
  onEndLinkDrag: (clientX: number, clientY: number) => void
  onCancelLinkDrag: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onOpenStyles: (id: string) => void
  onOpenLinkDialog: (id: string) => void
  onResize: (
    id: string,
    width: number,
    height: number,
    bypassSnapGrid?: boolean
  ) => void
  onCommitCssCommand: (
    id: string,
    command: CssSlashCommand
  ) => void
  onCommitImageCommand: (
    id: string,
    command: ImageSlashCommand
  ) => void
  onGifCommandActive: (
    id: string,
    command: GifSlashCommand | null
  ) => void
  onCommitEvidenceCommand: (
    id: string,
    command: EvidenceSlashCommand
  ) => void
  onRemoveEvidence: (id: string, evidenceId: string) => void
  onReplaceImage: (id: string) => void
  onChangeImageAlt: (id: string, alt: string) => void
  onDeselect: () => void
}

const Area = ({
  area,
  asset,
  children,
  themeColors,
  isNewest,
  isSelected,
  isDragging,
  isNestingTarget,
  isUnnestingSource,
  isLinkTarget,
  isReadOnly,
  nestingDepth,
  canvasZoom,
  onSelect,
  onTextChange,
  onMoveStart,
  onMove,
  onMoveEnd,
  onBeginLinkDrag,
  onUpdateLinkDrag,
  onEndLinkDrag,
  onCancelLinkDrag,
  onDuplicate,
  onDelete,
  onOpenStyles,
  onOpenLinkDialog,
  onResize,
  onCommitCssCommand,
  onCommitImageCommand,
  onGifCommandActive,
  onCommitEvidenceCommand,
  onRemoveEvidence,
  onReplaceImage,
  onChangeImageAlt,
  onDeselect,
}: AreaProps) => {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const areaRef = useRef<HTMLDivElement | null>(null)
  const editableRef = useRef<HTMLDivElement | null>(null)
  const appliedStyleProperties = useRef<string[]>([])
  const dragOffset = useRef({
    x: 0,
    y: 0,
  })
  const resizeStart = useRef({
    pointerX: 0,
    pointerY: 0,
    height: area.height,
    width: area.width,
  })
  const isAreaDraggingRef = useRef(false)
  const isLinkDragging = useRef(false)
  const isResizing = useRef(false)
  const [caretIndex, setCaretIndex] = useState(0)
  const [textLayerHeight, setTextLayerHeight] = useState(
    area.height
  )
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState(false)
  const [gifPlaybackOverride, setGifPlaybackOverride] = useState<
    'play' | 'pause' | null
  >(null)

  const isImageArea = area.type === 'image'
  const isGifArea = isImageArea && asset?.source?.provider === 'giphy'
  const shouldShowGifStill =
    isGifArea &&
    (gifPlaybackOverride === 'pause' ||
      (gifPlaybackOverride === null && prefersReducedMotion))
  const areaText = isImageArea ? '' : area.text
  const evidence = getAreaMetadata(area).evidence ?? []
  const supportsThemedCssDeclaration = (
    property: string,
    value: string
  ) => {
    if (typeof CSS === 'undefined') return false

    return CSS.supports(
      property,
      resolveThemeColorTokens(value, themeColors)
    )
  }
  const activeGifCommand =
    isSelected && !isReadOnly && !isImageArea
      ? findGifSlashCommand(areaText, caretIndex)
      : null
  const activeImageCommand =
    isSelected && !isReadOnly && !isImageArea && !activeGifCommand
      ? findImageSlashCommand(areaText, caretIndex)
      : null
  const activeEvidenceCommand =
    isSelected &&
    !isReadOnly &&
    !isImageArea &&
    !activeGifCommand &&
    !activeImageCommand
      ? findEvidenceSlashCommand(areaText, caretIndex)
      : null
  const activeCommand =
    isSelected &&
    !isReadOnly &&
    !isImageArea &&
    !activeGifCommand &&
    !activeImageCommand &&
    !activeEvidenceCommand
      ? findCssSlashCommand(
          areaText,
          caretIndex,
          supportsThemedCssDeclaration
        )
      : null
  const highlightCommandCaretIndex = isSelected
    ? caretIndex
    : areaText.length
  const gifCommandForHighlight = !isImageArea
    ? findGifSlashCommand(areaText, highlightCommandCaretIndex)
    : null
  const evidenceCommandForHighlight = !isImageArea
    ? findEvidenceSlashCommandCandidate(
        areaText,
        highlightCommandCaretIndex
      )
    : null
  const cssCommandForHighlight = !isImageArea
    ? findCssSlashCommand(
        areaText,
        highlightCommandCaretIndex,
        supportsThemedCssDeclaration
      )
    : null
  const highlightedCommand =
    gifCommandForHighlight ??
    evidenceCommandForHighlight ??
    (cssCommandForHighlight?.propertyIsValid
      ? cssCommandForHighlight
      : null)
  const highlightedCommandIsInvalid =
    Boolean(
      evidenceCommandForHighlight &&
        !evidenceCommandForHighlight.targetIsValid
    ) ||
    (!gifCommandForHighlight &&
      !evidenceCommandForHighlight &&
      cssCommandForHighlight &&
        cssCommandForHighlight.value.length > 0 &&
        !cssCommandForHighlight.declarationIsValid)

  const canEditText = !isImageArea

  const imageAltText = isImageArea ? area.alt : ''
  const imageSource =
    isGifArea && shouldShowGifStill
      ? asset?.source?.stillUrl ?? asset?.storageKey ?? ''
      : asset?.storageKey ?? ''

  const editImageAltText = () => {
    if (!isImageArea) return

    const nextAlt = window.prompt('Image description', imageAltText)

    if (nextAlt !== null) onChangeImageAlt(area.id, nextAlt)
  }

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return

    const mediaQuery = matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () =>
      setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)

    return () => {
      mediaQuery.removeEventListener('change', updatePreference)
    }
  }, [])

  useEffect(() => {
    onGifCommandActive(area.id, activeGifCommand)
  }, [
    activeGifCommand?.end,
    activeGifCommand?.query,
    activeGifCommand?.raw,
    activeGifCommand?.start,
    area.id,
    onGifCommandActive,
  ])

  useEffect(() => {
    if (!isNewest || !canEditText) return

    const frame = requestAnimationFrame(() => {
      editableRef.current?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [canEditText, isNewest, editableRef])

  useEffect(() => {
    const element = areaRef.current

    if (!element) return

    for (const property of appliedStyleProperties.current) {
      if (!(property in area.styles)) {
        element.style.removeProperty(property)
      }
    }

    for (const [property, value] of Object.entries(area.styles)) {
      element.style.setProperty(property, value)
    }

    appliedStyleProperties.current = Object.keys(area.styles)
  }, [area.styles])

  const syncCaret = (editable: HTMLDivElement) => {
    setCaretIndex(getEditableCaretIndex(editable))
  }

  const syncTextLayerHeight = useCallback(
    (editable: HTMLDivElement) => {
      const previousHeight = editable.style.height

      editable.style.height = '0px'
      const contentHeight = editable.scrollHeight
      editable.style.height = previousHeight

      const nextHeight = getVisibleAreaContentHeight(
        area.height,
        contentHeight
      )

      setTextLayerHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight
      )
    },
    [area.height]
  )

  useLayoutEffect(() => {
    const editable = editableRef.current

    if (!editable) return

    if (!canEditText) return

    if (getEditableText(editable) !== areaText) {
      editable.innerText = areaText
    }

    syncTextLayerHeight(editable)
  }, [
    areaText,
    area.width,
    canEditText,
    isReadOnly,
    syncTextLayerHeight,
  ])

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(area.id)
    onMoveStart(area.id)

    isAreaDraggingRef.current = true

    const shellRect =
      shellRef.current?.getBoundingClientRect() ??
      e.currentTarget.getBoundingClientRect()

    dragOffset.current = {
      x: (e.clientX - shellRect.left) / canvasZoom,
      y: (e.clientY - shellRect.top) / canvasZoom,
    }

    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isAreaDraggingRef.current) return

    const offsetParent =
      shellRef.current?.offsetParent instanceof HTMLElement
        ? shellRef.current.offsetParent
        : null
    const offsetParentRect = offsetParent?.getBoundingClientRect()
    const x =
      (e.clientX - (offsetParentRect?.left ?? 0)) / canvasZoom -
      dragOffset.current.x
    const y =
      (e.clientY - (offsetParentRect?.top ?? 0)) / canvasZoom -
      dragOffset.current.y

    onMove(area.id, x, y, e.altKey)
  }

  const handlePointerEnd = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    isAreaDraggingRef.current = false
    onMoveEnd(area.id)

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const getLinkZonePosition = (
    side: AreaLinkSide,
    clientX: number,
    clientY: number
  ) => {
    const rect = areaRef.current?.getBoundingClientRect()

    if (!rect) return 0.5

    const value =
      side === 'top' || side === 'bottom'
        ? (clientX - rect.left) / rect.width
        : (clientY - rect.top) / rect.height

    if (!Number.isFinite(value)) return 0.5

    return Math.max(0, Math.min(1, value))
  }

  const handleLinkZonePointerDown =
    (side: AreaLinkSide) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      onSelect(area.id)
      isLinkDragging.current = true
      onBeginLinkDrag(
        area.id,
        side,
        getLinkZonePosition(side, e.clientX, e.clientY),
        e.clientX,
        e.clientY
      )
      e.currentTarget.setPointerCapture(e.pointerId)
    }

  const handleLinkZonePointerMove = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isLinkDragging.current) return

    e.preventDefault()
    e.stopPropagation()
    onUpdateLinkDrag(e.clientX, e.clientY)
  }

  const handleLinkZonePointerEnd = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isLinkDragging.current) return

    e.preventDefault()
    e.stopPropagation()
    isLinkDragging.current = false
    onEndLinkDrag(e.clientX, e.clientY)

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleLinkZonePointerCancel = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isLinkDragging.current) return

    e.preventDefault()
    e.stopPropagation()
    isLinkDragging.current = false
    onCancelLinkDrag()

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(area.id)

    isResizing.current = true
    resizeStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      height: area.height,
      width: area.width,
    }

    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleResizePointerMove = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isResizing.current) return

    const nextWidth =
      resizeStart.current.width +
      (e.clientX - resizeStart.current.pointerX) / canvasZoom
    const nextHeight =
      resizeStart.current.height +
      (e.clientY - resizeStart.current.pointerY) / canvasZoom
    const nextDimensions =
      isImageArea && !e.altKey
        ? resizeWithPreservedAspectRatio({
            startWidth: resizeStart.current.width,
            startHeight: resizeStart.current.height,
            nextWidth,
            nextHeight,
          })
        : {
            width: nextWidth,
            height: nextHeight,
          }

    onResize(area.id, nextDimensions.width, nextDimensions.height, e.altKey)
  }

  const handleResizePointerEnd = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    isResizing.current = false

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleInput = (
    e: React.FormEvent<HTMLDivElement>
  ) => {
    const editable = e.currentTarget

    if (!canEditText) return

    onTextChange(area.id, getEditableText(editable))
    syncCaret(editable)
    syncTextLayerHeight(editable)
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.blur()
      onDeselect()
      return
    }

    if (e.key === 'Enter' && activeImageCommand) {
      e.preventDefault()
      onCommitImageCommand(area.id, activeImageCommand)
      return
    }

    if (e.key === 'Enter' && activeEvidenceCommand) {
      e.preventDefault()
      onCommitEvidenceCommand(area.id, activeEvidenceCommand)
      return
    }

    if (e.key !== 'Enter' || !activeCommand?.propertyIsValid) {
      return
    }

    e.preventDefault()

    if (!activeCommand.declarationIsValid) return

    onCommitCssCommand(area.id, activeCommand)

    requestAnimationFrame(() => {
      if (editableRef.current) {
        setEditableCaretIndex(
          editableRef.current,
          activeCommand.start
        )
      }
      setCaretIndex(activeCommand.start)
    })
  }

  return (
    <div
      ref={shellRef}
      className="area-shell"
      style={{
        position: 'absolute',
        left: area.x,
        top: area.y,
        height: area.height,
        width: area.width,
        zIndex: getAreaShellZIndex(isSelected, nestingDepth),
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect(area.id)
      }}
    >
      <div
        ref={areaRef}
        className={`area${isSelected ? ' area--selected' : ''}${
          isReadOnly ? ' area--read-only' : ''
        }${isDragging ? ' area--is-dragging' : ''}${
          isNestingTarget ? ' area--nesting-target' : ''
        }${isUnnestingSource ? ' area--unnesting-source' : ''}${
          isLinkTarget ? ' area--link-target' : ''
        }`}
      >
        {evidence.length > 0 && (
          <EvidenceChips
            areaId={area.id}
            evidence={evidence}
            isReadOnly={isReadOnly}
            isSelected={isSelected}
            onRemoveEvidence={onRemoveEvidence}
          />
        )}
        {!isReadOnly && (
          <>
            <div className="area-toolbar-bridge" aria-hidden="true" />
            {(
              ['top', 'right', 'bottom', 'left'] as AreaLinkSide[]
            ).map((side) => (
              <div
                aria-label={`Start connector from ${side} edge`}
                className={`area-link-zone area-link-zone--${side}`}
                key={side}
                onPointerCancel={handleLinkZonePointerCancel}
                onPointerDown={handleLinkZonePointerDown(side)}
                onPointerMove={handleLinkZonePointerMove}
                onPointerUp={handleLinkZonePointerEnd}
              />
            ))}

            <div
              aria-label="Move area"
              className="draggy"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <GripIcon />
            </div>

            <div className="area-actions">
              {isImageArea && (
                <>
                  <button
                    aria-label="Replace image"
                    className="area-action-button area-action-button--priority-extra"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onReplaceImage(area.id)
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <ReplaceIcon />
                  </button>
                  <button
                    aria-label="Edit image alt text"
                    className="area-action-button area-action-button--priority-extra"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      editImageAltText()
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <AltTextIcon />
                  </button>
                </>
              )}
              <button
                aria-label="Open Area styles"
                className="area-action-button area-action-button--priority-low"
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onOpenStyles(area.id)
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
              >
                <StyleSlidersIcon />
              </button>
              <button
                aria-label="Connect area"
                className="area-action-button area-action-button--priority-low"
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onOpenLinkDialog(area.id)
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
              >
                <LinkIcon />
              </button>
              <button
                aria-label="Duplicate area"
                className="area-action-button area-action-button--priority-medium"
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDuplicate(area.id)
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
              >
                <DuplicateIcon />
              </button>
              <button
                aria-label="Delete area"
                className="area-action-button area-action-button--danger"
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(area.id)
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
              >
                <TrashIcon />
              </button>
            </div>

            <div
              aria-label="Resize area"
              className="area-resize-handle"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerEnd}
              onPointerCancel={handleResizePointerEnd}
            />
          </>
        )}

        {isImageArea ? (
          <div className="area-image-frame">
            <img
              alt={area.alt}
              className="area-image"
              draggable="false"
              src={imageSource}
            />
            {isGifArea && isSelected && !isReadOnly && (
              <button
                className="area-gif-toggle"
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setGifPlaybackOverride(
                    shouldShowGifStill ? 'play' : 'pause'
                  )
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {shouldShowGifStill ? 'Play GIF' : 'Pause GIF'}
              </button>
            )}
          </div>
        ) : (
          <div
            className="area-editor"
            style={{ height: textLayerHeight }}
          >
            <div className="area-highlight" aria-hidden="true">
              {renderHighlightedText(
                area.text,
                highlightedCommand,
                highlightedCommandIsInvalid
              )}
            </div>

            <div
              ref={editableRef}
              aria-label="Area text"
              aria-multiline="true"
              className="area-editable"
              contentEditable={isReadOnly ? false : 'plaintext-only'}
              data-placeholder={
                isReadOnly
                  ? ''
                  : 'Start typing, /style, or /ref src/App.tsx'
              }
              role="textbox"
              suppressContentEditableWarning
              tabIndex={0}
              onFocus={(e) => {
                onSelect(area.id)
                syncCaret(e.currentTarget)
              }}
              onClick={(e) => syncCaret(e.currentTarget)}
              onKeyUp={(e) => syncCaret(e.currentTarget)}
              onSelect={(e) => syncCaret(e.currentTarget)}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

const EvidenceChips = ({
  areaId,
  evidence,
  isReadOnly,
  isSelected,
  onRemoveEvidence,
}: {
  areaId: string
  evidence: AreaEvidenceReference[]
  isReadOnly: boolean
  isSelected: boolean
  onRemoveEvidence: (areaId: string, evidenceId: string) => void
}) => (
  <div className="area-evidence" aria-label="Area evidence">
    {evidence.map((reference) => (
      <span className="area-evidence-chip" key={reference.id}>
        {reference.kind === 'url' ? (
          <a
            href={reference.target}
            rel="noreferrer"
            target="_blank"
            title={reference.target}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {getAreaEvidenceLabel(reference)}
          </a>
        ) : (
          <button
            type="button"
            title={reference.target}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void navigator.clipboard?.writeText(reference.target)
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {getAreaEvidenceLabel(reference)}
          </button>
        )}
        {!isReadOnly && isSelected && (
          <button
            aria-label={`Remove evidence ${getAreaEvidenceLabel(reference)}`}
            className="area-evidence-remove"
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRemoveEvidence(areaId, reference.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            x
          </button>
        )}
      </span>
    ))}
  </div>
)

const GripIcon = () => (
  <svg
    aria-hidden="true"
    className="area-control-icon area-control-icon--grip"
    focusable="false"
    viewBox="0 0 16 16"
  >
    <circle cx="5" cy="4" r="1.2" />
    <circle cx="11" cy="4" r="1.2" />
    <circle cx="5" cy="8" r="1.2" />
    <circle cx="11" cy="8" r="1.2" />
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="11" cy="12" r="1.2" />
  </svg>
)

const DuplicateIcon = () => (
  <svg
    aria-hidden="true"
    className="area-control-icon area-control-icon--stroke"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 16 16"
  >
    <rect height="8" rx="1.5" width="8" x="5" y="3" />
    <path d="M3 6.5v5A1.5 1.5 0 0 0 4.5 13h5" />
  </svg>
)

const ReplaceIcon = () => (
  <svg
    aria-hidden="true"
    className="area-control-icon area-control-icon--stroke"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 16 16"
  >
    <path d="M4.2 5.2A4.5 4.5 0 0 1 11.7 4" />
    <path d="M11.7 4V2.2" />
    <path d="M11.7 4H9.9" />
    <path d="M11.8 10.8A4.5 4.5 0 0 1 4.3 12" />
    <path d="M4.3 12v1.8" />
    <path d="M4.3 12h1.8" />
  </svg>
)

const AltTextIcon = () => (
  <svg
    aria-hidden="true"
    className="area-control-icon area-control-icon--stroke"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 16 16"
  >
    <path d="M3 12.5 6.8 3.5 10.5 12.5" />
    <path d="M4.5 9.2H9" />
    <path d="M12 6.5v6" />
    <path d="M10.8 12.5h2.4" />
  </svg>
)

const StyleSlidersIcon = () => (
  <svg
    aria-hidden="true"
    className="area-control-icon area-control-icon--stroke"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 16 16"
  >
    <path d="M3 4.5h10" />
    <path d="M3 11.5h10" />
    <path d="M6 2.8v3.4" />
    <path d="M10 9.8v3.4" />
    <circle cx="6" cy="4.5" r="1.5" />
    <circle cx="10" cy="11.5" r="1.5" />
  </svg>
)

const LinkIcon = () => (
  <svg
    aria-hidden="true"
    className="area-control-icon area-control-icon--stroke"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 16 16"
  >
    <path d="M6.7 5.3 5.4 4A2.4 2.4 0 0 0 2 7.4l1.3 1.3" />
    <path d="M9.3 10.7 10.6 12A2.4 2.4 0 0 0 14 8.6l-1.3-1.3" />
    <path d="M5.8 10.2 10.2 5.8" />
  </svg>
)

const TrashIcon = () => (
  <svg
    aria-hidden="true"
    className="area-control-icon area-control-icon--stroke"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 16 16"
  >
    <path d="M3.5 5h9" />
    <path d="M6.5 5V3.7A1.2 1.2 0 0 1 7.7 2.5h.6a1.2 1.2 0 0 1 1.2 1.2V5" />
    <path d="M5 5l.5 7.2a1.4 1.4 0 0 0 1.4 1.3h2.2a1.4 1.4 0 0 0 1.4-1.3L11 5" />
    <path d="M7.2 7.2v4" />
    <path d="M8.8 7.2v4" />
  </svg>
)

const getEditableText = (editable: HTMLDivElement) => {
  const text = editable.innerText
  const hasTrailingBlankLine =
    /<(div|p)><br><\/\1>$/i.test(editable.innerHTML)

  return hasTrailingBlankLine ? text.slice(0, -1) : text
}

const getEditableCaretIndex = (editable: HTMLDivElement) => {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) return 0

  const range = selection.getRangeAt(0)

  if (!editable.contains(range.startContainer)) {
    return getEditableText(editable).length
  }

  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(editable)
  preCaretRange.setEnd(range.startContainer, range.startOffset)

  return preCaretRange.toString().length
}

const setEditableCaretIndex = (
  editable: HTMLDivElement,
  caretIndex: number
) => {
  const selection = window.getSelection()

  if (!selection) return

  const range = document.createRange()
  const walker = document.createTreeWalker(
    editable,
    NodeFilter.SHOW_TEXT
  )
  let remainingCharacters = caretIndex
  let currentNode = walker.nextNode()

  while (currentNode) {
    const textLength = currentNode.textContent?.length ?? 0

    if (remainingCharacters <= textLength) {
      range.setStart(currentNode, remainingCharacters)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      return
    }

    remainingCharacters -= textLength
    currentNode = walker.nextNode()
  }

  range.selectNodeContents(editable)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

const renderHighlightedText = (
  text: string,
  command:
    | Pick<CssSlashCommand, 'start' | 'end'>
    | Pick<GifSlashCommand, 'start' | 'end'>
    | Pick<EvidenceSlashCommandCandidate, 'start' | 'end'>
    | null,
  isInvalid = false
): ReactNode => {
  if (!command) return text || '\u200b'
  const highlightClassName = `area-command-highlight${
    isInvalid ? ' area-command-highlight--invalid' : ''
  }`

  return (
    <>
      {text.slice(0, command.start)}
      <mark className={highlightClassName}>
        {text.slice(command.start, command.end)}
      </mark>
      {text.slice(command.end) || '\u200b'}
    </>
  )
}

export default Area
