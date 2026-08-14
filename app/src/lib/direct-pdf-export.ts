import type { ChatArchive } from './archive-reader'
import type { BookSettings } from './book-model'
import type { ChatMessage } from './chat-types'

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
}

function isPdfImage(mediaName: string): boolean {
  return /\.(?:jpe?g|png)$/i.test(mediaName)
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

function renderPdfInWorker(request: DirectPdfWorkerRequest): Promise<Blob> {
  const worker = new Worker(
    new URL('../workers/direct-pdf.worker.tsx', import.meta.url),
    { type: 'module' },
  )
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<DirectPdfWorkerResponse>) => {
      worker.terminate()
      if (event.data.type === 'complete') resolve(event.data.blob)
      else reject(new Error(event.data.message))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'Le worker PDF a échoué.'))
    }
    worker.postMessage(request)
  })
}

export async function generateDirectPdf({
  archive,
  settings,
  messages,
  pages,
  onProgress,
}: GenerateDirectPdfOptions): Promise<Blob> {
  const mediaNames = Array.from(new Set([
    ...messages.flatMap((message) => message.mediaName ? [message.mediaName] : []),
    ...(settings.coverMediaName ? [settings.coverMediaName] : []),
    ...(settings.backCover.mediaName ? [settings.backCover.mediaName] : []),
  ])).filter(isPdfImage)
  const mediaUrls: Record<string, string> = {}
  onProgress?.(4)
  for (let index = 0; index < mediaNames.length; index += 6) {
    const batch = mediaNames.slice(index, index + 6)
    const urls = await Promise.all(batch.map((mediaName) => archive.getMediaUrl(mediaName)))
    batch.forEach((mediaName, batchIndex) => {
      const url = urls[batchIndex]
      if (url) mediaUrls[mediaName] = url
    })
    onProgress?.(Math.round(4 + ((index + batch.length) / mediaNames.length) * 56))
  }
  onProgress?.(68)
  const blob = await renderPdfInWorker({ settings, messages, pages, mediaUrls })
  onProgress?.(100)
  return blob
}