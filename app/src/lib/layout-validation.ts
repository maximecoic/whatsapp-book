export type LayoutIssueKind =
  | 'page-overflow'
  | 'content-overflow'
  | 'element-outside-page'
  | 'image-outside-frame'
  | 'image-frame-collapsed'
  | 'image-not-loaded'
  | 'image-cropped'

export interface LayoutIssue {
  page: number
  kind: LayoutIssueKind
}

export interface LayoutReport {
  valid: boolean
  pageCount: number
  imageCount: number
  issues: LayoutIssue[]
}

export interface RectBounds {
  top: number
  right: number
  bottom: number
  left: number
}

export function isRectContained(
  inner: RectBounds,
  outer: RectBounds,
  tolerance = 1,
): boolean {
  return (
    inner.top >= outer.top - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.bottom <= outer.bottom + tolerance &&
    inner.left >= outer.left - tolerance
  )
}

function overflows(element: HTMLElement, tolerance = 1): boolean {
  return (
    element.scrollHeight > element.clientHeight + tolerance ||
    element.scrollWidth > element.clientWidth + tolerance
  )
}

export function inspectPrintLayout(root: HTMLElement): LayoutReport {
  const pages = Array.from(root.querySelectorAll<HTMLElement>('.print-page'))
  const issues: LayoutIssue[] = []
  const seenIssues = new Set<string>()
  let imageCount = 0

  const addIssue = (page: number, kind: LayoutIssueKind) => {
    const key = `${page}:${kind}`
    if (seenIssues.has(key)) return
    seenIssues.add(key)
    issues.push({ page, kind })
  }

  pages.forEach((pageElement, index) => {
    const pageNumber = index + 1
    const pageRect = pageElement.getBoundingClientRect()
    if (overflows(pageElement)) addIssue(pageNumber, 'page-overflow')

    const coverCopy = pageElement.querySelector<HTMLElement>('.cover-copy')
    if (coverCopy && overflows(coverCopy)) addIssue(pageNumber, 'content-overflow')
    pageElement
      .querySelectorAll<HTMLElement>(
        '.book-editorial-page, .book-editorial-copy, .book-table-of-contents, .composition-item',
      )
      .forEach((element) => {
        if (overflows(element)) addIssue(pageNumber, 'content-overflow')
      })

    pageElement
      .querySelectorAll<HTMLElement>(
        '.book-chapter, .book-chapter > *, .book-date, .book-message, .message-meta, .message-copy, .message-copy p, .message-photo, .message-photo figcaption, .cover-copy > *, .book-editorial-page > *, .book-editorial-copy > *, .book-table-of-contents li',
      )
      .forEach((element) => {
        if (!isRectContained(element.getBoundingClientRect(), pageRect)) {
          addIssue(pageNumber, 'element-outside-page')
        }
      })

    pageElement
      .querySelectorAll<HTMLImageElement>('.cover-image img, .photo-frame img')
      .forEach((image) => {
        imageCount += 1
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
          addIssue(pageNumber, 'image-not-loaded')
        }
        const frame = image.closest<HTMLElement>('.cover-image, .photo-frame')
        const allowsCrop = frame?.dataset.photoFit === 'cover'
        if (getComputedStyle(image).objectFit !== 'contain' && !allowsCrop) {
          addIssue(pageNumber, 'image-cropped')
        }

        const frameRect = frame?.getBoundingClientRect()
        if (frameRect && (frameRect.width < 24 || frameRect.height < 24)) {
          addIssue(pageNumber, 'image-frame-collapsed')
        }
        if (
          !frame ||
          !frameRect ||
          !isRectContained(image.getBoundingClientRect(), frameRect) ||
          !isRectContained(frameRect, pageRect)
        ) {
          addIssue(pageNumber, 'image-outside-frame')
        }
      })
  })

  return {
    valid: issues.length === 0,
    pageCount: pages.length,
    imageCount,
    issues,
  }
}