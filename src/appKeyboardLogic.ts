export type AppKeyboardAction =
  | 'deselect-area'
  | 'open-command-palette'
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

  if (state.key === 'Escape') {
    return state.hasSelectedArea
      ? 'deselect-area'
      : 'open-command-palette'
  }

  if (state.hasSelectedArea || state.isEditableTarget) {
    return 'ignore'
  }

  if (state.key.length === 1 && !state.hasModifier) {
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
