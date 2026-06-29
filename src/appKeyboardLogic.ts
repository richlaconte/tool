export type AppKeyboardAction =
  | 'deselect-area'
  | 'open-command-palette'
  | 'open-empty-command-palette'
  | 'close-command-palette'
  | 'ignore'

export type DialogKeyboardAction = 'close-dialog' | 'ignore'

type AppKeyboardState = {
  key: string
  hasSelectedArea: boolean
  isCommandPaletteOpen: boolean
  isDialogOpen: boolean
  isEditableTarget: boolean
  isCommandPaletteTarget?: boolean
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
    (normalizedKey === 'k' ||
      (normalizedKey === 'p' && hasShiftModifier))
  ) {
    return 'open-empty-command-palette'
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
