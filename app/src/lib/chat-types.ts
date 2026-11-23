import type { EditorialTextLayout } from './book-model'

export type DateOrder = 'auto' | 'dmy' | 'mdy'

export type MessageKind =
  | 'message'
  | 'media'
  | 'missing-media'
  | 'deleted'
  | 'system'
  | 'editorial'

export interface TableOfContentsEntry {
  id: string
  label: string
  page: number
  type: 'chapter' | 'editorial' | 'bookmark'
}

export interface EditorialMessageContent {
  pageId: string
  kind: 'dedication' | 'introduction' | 'text' | 'epilogue' | 'blank' | 'table-of-contents'
  title: string
  layout?: EditorialTextLayout
  entries?: TableOfContentsEntry[]
}

export interface ChatMessage {
  id: string
  timestamp: number
  sender: string | null
  body: string
  mediaName: string | null
  videoName?: string
  kind: MessageKind
  continuation?: {
    part: number
    total: number
  }
  sourceMessageId?: string
  chapterTitle?: string
  editorial?: EditorialMessageContent
}

export interface ParsedChat {
  messages: ChatMessage[]
  participants: string[]
  startTimestamp: number | null
  endTimestamp: number | null
  mediaReferences: number
  warnings: string[]
}

export interface ParseOptions {
  dateOrder?: DateOrder
}