export type CanvasPointerAction =
  | 'close-link-flyout'
  | 'create-area'
  | 'deselect'
  | 'ignore'

export const getCanvasPointerAction = ({
  hasLinkFlyout,
  hasSelectedArea,
  hasSelectedLink,
  isInsideSelectedArea = false,
  isCanvasSurfaceTarget,
  isReadOnly = false,
  isToggleModifier = false,
}: {
  hasLinkFlyout: boolean
  hasSelectedArea: boolean
  hasSelectedLink: boolean
  isInsideSelectedArea?: boolean
  isCanvasSurfaceTarget: boolean
  isReadOnly?: boolean
  isToggleModifier?: boolean
}): CanvasPointerAction => {
  if (isReadOnly) return 'ignore'
  if (hasSelectedArea) {
    if (isToggleModifier && !isCanvasSurfaceTarget) {
      return 'ignore'
    }

    return isInsideSelectedArea ? 'ignore' : 'deselect'
  }
  if (!isCanvasSurfaceTarget) return 'ignore'
  if (hasLinkFlyout) return 'close-link-flyout'
  if (hasSelectedLink) return 'deselect'

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
