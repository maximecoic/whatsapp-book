import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatArchive } from './archive-reader'
import { DEFAULT_VIDEO_TIME, getVideoFrame, isVideoMedia, videoFrameKey } from './video-frame'

afterEach(() => vi.unstubAllGlobals())

describe('video frames', () => {
  it('distinguishes video files from images and other attachments', () => {
    expect(isVideoMedia('VID-123.MP4')).toBe(true)
    expect(isVideoMedia('clip.mov')).toBe(true)
    expect(isVideoMedia('image.jpg')).toBe(false)
    expect(isVideoMedia(null)).toBe(false)
  })

  it('distinguishes different selected frames of the same video', () => {
    expect(videoFrameKey('clip.mp4')).toBe(videoFrameKey('clip.mp4', DEFAULT_VIDEO_TIME))
    expect(videoFrameKey('clip.mp4', 2)).not.toBe(videoFrameKey('clip.mp4', 3))
  })

  it('extracts and caches a frame while releasing the temporary video URL', async () => {
    const blob = new Blob(['video'])
    const frame = new Blob(['frame'], { type: 'image/jpeg' })
    const getMediaBlob = vi.fn(async () => blob)
    const archive = { getMediaBlob } as unknown as ChatArchive
    const createObjectURL = vi.fn(() => 'blob:video')
    const revokeObjectURL = vi.fn()
    const video = {
      src: '', muted: false, preload: '', playsInline: false, duration: 4, videoWidth: 320, videoHeight: 240,
      onerror: null as (() => void) | null,
      onloadeddata: null as (() => void) | null,
      onseeked: null as (() => void) | null,
      set currentTime(_value: number) { queueMicrotask(() => this.onseeked?.()) },
      load() { if (this.src) queueMicrotask(() => this.onloadeddata?.()) },
      pause() {},
      removeAttribute() { this.src = '' },
    }
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: (callback: (value: Blob) => void) => callback(frame) }
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('document', { createElement: (type: string) => type === 'video' ? video : canvas })

    expect(await getVideoFrame(archive, 'VID-001.mp4', 3)).toBe(frame)
    expect(await getVideoFrame(archive, 'VID-001.mp4', 3)).toBe(frame)
    expect(getMediaBlob).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:video')
  })
})