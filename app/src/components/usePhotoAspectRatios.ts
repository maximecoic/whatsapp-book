import { useSyncExternalStore } from 'react'
import type { ChatArchive } from '../lib/archive-reader'
import { getVideoFrame, isVideoMedia } from '../lib/video-frame'

interface AspectRatioStore {
  snapshot: Record<string, number>
  listeners: Set<() => void>
}

const stores = new WeakMap<ChatArchive, AspectRatioStore>()

function storeFor(archive: ChatArchive): AspectRatioStore {
  const existing = stores.get(archive)
  if (existing) return existing
  const store: AspectRatioStore = { snapshot: {}, listeners: new Set() }
  stores.set(archive, store)
  return store
}

export function recordPhotoAspectRatio(
  archive: ChatArchive,
  name: string,
  width: number,
  height: number,
) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
  const store = storeFor(archive)
  const ratio = width / height
  if (store.snapshot[name] === ratio) return
  store.snapshot = { ...store.snapshot, [name]: ratio }
  store.listeners.forEach((listener) => listener())
}

export function getPhotoAspectRatios(archive: ChatArchive): Record<string, number> {
  return storeFor(archive).snapshot
}

export async function inspectPhotoAspectRatio(archive: ChatArchive, name: string): Promise<void> {
  if (getPhotoAspectRatios(archive)[name]) return
  const frame = isVideoMedia(name) ? await getVideoFrame(archive, name) : null
  const temporaryUrl = frame ? URL.createObjectURL(frame) : null
  const url = isVideoMedia(name) ? temporaryUrl : await archive.getMediaUrl(name)
  if (!url) return
  const image = new Image()
  image.src = url
  try {
    await image.decode()
    recordPhotoAspectRatio(archive, name, image.naturalWidth, image.naturalHeight)
  } catch {
    return
  } finally {
    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl)
  }
}

export function usePhotoAspectRatios(archive: ChatArchive) {
  return useSyncExternalStore(
    (listener) => {
      const store = storeFor(archive)
      store.listeners.add(listener)
      return () => { store.listeners.delete(listener) }
    },
    () => getPhotoAspectRatios(archive),
  )
}