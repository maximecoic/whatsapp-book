import type { ChatArchive } from './archive-reader'
import { findBackCoverMedia, findCoverMedia, getPageDimensions, getPhotoOverride, type BookSettings } from './book-model'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFStream } from 'pdf-lib'
import type { ChatMessage } from './chat-types'
import type { PhotoPreflightReport } from './photo-preflight'
import { DEFAULT_VIDEO_TIME, getVideoFrame, isVideoMedia, videoFrameKey } from './video-frame'

export interface DirectPdfWorkerRequest {
  settings: BookSettings
  messages: ChatMessage[]
  pages: ChatMessage[][]
  mediaUrls: Record<string, string>
}

export type DirectPdfWorkerResponse =
  | { type: 'complete'; blob: Blob }
  | { type: 'error'; message: string }

interface GenerateDirectPdfOptions {
  archive: ChatArchive
  settings: BookSettings
  messages: ChatMessage[]
  pages: ChatMessage[][]
  onProgress?(progress: number): void
  signal?: AbortSignal
  report?: PhotoPreflightReport
}

function isPdfImage(mediaName: string): boolean {
  return /\.(?:jpe?g|png|webp|gif|avif|bmp|heic)$/i.test(mediaName)
}

export function pdfImageScale(width: number, height: number, dpi: number | null, fallbackMaxPixels: number): number {
  if (dpi !== null && Number.isFinite(dpi) && dpi > 0) return Math.min(1, 330 / dpi)
  return Math.min(1, fallbackMaxPixels / Math.max(width, height))
}

export async function inspectPdfFonts(blob: Blob): Promise<{ embedded: string[]; missing: string[] }> {
  const document = await PDFDocument.load(await blob.arrayBuffer())
  const seenResources = new Set<PDFDict>()
  const seenFonts = new Set<PDFDict>()
  const embedded: string[] = []
  const missing: string[] = []
  const name = (value: string) => PDFName.of(value)
  const inspectFont = (font: PDFDict) => {
    if (seenFonts.has(font)) return
    seenFonts.add(font)
    const fontName = font.lookupMaybe(name('BaseFont'), PDFName)?.decodeText() ?? 'Police sans nom'
    const descendants = font.lookupMaybe(name('DescendantFonts'), PDFArray)
    const baseFont = descendants?.lookupMaybe(0, PDFDict) ?? font
    const descriptor = baseFont.lookupMaybe(name('FontDescriptor'), PDFDict)
    const isEmbedded = Boolean(descriptor && ['FontFile', 'FontFile2', 'FontFile3'].some((key) => (
      descriptor.lookupMaybe(name(key), PDFStream)
    ))) || (font.lookupMaybe(name('Subtype'), PDFName)?.decodeText() === 'Type3' &&
      Boolean(font.lookupMaybe(name('CharProcs'), PDFDict)))
    if (isEmbedded) embedded.push(fontName)
    else missing.push(fontName)
  }
  const inspectResources = (resources: PDFDict | undefined) => {
    if (!resources || seenResources.has(resources)) return
    seenResources.add(resources)
    const fonts = resources.lookupMaybe(name('Font'), PDFDict)
    fonts?.keys().forEach((key) => {
      const font = fonts.lookupMaybe(key, PDFDict)
      if (font) inspectFont(font)
    })
    const objects = resources.lookupMaybe(name('XObject'), PDFDict)
    objects?.keys().forEach((key) => {
      const object = objects.lookupMaybe(key, PDFStream)
      if (object?.dict.lookupMaybe(name('Subtype'), PDFName)?.decodeText() === 'Form') {
        inspectResources(object.dict.lookupMaybe(name('Resources'), PDFDict))
      }
    })
  }
  document.getPages().forEach((page) => inspectResources(page.node.Resources()))
  return { embedded, missing }
}

async function preparePdfImage(
  source: string,
  name: string,
  settings: BookSettings,
  dpi: number | null,
  isCover: boolean,
): Promise<string> {
  const image = new Image()
  image.src = source
  try {
    await image.decode()
  } catch {
    throw new Error(`La photo « ${name} » ne peut pas être décodée pour le PDF.`)
  }
  const dimensions = getPageDimensions(settings.format, settings.orientation, settings.customSize)
  const maxPixels = Math.min(5000, Math.ceil(Math.max(dimensions.widthMm, dimensions.heightMm) / 25.4 * 300))
  const scale = pdfImageScale(image.naturalWidth, image.naturalHeight, dpi, maxPixels)
  if (/\.(?:jpe?g|png)$/i.test(name) && scale === 1 && !(isCover && /\.jpe?g$/i.test(name))) return source
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Le navigateur ne permet pas de préparer les images du PDF.')
  context.fillStyle = settings.artDirection.paperColor
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94))
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error(`La photo « ${name} » n’a pas pu être convertie pour le PDF.`)
  return URL.createObjectURL(blob)
}

export function directPdfFileName(title: string): string {
  const safeName = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${safeName || 'livre-chatbound'}.pdf`
}

export function renderPdfInWorker(request: DirectPdfWorkerRequest, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted()
  const worker = new Worker(
    new URL('../workers/direct-pdf.worker.tsx', import.meta.url),
    { type: 'module' },
  )
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      worker.terminate()
    }
    const abort = () => {
      cleanup()
      reject(new DOMException('Export annulé.', 'AbortError'))
    }
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Le rendu PDF dépasse 10 minutes. Réduisez la période ou le nombre de photos.'))
    }, 600_000)
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<DirectPdfWorkerResponse>) => {
      cleanup()
      if (event.data.type === 'error') {
        reject(new Error(event.data.message))
        return
      }
      const completedBlob = event.data.blob
      if (completedBlob.size <= 5) {
        reject(new Error('Le document PDF généré est vide.'))
        return
      }
      void inspectPdfFonts(completedBlob).then(({ embedded, missing }) => {
        if (signal?.aborted) {
          reject(new DOMException('Export annulé.', 'AbortError'))
        } else if (missing.length > 0) {
          const hint = missing.includes('Helvetica')
            ? ' Certains caractères ou signes invisibles ne sont pas pris en charge par les polices du PDF.'
            : ''
          reject(new Error(`Polices non incorporées : ${missing.join(', ')}.${hint}`))
        } else if (embedded.length === 0) {
          reject(new Error('Aucune police incorporée n’a été détectée dans le PDF.'))
        } else {
          resolve(completedBlob)
        }
      }, reject)
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'Le worker PDF a échoué.'))
    }
    worker.onmessageerror = () => {
      cleanup()
      reject(new Error('Le document ne peut pas être transféré au moteur PDF.'))
    }
    try {
      worker.postMessage(request)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}

export async function generateDirectPdf({
  archive,
  settings,
  messages,
  pages,
  onProgress,
  signal,
  report,
}: GenerateDirectPdfOptions): Promise<Blob> {
  const mediaNames = Array.from(new Set([
    ...messages.flatMap((message) => message.mediaName ? [message.mediaName] : []),
    ...(settings.coverMediaName ? [settings.coverMediaName] : []),
    ...(settings.backCover.mediaName ? [settings.backCover.mediaName] : []),
  ])).filter(isPdfImage)
  const mediaUrls: Record<string, string> = {}
  const coverNames = new Set([
    ...(settings.artDirection.coverLayout !== 'typographic'
      ? [findCoverMedia(messages, settings.coverMediaName)] : []),
    ...(settings.backCover.enabled && settings.backCover.layout === 'photo'
      ? [findBackCoverMedia(messages, settings.backCover.mediaName)] : []),
  ])
  const videoFrames = new Map<string, { name: string; time: number }>()
  pages.flat().forEach((message) => {
    if (!isVideoMedia(message.mediaName) || !message.mediaName) return
    const time = getPhotoOverride(settings, message.sourceMessageId ?? message.id).videoTime ?? DEFAULT_VIDEO_TIME
    videoFrames.set(videoFrameKey(message.mediaName, time), { name: message.mediaName, time })
  })
  coverNames.forEach((name) => {
    if (!name || !isVideoMedia(name)) return
    const message = messages.find((candidate) => candidate.mediaName === name)
    const time = message ? getPhotoOverride(settings, message.id).videoTime ?? DEFAULT_VIDEO_TIME : DEFAULT_VIDEO_TIME
    videoFrames.set(videoFrameKey(name, time), { name, time })
  })
  const temporaryUrls: string[] = []
  const imageDpi = new Map<string, number>()
  report?.entries.forEach((entry) => {
    if (entry.dpi === null || entry.dpi <= 0) return
    imageDpi.set(entry.mediaName, Math.min(imageDpi.get(entry.mediaName) ?? Infinity, entry.dpi))
  })
  try {
    onProgress?.(4)
    for (let index = 0; index < mediaNames.length; index += 6) {
      signal?.throwIfAborted()
      const batch = mediaNames.slice(index, index + 6)
      for (const mediaName of batch) {
        signal?.throwIfAborted()
        const original = await archive.getMediaUrl(mediaName)
        if (!original) continue
        const url = await preparePdfImage(original, mediaName, settings, imageDpi.get(mediaName) ?? null, coverNames.has(mediaName))
        mediaUrls[mediaName] = url
        if (url !== original) temporaryUrls.push(url)
      }
      onProgress?.(Math.round(4 + ((index + batch.length) / mediaNames.length) * 56))
    }
    for (const [key, frame] of videoFrames) {
      signal?.throwIfAborted()
      const blob = await getVideoFrame(archive, frame.name, frame.time)
      signal?.throwIfAborted()
      if (!blob) continue
      const url = URL.createObjectURL(blob)
      temporaryUrls.push(url)
      mediaUrls[key] = url
      const coverMessage = messages.find((message) => message.mediaName === frame.name)
      const coverTime = coverMessage ? getPhotoOverride(settings, coverMessage.id).videoTime ?? DEFAULT_VIDEO_TIME : DEFAULT_VIDEO_TIME
      if (coverNames.has(frame.name) && frame.time === coverTime) mediaUrls[frame.name] = url
    }
    onProgress?.(68)
    const blob = await renderPdfInWorker({ settings, messages, pages, mediaUrls }, signal)
    onProgress?.(100)
    return blob
  } finally {
    temporaryUrls.forEach((url) => URL.revokeObjectURL(url))
  }
}