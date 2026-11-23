import type { ChatMessage } from './chat-types'
import type { ChatArchive } from './archive-reader'
import { isVideoMedia } from './video-frame'

export interface ManualVideoAssociation {
  messageId: string
  fileName: string
  attachmentId: string
}

export function isValidManualVideoFileName(name: string): boolean {
  return isVideoMedia(name) && name.length <= 255 && Array.from(name).every((character) => (
    character.codePointAt(0)! >= 32 && character !== '/' && character !== '\\'
  ))
}

export function createManualVideoArchive(
  original: ChatArchive,
  associations: ManualVideoAssociation[],
  files: ReadonlyMap<string, File>,
): ChatArchive & { dispose(): void } {
  const media = new Map(associations.map((association) => [manualVideoMediaName(association.messageId), association]))
  const urls = new Map<string, string>()
  return {
    projectId: original.projectId,
    fileName: original.fileName,
    chatFileName: original.chatFileName,
    totalFiles: original.totalFiles,
    availableMedia: original.availableMedia,
    missingMedia: original.missingMedia,
    chat: { ...original.chat, messages: applyManualVideos(original.chat.messages, associations) },
    async getMediaBlob(name) {
      const association = media.get(name)
      return association ? files.get(association.attachmentId) ?? null : original.getMediaBlob(name)
    },
    async getMediaUrl(name) {
      const association = media.get(name)
      if (!association) return original.getMediaUrl(name)
      const file = files.get(association.attachmentId)
      if (!file) return null
      let url = urls.get(name)
      if (!url) {
        url = URL.createObjectURL(file)
        urls.set(name, url)
      }
      return url
    },
    async close() { await original.close() },
    dispose() {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    },
  }
}

export function manualVideoMediaName(messageId: string): string {
  return `chatbound-manual-video-${messageId}.mp4`
}

export function applyManualVideos(messages: ChatMessage[], associations: ManualVideoAssociation[]): ChatMessage[] {
  const byMessage = new Map(associations.map((association) => [association.messageId, association]))
  return messages.map((message) => {
    if (!byMessage.has(message.id)) return message
    return {
      ...message,
      mediaName: manualVideoMediaName(message.id),
      kind: 'media',
      body: message.kind === 'missing-media'
        ? ''
        : message.body.replace(/(^|\n)[ \t]*<(?:media|m[eé]dia)\s+(?:omitted|omis)>[ \t]*(?=\n|$)/i, '$1').trim(),
    }
  })
}