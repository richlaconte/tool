export type AspectRatioResizeInput = {
  startWidth: number
  startHeight: number
  nextWidth: number
  nextHeight: number
}

export const resizeWithPreservedAspectRatio = ({
  nextHeight,
  nextWidth,
  startHeight,
  startWidth,
}: AspectRatioResizeInput) => {
  if (startWidth <= 0 || startHeight <= 0) {
    return {
      width: nextWidth,
      height: nextHeight,
    }
  }

  const widthScale = nextWidth / startWidth
  const heightScale = nextHeight / startHeight
  const scale =
    Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
      ? widthScale
      : heightScale

  return {
    width: startWidth * scale,
    height: startHeight * scale,
  }
}
