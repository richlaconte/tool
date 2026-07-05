export type AppKeyboardAction =
  | 'deselect-area'
  | 'select-all-areas'
  | 'undo'
  | 'redo'
  | 'open-keyboard-shortcuts'
  | 'open-command-palette'
  | 'open-empty-command-palette'
  | 'open-search-palette'
  | 'close-command-palette'
  | 'ignore'

export type DialogKeyboardAction = 'close-dialog' | 'ignore'
export type CanvasKeyboardAction =
  | 'nudge-up'
  | 'nudge-right'
  | 'nudge-down'
  | 'nudge-left'
  | 'resize-up'
  | 'resize-right'
  | 'resize-down'
  | 'resize-left'
  | 'ignore'

type AppKeyboardState = {
  key: string
  hasSelectedArea: boolean
  isCommandPaletteOpen: boolean
  isDialogOpen: boolean
  isEditableTarget: boolean
  isCommandPaletteTarget?: boolean
  isReadOnly?: boolean
  hasModifier?: boolean
  hasMetaOrCtrlModifier?: boolean
  hasShiftModifier?: boolean
  hasAltModifier?: boolean
}

export const getAppKeyboardAction = (
  state: AppKeyboardState
): AppKeyboardAction => {
  if (state.isDialogOpen) {
    return 'ignore'
  }

  if (state.isCommandPaletteOpen) {
    return state.key === 'Escape'
      ? 'close-command-palette'
      : 'ignore'
  }

  if (state.isCommandPaletteTarget) {
    return 'ignore'
  }

  const normalizedKey = state.key.toLowerCase()
  const hasMetaOrCtrlModifier =
    state.hasMetaOrCtrlModifier ?? false
  const hasAltModifier = state.hasAltModifier ?? false
  const hasShiftModifier = state.hasShiftModifier ?? false

  if (
    hasMetaOrCtrlModifier &&
    !hasAltModifier &&
    !hasShiftModifier &&
    normalizedKey === 'f'
  ) {
    return state.isEditableTarget ? 'ignore' : 'open-search-palette'
  }

  if (state.isReadOnly) {
    return 'ignore'
  }

  if (
    hasMetaOrCtrlModifier &&
    !hasAltModifier &&
    !state.isEditableTarget &&
    normalizedKey === 'z'
  ) {
    return hasShiftModifier ? 'redo' : 'undo'
  }

  if (
    hasMetaOrCtrlModifier &&
    !hasAltModifier &&
    !hasShiftModifier &&
    !state.isEditableTarget &&
    normalizedKey === 'y'
  ) {
    return 'redo'
  }

  if (
    hasMetaOrCtrlModifier &&
    !hasAltModifier &&
    (normalizedKey === 'k' ||
      (normalizedKey === 'p' && hasShiftModifier))
  ) {
    return 'open-empty-command-palette'
  }

  if (
    hasMetaOrCtrlModifier &&
    !hasAltModifier &&
    !hasShiftModifier &&
    normalizedKey === 'a' &&
    !state.isEditableTarget
  ) {
    return 'select-all-areas'
  }

  if (
    state.key === '?' &&
    !state.isEditableTarget &&
    !hasMetaOrCtrlModifier &&
    !hasAltModifier
  ) {
    return 'open-keyboard-shortcuts'
  }

  if (state.key === 'Escape') {
    return state.hasSelectedArea
      ? 'deselect-area'
      : 'open-command-palette'
  }

  if (state.hasSelectedArea || state.isEditableTarget) {
    return 'ignore'
  }

  const hasTextBlockingModifier =
    state.hasModifier ?? (hasMetaOrCtrlModifier || hasAltModifier)

  if (state.key.length === 1 && !hasTextBlockingModifier) {
    return 'open-command-palette'
  }

  return 'ignore'
}

export const getCanvasKeyboardAction = ({
  key,
  hasSelectedArea,
  isEditableTarget,
  hasAltModifier = false,
}: {
  key: string
  hasSelectedArea: boolean
  isEditableTarget: boolean
  hasAltModifier?: boolean
}): CanvasKeyboardAction => {
  if (!hasSelectedArea || isEditableTarget) return 'ignore'

  const prefix = hasAltModifier ? 'resize' : 'nudge'

  if (key === 'ArrowUp') return `${prefix}-up` as CanvasKeyboardAction
  if (key === 'ArrowRight') return `${prefix}-right` as CanvasKeyboardAction
  if (key === 'ArrowDown') return `${prefix}-down` as CanvasKeyboardAction
  if (key === 'ArrowLeft') return `${prefix}-left` as CanvasKeyboardAction

  return 'ignore'
}

export const getKeyboardNudgeDelta = ({
  activeSnapGridSize,
  hasShiftModifier = false,
}: {
  activeSnapGridSize?: number | null
  hasShiftModifier?: boolean
}) => {
  if (
    typeof activeSnapGridSize === 'number' &&
    Number.isFinite(activeSnapGridSize) &&
    activeSnapGridSize > 0
  ) {
    return hasShiftModifier ? activeSnapGridSize * 4 : activeSnapGridSize
  }

  return hasShiftModifier ? 10 : 1
}

export const getDialogKeyboardAction = ({
  key,
  isCommandPaletteTarget,
}: {
  key: string
  isCommandPaletteTarget: boolean
}): DialogKeyboardAction => {
  if (isCommandPaletteTarget) return 'ignore'

  return key === 'Enter' || key === 'Escape'
    ? 'close-dialog'
    : 'ignore'
}
