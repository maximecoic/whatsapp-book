import { describe, expect, it } from 'vitest'
import { createInitialSettings } from './book-model'
import { BOOK_STYLE_PRESETS, clonePresetArtDirection } from './book-style'
import type { ParsedChat } from './chat-types'
import {
  parsePortableProject,
  portableProjectFileName,
  serializePortableProject,
} from './portable-project'

const chat: ParsedChat = {
  messages: [],
  participants: ['Lina', 'Sam'],
  startTimestamp: null,
  endTimestamp: null,
  mediaReferences: 0,
  warnings: [],
}

describe('portable project', () => {
  it.each(['gazette', 'photo-story', 'collage'] as const)(
    'round-trips the %s page composition',
    (theme) => {
      const settings = { ...createInitialSettings(chat, 'conversation.zip'), theme }
      const project = parsePortableProject(serializePortableProject({
        projectId: 'chat-abc12345-project',
        archiveName: 'conversation.zip',
        settings,
      }))
      expect(project.settings.theme).toBe(theme)
    },
  )

  it.each(['bullet', 'travel', 'scrapbook'] as const)(
    'round-trips the %s journaling theme',
    (preset) => {
      const settings = createInitialSettings(chat, 'conversation.zip')
      settings.artDirection = clonePresetArtDirection(preset)
      settings.accent = BOOK_STYLE_PRESETS[preset].accent
      const parsed = parsePortableProject(serializePortableProject({
        projectId: 'chat-abc12345-project',
        archiveName: 'conversation.zip',
        settings,
      }))
      expect(parsed.settings.artDirection).toEqual(settings.artDirection)
      expect(parsed.settings.accent).toBe(settings.accent)
    },
  )

  it('round-trips versioned settings without private chat content', () => {
    const settings = createInitialSettings(chat, 'conversation.zip')
    settings.title = 'Notre livre'
    settings.excludedMessageIds = ['message-12']
    settings.coverMediaName = 'IMG-001.jpg'
    settings.coverPhotoOverride = {
      mediaName: 'IMG-001.jpg',
      fit: 'cover',
      focalX: 18,
      focalY: 76,
      rotation: 90,
    }
    settings.backCover = {
      enabled: true,
      layout: 'photo',
      text: 'À bientôt.',
      mediaName: 'IMG-002.jpg',
      photoOverride: null,
      overlay: 44,
      textPosition: 'center',
    }
    settings.photoOverrides = [{
      messageId: 'message-photo',
      layout: 'full-page',
      fit: 'cover',
      focalX: 25,
      focalY: 75,
      rotation: 90,
      showCaption: false,
    }]
    settings.captionOverrides = [{ messageId: 'message-photo', text: 'Légende locale' }]
    settings.participantProfiles = [{
      participant: 'Lina',
      displayName: 'Lili',
      color: '#9d4561',
    }]
    settings.editorialPages = [{
      id: 'dedicace',
      kind: 'dedication',
      title: 'Pour nous',
      body: 'Quelques mots.',
      anchorMessageId: null,
    }]
    settings.showTableOfContents = true
    settings.bookmarks = [{ messageId: 'message-12', label: 'Le début' }]
    settings.artDirection = {
      preset: 'graphic',
      fontPair: 'modern',
      paperColor: '#f5f3ee',
      inkColor: '#18202d',
      density: 'compact',
      lineHeight: 1.3,
      pageNumbers: 'center',
      dateStyle: 'compact',
      dateHeadingStyle: 'label',
      photoFrame: 'square',
      chapterStyle: 'band',
      participantPalette: 'accent',
      coverLayout: 'full-image',
      coverTitlePosition: 'center',
      coverOverlay: 52,
    }

    const serialized = serializePortableProject({
      projectId: 'chat-abc12345-project',
      archiveName: 'conversation.zip',
      settings,
    }, '2026-08-12T12:00:00.000Z')
    const parsed = parsePortableProject(serialized)

    expect(parsed).toMatchObject({
      format: 'chatbound-project',
      version: 1,
      projectId: 'chat-abc12345-project',
      archiveName: 'conversation.zip',
      settings: {
        title: 'Notre livre',
        excludedMessageIds: ['message-12'],
        coverMediaName: 'IMG-001.jpg',
        coverPhotoOverride: {
          mediaName: 'IMG-001.jpg',
          fit: 'cover',
          focalX: 18,
          focalY: 76,
          rotation: 90,
        },
        backCover: {
          enabled: true,
          layout: 'photo',
          text: 'À bientôt.',
          mediaName: 'IMG-002.jpg',
          photoOverride: null,
          overlay: 44,
          textPosition: 'center',
        },
        photoOverrides: [{
          messageId: 'message-photo',
          layout: 'full-page',
          fit: 'cover',
          focalX: 25,
          focalY: 75,
          rotation: 90,
          showCaption: false,
        }],
        captionOverrides: [{ messageId: 'message-photo', text: 'Légende locale' }],
        participantProfiles: [{
          participant: 'Lina',
          displayName: 'Lili',
          color: '#9d4561',
        }],
        editorialPages: [{
          id: 'dedicace',
          kind: 'dedication',
          title: 'Pour nous',
          body: 'Quelques mots.',
          anchorMessageId: null,
        }],
        showTableOfContents: true,
        bookmarks: [{ messageId: 'message-12', label: 'Le début' }],
        artDirection: {
          preset: 'graphic',
          fontPair: 'modern',
          paperColor: '#f5f3ee',
          inkColor: '#18202d',
          density: 'compact',
          lineHeight: 1.3,
          pageNumbers: 'center',
          dateStyle: 'compact',
          dateHeadingStyle: 'label',
          photoFrame: 'square',
          chapterStyle: 'band',
          participantPalette: 'accent',
          coverLayout: 'full-image',
          coverTitlePosition: 'center',
          coverOverlay: 52,
        },
      },
    })
    expect(serialized).not.toContain('Hello hello')
    expect(serialized).not.toContain('blob:')
    expect(serialized).not.toContain('data:image')
  })

  it('rejects another JSON format and unsupported versions', () => {
    expect(() => parsePortableProject('{"format":"other","version":1}')).toThrow(
      'n’est pas un projet Chatbound',
    )
    expect(() => parsePortableProject(JSON.stringify({
      format: 'chatbound-project',
      version: 99,
    }))).toThrow('n’est pas encore prise en charge')
  })

  it('rejects malformed project identifiers', () => {
    expect(() => parsePortableProject(JSON.stringify({
      format: 'chatbound-project',
      version: 1,
      projectId: '../archive',
      archiveName: 'conversation.zip',
      exportedAt: '2026-08-12T12:00:00.000Z',
      settings: {},
    }))).toThrow('incomplet ou endommagé')
  })

  it('rejects a malformed project title before rendering it', () => {
    expect(() => parsePortableProject(JSON.stringify({
      format: 'chatbound-project',
      version: 1,
      projectId: 'chat-abc12345-project',
      archiveName: 'conversation.zip',
      exportedAt: '2026-08-12T12:00:00.000Z',
      settings: { title: { malformed: true } },
    }))).toThrow('incomplet ou endommagé')
  })

  it('creates a portable ASCII filename', () => {
    expect(portableProjectFileName('Été à São Paulo')).toBe(
      'ete-a-sao-paulo.chatbound',
    )
  })

  it('rejects an export that would exceed the portable project limit', () => {
    const settings = createInitialSettings(chat, 'conversation.zip')
    settings.editorialPages = Array.from({ length: 90 }, (_, index) => ({
      id: `page-${index}`,
      kind: 'text' as const,
      title: `Page ${index}`,
      body: 'é'.repeat(12_000),
      anchorMessageId: null,
    }))

    expect(() => serializePortableProject({
      projectId: 'chat-abc12345-project',
      archiveName: 'conversation.zip',
      settings,
    })).toThrow('dépasse la limite de 1 Mo')
  })
})