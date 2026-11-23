import {
  BlobReader,
  BlobWriter,
  TextWriter,
  ZipReader,
  type FileEntry,
} from '@zip.js/zip.js'
import { parseWhatsAppChat } from './chat-parser'
import type { ParseOptions, ParsedChat } from './chat-types'
import { isVideoMedia } from './video-frame'

const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024
const MAX_ENTRIES = 20_000
const MAX_CHAT_BYTES = 50 * 1024 * 1024
const MAX_MEDIA_BYTES = 150 * 1024 * 1024

export type ArchiveErrorCode =
  | 'archive-too-large'
  | 'too-many-files'
  | 'chat-not-found'
  | 'chat-too-large'
  | 'empty-chat'
  | 'invalid-archive'

export class ArchiveImportError extends Error {
  readonly code: ArchiveErrorCode

  constructor(
    code: ArchiveErrorCode,
    message: string,
  ) {
    super(message)
    this.code = code
    this.name = 'ArchiveImportError'
  }
}

export interface ChatArchiveSummary {
  projectId: string
  fileName: string
  chatFileName: string
  totalFiles: number
  availableMedia: number
  missingMedia: string[]
  chat: ParsedChat
}

export interface ChatArchive extends ChatArchiveSummary {
  getMediaBlob(name: string): Promise<Blob | null>
  getMediaUrl(name: string): Promise<string | null>
  close(): Promise<void>
}

function baseName(path: string): string {
  return path.split('/').at(-1) ?? path
}

export function createArchiveProjectId(source: string): string {
  let first = 0x811c9dc5
  let second = 0x9e3779b9

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }

  return `chat-${source.length.toString(36)}-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`
}

function mediaType(fileName: string): string {
  const extension = fileName.split('.').at(-1)?.toLowerCase()
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/mp4',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    '3gp': 'video/3gpp',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
    ogg: 'audio/ogg',
    pdf: 'application/pdf',
  }
  return types[extension ?? ''] ?? 'application/octet-stream'
}

function selectChatEntry(entries: FileEntry[]): FileEntry | null {
  const textEntries = entries.filter((entry) =>
    entry.filename.toLowerCase().endsWith('.txt'),
  )

  return (
    textEntries.find((entry) => baseName(entry.filename).toLowerCase() === '_chat.txt') ??
    textEntries.find((entry) => /whatsapp.*chat/i.test(baseName(entry.filename))) ??
    textEntries.sort((left, right) => right.uncompressedSize - left.uncompressedSize)[0] ??
    null
  )
}

class OpenChatArchive implements ChatArchive {
  readonly projectId: string
  readonly fileName: string
  readonly chatFileName: string
  readonly totalFiles: number
  readonly availableMedia: number
  readonly missingMedia: string[]
  readonly chat: ParsedChat

  private readonly mediaEntries: Map<string, FileEntry>
  private readonly reader: ZipReader<Blob>
  private readonly blobPromises = new Map<string, Promise<Blob | null>>()
  private readonly objectUrls = new Map<string, string>()
  private closed = false

  constructor(
    reader: ZipReader<Blob>,
    summary: ChatArchiveSummary,
    mediaEntries: Map<string, FileEntry>,
  ) {
    this.reader = reader
    this.projectId = summary.projectId
    this.fileName = summary.fileName
    this.chatFileName = summary.chatFileName
    this.totalFiles = summary.totalFiles
    this.availableMedia = summary.availableMedia
    this.missingMedia = summary.missingMedia
    this.chat = summary.chat
    this.mediaEntries = mediaEntries
  }

  async getMediaBlob(name: string): Promise<Blob | null> {
    if (this.closed) return null

    const key = name.toLocaleLowerCase()
    const existing = this.blobPromises.get(key)
    if (existing) return existing

    const entry = this.mediaEntries.get(key)
    if (!entry || entry.uncompressedSize > MAX_MEDIA_BYTES) return null

    const promise = entry.getData(new BlobWriter(mediaType(name))).catch(() => null)
    if (isVideoMedia(name)) return promise
    this.blobPromises.set(key, promise)
    return promise
  }

  async getMediaUrl(name: string): Promise<string | null> {
    const key = name.toLocaleLowerCase()
    const existing = this.objectUrls.get(key)
    if (existing) return existing

    const blob = await this.getMediaBlob(name)
    if (!blob || this.closed) return null

    const url = URL.createObjectURL(blob)
    this.objectUrls.set(key, url)
    return url
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url))
    this.objectUrls.clear()
    this.blobPromises.clear()
    await this.reader.close()
  }
}

export async function openChatArchive(
  file: Blob & { name?: string },
  options: ParseOptions = {},
): Promise<ChatArchive> {
  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new ArchiveImportError(
      'archive-too-large',
      "Cette archive dépasse la limite de 2 Go de l'application.",
    )
  }

  const reader = new ZipReader(new BlobReader(file))

  try {
    const entries = await reader.getEntries()
    if (entries.length > MAX_ENTRIES) {
      throw new ArchiveImportError(
        'too-many-files',
        `Cette archive contient plus de ${MAX_ENTRIES.toLocaleString('fr-FR')} fichiers.`,
      )
    }

    const files = entries.filter((entry): entry is FileEntry => !entry.directory)
    const chatEntry = selectChatEntry(files)
    if (!chatEntry) {
      throw new ArchiveImportError(
        'chat-not-found',
        "Aucun fichier de conversation WhatsApp n'a été trouvé dans l'archive.",
      )
    }
    if (chatEntry.uncompressedSize > MAX_CHAT_BYTES) {
      throw new ArchiveImportError(
        'chat-too-large',
        'Le fichier texte de cette conversation dépasse 50 Mo.',
      )
    }

    const source = await chatEntry.getData(new TextWriter())
    const chat = parseWhatsAppChat(source, options)
    if (chat.messages.length === 0) {
      throw new ArchiveImportError(
        'empty-chat',
        "Le fichier texte ne contient aucun message WhatsApp reconnu.",
      )
    }

    const mediaEntries = new Map<string, FileEntry>()
    files.forEach((entry) => {
      if (entry !== chatEntry) {
        mediaEntries.set(baseName(entry.filename).toLocaleLowerCase(), entry)
      }
    })

    const referencedNames = [
      ...new Set(
        chat.messages.flatMap((message) =>
          message.mediaName ? [message.mediaName] : [],
        ),
      ),
    ]
    const missingMedia = referencedNames.filter(
      (name) => !mediaEntries.has(name.toLocaleLowerCase()),
    )
    const summary: ChatArchiveSummary = {
      projectId: createArchiveProjectId(source),
      fileName: file.name ?? 'conversation.zip',
      chatFileName: chatEntry.filename,
      totalFiles: files.length,
      availableMedia: referencedNames.length - missingMedia.length,
      missingMedia,
      chat,
    }

    return new OpenChatArchive(reader, summary, mediaEntries)
  } catch (error) {
    await reader.close().catch(() => undefined)
    if (error instanceof ArchiveImportError) throw error
    throw new ArchiveImportError(
      'invalid-archive',
      "Impossible d'ouvrir cette archive ZIP. Vérifiez qu'elle n'est pas endommagée.",
    )
  }
}