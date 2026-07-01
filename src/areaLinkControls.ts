const MIN_EDIT_BUTTON_OFFSET = 54
const MAX_EDIT_BUTTON_OFFSET = 160
const LABEL_CHARACTER_OFFSET = 3.4
const LABEL_BUTTON_GAP = 28

export const getAreaLinkEditButtonOffset = (label: string) => {
  const estimatedOffset = Math.ceil(
    label.trim().length * LABEL_CHARACTER_OFFSET + LABEL_BUTTON_GAP
  )

  return Math.max(
    MIN_EDIT_BUTTON_OFFSET,
    Math.min(MAX_EDIT_BUTTON_OFFSET, estimatedOffset)
  )
}
