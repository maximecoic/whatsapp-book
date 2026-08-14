import { describe, expect, it } from 'vitest'
import type { ChatMessage } from './chat-types'
import {
  selectContentMessages,
  updateExcludedMessages,
} from './content-selection'

const messages: ChatMessage[] = [
  {
    id: 'one',
    timestamp: new Date(2024, 6, 14).getTime(),
    sender: 'Élodie',
    body: 'Déjeuner à Montréal',
    mediaName: null,
    kind: 'message',
  },
  {
    id: 'two',
    timestamp: new Date(2024, 6, 15).getTime(),
    sender: 'Sam',
    body: 'La plage',
    mediaName: 'IMG-001.jpg',
    kind: 'media',
  },
]

describe('content selection', () => {
  it('searches senders and content without accent sensitivity', () => {
    expect(selectContentMessages(messages, {
      query: 'elodie montreal',
      view: 'all',
      excludedMessageIds: [],
    }).map(({ id }) => id)).toEqual(['one'])
  })

  it('filters photos and hidden messages', () => {
    expect(selectContentMessages(messages, {
      query: '',
      view: 'photos',
      excludedMessageIds: [],
    }).map(({ id }) => id)).toEqual(['two'])
    expect(selectContentMessages(messages, {
      query: '',
      view: 'hidden',
      excludedMessageIds: ['one'],
    }).map(({ id }) => id)).toEqual(['one'])
  })

  it('applies bulk exclusions without duplicates', () => {
    expect(updateExcludedMessages(['one'], ['one', 'two'], true)).toEqual([
      'one',
      'two',
    ])
    expect(updateExcludedMessages(['one', 'two'], ['one'], false)).toEqual(['two'])
  })
})