import type { PhotoOverride } from './book-model'
import type { ChatMessage } from './chat-types'
import { showMediaCaption } from './video-frame'

export type DesignedComposition = 'gazette' | 'photo-story' | 'collage'

export interface CompositionOptions {
  theme: DesignedComposition
  widthMm: number
  heightMm: number
  fontScale: number
  lineHeight: number
  photoOverrides: PhotoOverride[]
  photoAspectRatios?: Record<string, number>
  chapterTitle?: string
}

export interface CompositionItem {
  message: ChatMessage
  index: number
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  photoHeightMm: number
  rotation: number
}

export function isDesignedComposition(theme: string): theme is DesignedComposition {
  return theme === 'gazette' || theme === 'photo-story' || theme === 'collage'
}

export function getCompositionMetrics(options: CompositionOptions) {
  const marginMm = options.theme === 'collage' ? 9 : 10
  const headerMm = options.theme === 'gazette' ? 22 : options.theme === 'collage' ? (options.chapterTitle ? 20 : 0) : 17
  const headerGapMm = options.theme === 'collage' && !options.chapterTitle ? 0 : 3
  const widthMm = options.widthMm - marginMm * 2
  const heightMm = options.heightMm - marginMm * 2 - headerMm - 6 -
    (options.theme === 'collage' ? headerGapMm : 0)
  const gapMm = options.theme === 'collage' ? 4 : 6
  const fontPt = (options.theme === 'photo-story' ? 10 : 9) * options.fontScale
  const lineMm = fontPt * 25.4 / 72 * options.lineHeight
  const tilePaddingMm = options.theme === 'collage' ? 2.5 : 0
  return { marginMm, headerMm, headerGapMm, widthMm, heightMm, gapMm, fontPt, lineMm, tilePaddingMm }
}

function lineCount(body: string, widthMm: number, fontPt: number): number {
  const characters = Math.max(10, Math.floor(widthMm / (fontPt * 25.4 / 72 * 0.56)))
  return body.split('\n').reduce((total, line) => (
    total + Math.max(1, Math.ceil(line.length / characters))
  ), 0)
}

export function getCompositionLineWidth(options: CompositionOptions): number {
  const metrics = getCompositionMetrics(options)
  const width = options.theme === 'photo-story'
    ? metrics.widthMm - 22
    : (metrics.widthMm - metrics.gapMm) / 2 - (options.theme === 'collage' ? metrics.tilePaddingMm * 2 : 0)
  return Math.max(10, Math.floor(width / (metrics.fontPt * 25.4 / 72 * 0.56)))
}

export function getCompositionPhotoHeight(options: CompositionOptions, widthMm: number): number {
  const metrics = getCompositionMetrics(options)
  return options.theme === 'photo-story'
    ? Math.min(92, metrics.heightMm * 0.55)
    : Math.min(widthMm * (options.theme === 'collage' ? 0.85 : 0.72), metrics.heightMm * 0.55)
}

function layoutPhotoCollage(messages: ChatMessage[], options: CompositionOptions) {
  const metrics = getCompositionMetrics(options)
  const { widthMm, heightMm, gapMm, tilePaddingMm, fontPt, lineMm } = metrics
  const overrideFor = (message: ChatMessage) => options.photoOverrides.find((override) => (
    override.messageId === (message.sourceMessageId ?? message.id)
  ))
  const aspectFor = (message: ChatMessage) => {
    const stored = message.mediaName ? options.photoAspectRatios?.[message.mediaName] : undefined
    const ratio = stored && Number.isFinite(stored) && stored > 0 ? stored : 4 / 3
    const rotation = overrideFor(message)?.rotation ?? 0
    return rotation === 90 || rotation === 270 ? 1 / ratio : ratio
  }
  const patterns: ChatMessage[][][] = []
  const collectRows = (offset: number, rows: ChatMessage[][]) => {
    if (offset === messages.length) {
      patterns.push(rows)
      return
    }
    if (!messages[offset].mediaName) {
      collectRows(offset + 1, [...rows, [messages[offset]]])
      return
    }
    for (let count = 1; count <= Math.min(3, messages.length - offset); count += 1) {
      const row = messages.slice(offset, offset + count)
      if (row.some((message) => !message.mediaName)) break
      if (count > 1 && row.some((message) => overrideFor(message)?.layout === 'wide')) continue
      collectRows(offset + count, [...rows, row])
    }
  }
  collectRows(0, [])
  let best: { items: CompositionItem[]; rows: number[]; score: number; fits: boolean } | null = null
  for (const rows of patterns) {
    const rowMetrics = rows.map((row) => {
      if (!row[0].mediaName) return { naturalHeight: 0, fixedWidth: false }
      const ratioSum = row.reduce((total, message) => total + aspectFor(message), 0)
      const singleHalf = row.length === 1 && overrideFor(row[0])?.layout === 'half'
      const rowWidth = singleHalf ? (widthMm - gapMm) / 2 : widthMm
      const imageWidth = rowWidth - (row.length - 1) * gapMm - row.length * tilePaddingMm * 2
      const fixedWidth = row.some((message) => overrideFor(message)?.layout === 'wide')
      const caption = showMediaCaption(row[0].mediaName, overrideFor(row[0])?.showCaption) ? row[0].body : ''
      const captionHeight = caption
        ? lineCount(caption, (widthMm - gapMm) / 2 - tilePaddingMm * 2, fontPt) * lineMm + 2
        : 0
      return {
        naturalHeight: fixedWidth
          ? Math.min(imageWidth / ratioSum, Math.max(0, heightMm - 8 - tilePaddingMm * 2 - captionHeight))
          : imageWidth / ratioSum,
        fixedWidth,
      }
    })
    const buildRows = (scale: number) => {
      const items: CompositionItem[] = []
      const areas: number[] = []
      let vertical = 0
      rows.forEach((row, rowIndex) => {
        const isPhoto = Boolean(row[0].mediaName)
        const rowMetric = rowMetrics[rowIndex]
        const imageHeight = rowMetric.naturalHeight * (rowMetric.fixedWidth ? 1 : scale)
        const widths = row.map((message) => isPhoto
          ? imageHeight * aspectFor(message) + tilePaddingMm * 2
          : widthMm)
        const rowWidth = widths.reduce((total, width) => total + width, 0) + (row.length - 1) * gapMm
        const overhead = Math.max(...row.map((message, index) => {
          const caption = showMediaCaption(message.mediaName, overrideFor(message)?.showCaption) ? message.body : ''
          return 8 + tilePaddingMm * 2 + (caption
            ? lineCount(caption, widths[index] - tilePaddingMm * 2, fontPt) * lineMm + (isPhoto ? 2 : 0)
            : 0)
        }))
        const rowHeight = imageHeight + overhead
        let left = (widthMm - rowWidth) / 2
        row.forEach((message, columnIndex) => {
          if (isPhoto) areas.push(imageHeight * imageHeight * aspectFor(message))
          items.push({
            message,
            index: messages.indexOf(message),
            xMm: left,
            yMm: vertical,
            widthMm: widths[columnIndex],
            heightMm: rowHeight,
            photoHeightMm: imageHeight,
            rotation: isPhoto ? (messages.indexOf(message) % 2 ? 0.6 : -0.6) : 0,
          })
          left += widths[columnIndex] + gapMm
        })
        vertical += rowHeight + gapMm
      })
      return { items, areas, height: Math.max(0, vertical - gapMm) }
    }
    let lower = 0
    let upper = 1
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const middle = (lower + upper) / 2
      if (buildRows(middle).height <= heightMm) lower = middle
      else upper = middle
    }
    const scale = buildRows(1).height <= heightMm ? 1 : lower
    const { items, areas, height } = buildRows(scale)
    const fits = height <= heightMm + 0.01 && rowMetrics.every((row) => (
      row.naturalHeight === 0 || row.naturalHeight * (row.fixedWidth ? 1 : scale) >= Math.min(16, row.naturalHeight) - 0.01
    ))
    const totalArea = areas.reduce((total, area) => total + area, 0)
    const balance = areas.length ? Math.min(...areas) / Math.max(...areas) : 1
    const score = totalArea * (0.75 + balance * 0.25)
    if (!best || (fits && !best.fits) || (fits === best.fits && score > best.score)) {
      best = { items, rows: rows.filter((row) => row[0].mediaName).map((row) => row.length), score, fits }
    }
  }
  return {
    ...metrics,
    items: best?.items ?? [],
    fullPagePhoto: false,
    photoRows: best?.rows ?? [],
    fits: best?.fits ?? false,
  }
}

export function layoutCompositionPage(
  messages: ChatMessage[],
  options: CompositionOptions,
) {
  options = { ...options, chapterTitle: messages[0]?.chapterTitle }
  const metrics = getCompositionMetrics(options)
  const columns = [0, 0]
  let column = 0
  const fullPagePhoto = messages.length === 1 && Boolean(messages[0].mediaName) &&
    options.photoOverrides.some((override) => (
      override.messageId === (messages[0].sourceMessageId ?? messages[0].id) &&
      override.layout === 'full-page'
    ))
  if (options.theme === 'collage' && !fullPagePhoto) return layoutPhotoCollage(messages, options)
  const items = messages.map((message, index): CompositionItem => {
    const override = options.photoOverrides.find((candidate) => (
      candidate.messageId === (message.sourceMessageId ?? message.id)
    ))
    const isStory = options.theme === 'photo-story'
    const isCollage = options.theme === 'collage'
    const spansColumns = !isStory && Boolean(message.mediaName) && override?.layout === 'wide'
    const tilePadding = metrics.tilePaddingMm
    const tileWidth = fullPagePhoto || spansColumns
      ? metrics.widthMm
      : isStory
        ? metrics.widthMm - 22
        : (metrics.widthMm - metrics.gapMm) / 2
    const contentWidth = tileWidth - tilePadding * 2
    let photoHeightMm = message.mediaName
      ? fullPagePhoto
        ? Math.max(20, metrics.heightMm - 20)
        : getCompositionPhotoHeight(options, contentWidth)
      : 0
    const body = showMediaCaption(message.mediaName, override?.showCaption) ? message.body : ''
    const textHeight = body
      ? lineCount(body, contentWidth, metrics.fontPt) * metrics.lineMm
      : 0
    if (fullPagePhoto) {
      photoHeightMm = Math.max(12, metrics.heightMm - 11 - tilePadding * 2 - textHeight - (body ? 2 : 0))
    }
    const heightMm = 11 + tilePadding * 2 + photoHeightMm + textHeight +
      (message.mediaName && body ? 2 : 0)
    if (options.theme === 'gazette' && columns[column] > 0 &&
      columns[column] + heightMm > metrics.heightMm && column === 0) {
      column = 1
    }
    if (isCollage) column = columns[0] <= columns[1] ? 0 : 1
    const xMm = fullPagePhoto || spansColumns ? 0 : isStory ? 22 : column * (tileWidth + metrics.gapMm)
    const yMm = spansColumns ? Math.max(...columns) : isStory ? columns[0] : columns[column]
    if (spansColumns) {
      columns[0] = yMm + heightMm + metrics.gapMm
      columns[1] = columns[0]
      column = 0
    } else if (isStory) columns[0] += heightMm + metrics.gapMm
    else columns[column] += heightMm + metrics.gapMm
    return {
      message,
      index,
      xMm,
      yMm,
      widthMm: tileWidth,
      heightMm,
      photoHeightMm,
      rotation: isCollage && message.mediaName && !fullPagePhoto ? (index % 2 ? 1.5 : -1.5) : 0,
    }
  })
  return {
    ...metrics,
    items,
    fullPagePhoto,
    photoRows: [] as number[],
    fits: columns.every((height) => height - metrics.gapMm <= metrics.heightMm + 0.01),
  }
}