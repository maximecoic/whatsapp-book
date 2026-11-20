import { describe, expect, it } from 'vitest'
import type { ChatArchive } from '../lib/archive-reader'
import { getPhotoAspectRatios, recordPhotoAspectRatio } from './usePhotoAspectRatios'

function archiveStub(): ChatArchive {
  return {
    projectId: 'test-project',
    fileName: 'test.zip',
    chatFileName: '_chat.txt',
    totalFiles: 0,
    availableMedia: 0,
    missingMedia: [],
    chat: {
      messages: [], participants: [], startTimestamp: null, endTimestamp: null,
      mediaReferences: 0, warnings: [],
    },
    getMediaBlob: async () => null,
    getMediaUrl: async () => null,
    close: async () => undefined,
  }
}

describe('photo aspect ratios', () => {
  it('keeps snapshots stable until a decoded size changes', () => {
    const archive = archiveStub()
    const empty = getPhotoAspectRatios(archive)
    recordPhotoAspectRatio(archive, 'photo.jpg', 1600, 1200)
    const snapshot = getPhotoAspectRatios(archive)
    expect(snapshot).toEqual({ 'photo.jpg': 4 / 3 })
    expect(empty).toEqual({})
    recordPhotoAspectRatio(archive, 'photo.jpg', 1600, 1200)
    expect(getPhotoAspectRatios(archive)).toBe(snapshot)
  })

  it('isolates archives even when filenames are identical', () => {
    const first = archiveStub()
    const second = archiveStub()
    recordPhotoAspectRatio(first, 'photo.jpg', 800, 1200)
    recordPhotoAspectRatio(second, 'photo.jpg', 1600, 900)
    expect(getPhotoAspectRatios(first)['photo.jpg']).toBe(2 / 3)
    expect(getPhotoAspectRatios(second)['photo.jpg']).toBe(16 / 9)
  })

  it('ignores invalid image dimensions', () => {
    const archive = archiveStub()
    recordPhotoAspectRatio(archive, 'missing.jpg', 0, 1200)
    recordPhotoAspectRatio(archive, 'broken.jpg', Number.NaN, 900)
    expect(getPhotoAspectRatios(archive)).toEqual({})
  })
})