export type CanvasPointerAction =
  | 'close-link-flyout'
  | 'create-area'
  | 'deselect'
  | 'ignore'

export const getCanvasPointerAction = ({
  hasLinkFlyout,
  hasSelectedArea,
  hasSelectedLink,
  isCanvasSurfaceTarget,
  isReadOnly = false,
}: {
  hasLinkFlyout: boolean
  hasSelectedArea: boolean
  hasSelectedLink: boolean
  isCanvasSurfaceTarget: boolean
  isReadOnly?: boolean
}): CanvasPointerAction => {
  if (isReadOnly || !isCanvasSurfaceTarget) return 'ignore'
  if (hasLinkFlyout) return 'close-link-flyout'
  if (hasSelectedArea || hasSelectedLink) return 'deselect'

  return 'create-area'
}

export const isBlankCanvasPointerSurface = (
  targetId: string,
  targetClassName: string
) => {
  if (targetId === 'canvas') return true

  const classNames = targetClassName.split(/\s+/)

  return (
    classNames.includes('canvas-scroll-size') ||
    classNames.includes('canvas-world')
  )
}
