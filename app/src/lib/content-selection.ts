import type { ChatMessage } from './chat-types'

export type ContentView = 'all' | 'photos' | 'hidden' | 'missing'

export interface ContentQuery {
  query: string
  view: ContentView
  excludedMessageIds: string[]
  missingMessageIds?: string[]
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .trim()
}

export function selectContentMessages(
  messages: ChatMessage[],
  options: ContentQuery,
): ChatMessage[] {
  const excluded = new Set(options.excludedMessageIds)
  const missing = new Set(options.missingMessageIds ?? [])
  const query = normalize(options.query)
  const terms = query.split(/\s+/).filter(Boolean)

  return messages.filter((message) => {
    if (options.view === 'photos' && !message.mediaName) return false
    if (options.view === 'hidden' && !excluded.has(message.id)) return false
    if (options.view === 'missing' && !missing.has(message.id)) return false
    if (!query) return true

    const searchable = normalize([
      message.sender ?? '',
      message.body,
      message.mediaName ?? '',
      new Date(message.timestamp).toLocaleDateString('fr-FR'),
    ].join(' '))
    return terms.every((term) => searchable.includes(term))
  })
}

export function updateExcludedMessages(
  currentIds: string[],
  messageIds: Iterable<string>,
  excluded: boolean,
): string[] {
  const next = new Set(currentIds)
  for (const messageId of messageIds) {
    if (excluded) next.add(messageId)
    else next.delete(messageId)
  }
  return [...next]
}