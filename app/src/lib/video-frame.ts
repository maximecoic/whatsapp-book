import type { ChatArchive } from './archive-reader'

export const DEFAULT_VIDEO_TIME = 1

export function isVideoMedia(name: string | null | undefined): boolean {
  return Boolean(name && /\.(?:mp4|mov|m4v|avi|webm|3gp)$/i.test(name))
}

export function showMediaCaption(name: string | null | undefined, showCaption?: boolean): boolean {
  return isVideoMedia(name) || showCaption !== false
}

export function videoFrameKey(name: string, time: number = DEFAULT_VIDEO_TIME): string {
  return `video-frame:${name}:${time}`
}

const frameCaches = new WeakMap<ChatArchive, Map<string, { time: number; promise: Promise<Blob | null> }>>()

export function getVideoFrame(archive: ChatArchive, name: string, time = DEFAULT_VIDEO_TIME): Promise<Blob | null> {
  let cache = frameCaches.get(archive)
  if (!cache) {
    cache = new Map()
    frameCaches.set(archive, cache)
  }
  const cached = cache.get(name)
  if (cached?.time === time) return cached.promise

  const promise = extractVideoFrame(archive, name, time).catch(() => null)
  cache.set(name, { time, promise })
  if (cache.size > 64) cache.delete(cache.keys().next().value!)
  return promise
}

async function extractVideoFrame(archive: ChatArchive, name: string, time: number): Promise<Blob | null> {
  const blob = await archive.getMediaBlob(name)
  if (!blob) return null
  const source = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true

  try {
    return await new Promise<Blob | null>((resolve) => {
      let finished = false
      const finish = (result: Blob | null) => {
        if (finished) return
        finished = true
        clearTimeout(timeout)
        resolve(result)
      }
      const timeout = setTimeout(() => finish(null), 15_000)
      video.onerror = () => finish(null)
      video.onloadeddata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        const target = Math.max(0, Math.min(Number.isFinite(time) ? time : DEFAULT_VIDEO_TIME, Math.max(0, duration - 0.05)))
        const capture = () => {
          if (!video.videoWidth || !video.videoHeight) return finish(null)
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const context = canvas.getContext('2d')
          if (!context) return finish(null)
          try {
            context.drawImage(video, 0, 0)
            canvas.toBlob(finish, 'image/jpeg', 0.94)
          } catch {
            finish(null)
          }
        }
        video.onloadeddata = null
        if (target > 0) {
          video.onseeked = capture
          try { video.currentTime = target } catch { finish(null) }
        } else capture()
      }
      video.src = source
      video.load()
    })
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(source)
  }
}