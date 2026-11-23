import type { PhotoRotation } from './book-model'

export function getPdfCoverImageBox(
  width: number,
  height: number,
  rotation: PhotoRotation,
) {
  const swapsDimensions = rotation === 90 || rotation === 270
  const imageWidth = swapsDimensions ? height : width
  const imageHeight = swapsDimensions ? width : height
  return {
    position: 'absolute' as const,
    width: imageWidth,
    height: imageHeight,
    left: (width - imageWidth) / 2,
    top: (height - imageHeight) / 2,
    transform: `rotate(${rotation}deg)`,
  }
}