export type CanvasPointerAction =
  | 'close-link-flyout'
  | 'create-area'
  | 'deselect'
  | 'ignore'

export const getCanvasPointerAction = ({
  hasLinkFlyout,
  hasSelectedArea,
  hasSelectedLink,
  isCanvasWorldTarget,
  isReadOnly = false,
}: {
  hasLinkFlyout: boolean
  hasSelectedArea: boolean
  hasSelectedLink: boolean
  isCanvasWorldTarget: boolean
  isReadOnly?: boolean
}): CanvasPointerAction => {
  if (isReadOnly || !isCanvasWorldTarget) return 'ignore'
  if (hasLinkFlyout) return 'close-link-flyout'
  if (hasSelectedArea || hasSelectedLink) return 'deselect'

  return 'create-area'
}
