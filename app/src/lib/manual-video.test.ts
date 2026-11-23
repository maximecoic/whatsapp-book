import { describe, expect, it } from 'vitest'
import type { ChatMessage } from './chat-types'
import type { ChatArchive } from './archive-reader'
import { applyManualVideos, createManualVideoArchive, manualVideoMediaName } from './manual-video'

describe('manual video associations', () => {
  it('associates a video with its message without changing the source conversation', () => {
    const message: ChatMessage = { id: 'one', timestamp: 0, sender: 'Lina', body: 'Notre souvenir', mediaName: null, kind: 'message' }
    const result = applyManualVideos([message], [{ messageId: 'one', fileName: 'vacances.mov', attachmentId: 'attachment-one' }])
    expect(result[0]).toMatchObject({ body: 'Notre souvenir', kind: 'media', mediaName: manualVideoMediaName('one') })
    expect(message.mediaName).toBeNull()
  })

  it('makes an omitted media message visible when a video is attached', () => {
    const message: ChatMessage = { id: 'two', timestamp: 0, sender: 'Lina', body: '<media omitted>', mediaName: null, kind: 'missing-media' }
    expect(applyManualVideos([message], [{ messageId: 'two', fileName: 'video.mp4', attachmentId: 'attachment-two' }])[0])
      .toMatchObject({ kind: 'media', body: '', mediaName: manualVideoMediaName('two') })
  })

  it('removes the omitted-media marker without removing its accompanying text', () => {
    const message: ChatMessage = { id: 'three', timestamp: 0, sender: 'Lina', body: '<Média omis>\nNotre souvenir', mediaName: null, kind: 'message' }
    expect(applyManualVideos([message], [{ messageId: 'three', fileName: 'video.mp4', attachmentId: 'attachment-three' }])[0].body)
      .toBe('Notre souvenir')
  })

  it('does not remove an omitted-media marker quoted within a message', () => {
    const message: ChatMessage = { id: 'four', timestamp: 0, sender: 'Lina', body: 'Le texte était « <Média omis> ».', mediaName: null, kind: 'message' }
    expect(applyManualVideos([message], [{ messageId: 'four', fileName: 'video.mp4', attachmentId: 'attachment-four' }])[0].body)
      .toBe(message.body)
  })

  it('keeps same-named videos distinct and never substitutes an unselected file', async () => {
    const first = new Blob(['first']) as File
    const second = new Blob(['second']) as File
    const messages: ChatMessage[] = [
      { id: 'one', timestamp: 0, sender: 'Lina', body: 'Premier', mediaName: null, kind: 'message' },
      { id: 'two', timestamp: 0, sender: 'Lina', body: 'Deuxième', mediaName: null, kind: 'message' },
    ]
    const original = { chat: { messages }, getMediaBlob: async () => new Blob(['archive']), getMediaUrl: async () => null, close: async () => {} } as unknown as ChatArchive
    const associations = [
      { messageId: 'one', fileName: 'video.mp4', attachmentId: 'attachment-one' },
      { messageId: 'two', fileName: 'video.mp4', attachmentId: 'attachment-two' },
    ]
    const archive = createManualVideoArchive(original, associations, new Map([['attachment-one', first], ['attachment-two', second]]))
    expect(await archive.getMediaBlob(manualVideoMediaName('one'))).toBe(first)
    expect(await archive.getMediaBlob(manualVideoMediaName('two'))).toBe(second)
    const reopened = createManualVideoArchive(original, associations, new Map())
    expect(await reopened.getMediaBlob(manualVideoMediaName('one'))).toBeNull()
  })
})