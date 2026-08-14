const CSS_PIXELS_PER_INCH = 96

export type PhotoQualityStatus =
  | 'excellent'
  | 'acceptable'
  | 'insufficient'
  | 'unavailable'

export interface PhotoPrintMetrics {
  naturalWidth: number
  naturalHeight: number
  boxWidth: number
  boxHeight: number
  objectFit: string
}

export interface PhotoQualityEntry {
  mediaName: string
  messageId: string | null
  context: 'cover' | 'back-cover' | 'content'
  page: number
  naturalWidth: number
  naturalHeight: number
  printWidthMm: number
  printHeightMm: number
  dpi: number | null
  status: PhotoQualityStatus
}

export interface PhotoPreflightReport {
  pageCount: number
  photoCount: number
  counts: Record<PhotoQualityStatus, number>
  entries: PhotoQualityEntry[]
}

export function calculateEffectiveDpi(
  metrics: PhotoPrintMetrics,
): { dpi: number; printWidthMm: number; printHeightMm: number } | null {
  const {
    naturalWidth,
    naturalHeight,
    boxWidth,
    boxHeight,
    objectFit,
  } = metrics
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    boxWidth <= 0 ||
    boxHeight <= 0
  ) {
    return null
  }

  const widthScale = boxWidth / naturalWidth
  const heightScale = boxHeight / naturalHeight
  const scale = objectFit === 'cover'
    ? Math.max(widthScale, heightScale)
    : Math.min(widthScale, heightScale)
  const renderedWidth = naturalWidth * scale
  const renderedHeight = naturalHeight * scale
  const printWidthInches = renderedWidth / CSS_PIXELS_PER_INCH
  const printHeightInches = renderedHeight / CSS_PIXELS_PER_INCH
  const dpi = Math.min(
    naturalWidth / printWidthInches,
    naturalHeight / printHeightInches,
  )
  const visibleWidthInches = objectFit === 'cover'
    ? boxWidth / CSS_PIXELS_PER_INCH
    : printWidthInches
  const visibleHeightInches = objectFit === 'cover'
    ? boxHeight / CSS_PIXELS_PER_INCH
    : printHeightInches

  return {
    dpi: Math.round(dpi),
    printWidthMm: Number((visibleWidthInches * 25.4).toFixed(1)),
    printHeightMm: Number((visibleHeightInches * 25.4).toFixed(1)),
  }
}

export function classifyPhotoQuality(dpi: number | null): PhotoQualityStatus {
  if (dpi === null || !Number.isFinite(dpi)) return 'unavailable'
  if (dpi >= 300) return 'excellent'
  if (dpi >= 180) return 'acceptable'
  return 'insufficient'
}

export function inspectPhotoQuality(root: HTMLElement): PhotoPreflightReport {
  const pages = Array.from(root.querySelectorAll<HTMLElement>('.print-page'))
  const entries: PhotoQualityEntry[] = []

  pages.forEach((pageElement, pageIndex) => {
    pageElement
      .querySelectorAll<HTMLElement>('[data-media-name][data-media-context]')
      .forEach((container) => {
        const mediaName = container.dataset.mediaName
        const context = container.dataset.mediaContext
        if (
          !mediaName ||
          (context !== 'cover' && context !== 'back-cover' && context !== 'content')
        ) return

        const image = container.querySelector<HTMLImageElement>('img')
        const box = container.getBoundingClientRect()
        const rotation = Number(container.dataset.photoRotation ?? 0)
        const swapsDimensions = rotation === 90 || rotation === 270
        const measurement = image
          ? calculateEffectiveDpi({
            naturalWidth: swapsDimensions ? image.naturalHeight : image.naturalWidth,
            naturalHeight: swapsDimensions ? image.naturalWidth : image.naturalHeight,
            boxWidth: box.width,
            boxHeight: box.height,
            objectFit: getComputedStyle(image).objectFit,
          })
          : null

        entries.push({
          mediaName,
          messageId: container.dataset.messageId ?? null,
          context,
          page: pageIndex + 1,
          naturalWidth: image
            ? swapsDimensions ? image.naturalHeight : image.naturalWidth
            : 0,
          naturalHeight: image
            ? swapsDimensions ? image.naturalWidth : image.naturalHeight
            : 0,
          printWidthMm: measurement?.printWidthMm ?? 0,
          printHeightMm: measurement?.printHeightMm ?? 0,
          dpi: measurement?.dpi ?? null,
          status: classifyPhotoQuality(measurement?.dpi ?? null),
        })
      })
  })

  const counts: Record<PhotoQualityStatus, number> = {
    excellent: 0,
    acceptable: 0,
    insufficient: 0,
    unavailable: 0,
  }
  entries.forEach((entry) => {
    counts[entry.status] += 1
  })

  return {
    pageCount: pages.length,
    photoCount: entries.length,
    counts,
    entries,
  }
}