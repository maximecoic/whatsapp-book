import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { describe, expect, it } from 'vitest'
import { createArchiveProjectId, openChatArchive } from './archive-reader'

async function createArchive(
  chatText: string | null,
  media: Record<string, string> = {},
): Promise<Blob & { name?: string }> {
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  if (chatText !== null) {
    await writer.add('_chat.txt', new TextReader(chatText))
  }
  for (const [name, content] of Object.entries(media)) {
    await writer.add(name, new BlobReader(new Blob([content])))
  }

  const blob = (await writer.close()) as Blob & { name?: string }
  blob.name = 'souvenirs.zip'
  return blob
}

describe('openChatArchive', () => {
  it('creates a stable project id from chat content', () => {
    expect(createArchiveProjectId('même conversation')).toBe(
      createArchiveProjectId('même conversation'),
    )
    expect(createArchiveProjectId('conversation A')).not.toBe(
      createArchiveProjectId('conversation B'),
    )
  })

  it('indexes media and extracts a requested file lazily', async () => {
    const source = [
      '[01/01/2024 10:00:00] Lina: Bonjour',
      '[01/01/2024 10:01:00] Sam: < pièce jointe : IMG-001.jpg >',
    ].join('\n')
    const file = await createArchive(source, { 'media/IMG-001.jpg': 'image-data' })

    const archive = await openChatArchive(file)

    expect(archive.fileName).toBe('souvenirs.zip')
    expect(archive.chat.messages).toHaveLength(2)
    expect(archive.availableMedia).toBe(1)
    expect(archive.missingMedia).toEqual([])
    expect(await archive.getMediaBlob('IMG-001.jpg')).toBeInstanceOf(Blob)
    await archive.close()
    expect(await archive.getMediaBlob('IMG-001.jpg')).toBeNull()
  })

  it('reports referenced media missing from the zip', async () => {
    const file = await createArchive(
      '[01/01/2024 10:01:00] Sam: < pièce jointe : IMG-404.jpg >',
    )

    const archive = await openChatArchive(file)

    expect(archive.availableMedia).toBe(0)
    expect(archive.missingMedia).toEqual(['IMG-404.jpg'])
    await archive.close()
  })

  it('rejects an archive without a chat text file', async () => {
    const file = await createArchive(null, { 'IMG-001.jpg': 'image-data' })

    await expect(openChatArchive(file)).rejects.toMatchObject({
      code: 'chat-not-found',
    })
  })
})