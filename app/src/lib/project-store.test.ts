import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createInitialSettings, type BookSettings } from './book-model'
import { BOOK_STYLE_PRESETS, clonePresetArtDirection } from './book-style'
import type { ChatMessage, ParsedChat } from './chat-types'
import {
  deleteBookProject,
  listBookProjects,
  loadBookProject,
  normalizeSavedSettings,
  saveBookProject,
} from './project-store'

const messages: ChatMessage[] = [
  {
    id: 'one',
    timestamp: new Date(2024, 0, 1).getTime(),
    sender: 'Lina',
    body: 'Bonjour',
    mediaName: null,
    kind: 'message',
  },
  {
    id: 'photo',
    timestamp: new Date(2024, 0, 2).getTime(),
    sender: 'Sam',
    body: 'Souvenir',
    mediaName: 'IMG-001.jpg',
    kind: 'media',
  },
]

const chat: ParsedChat = {
  messages,
  participants: ['Lina', 'Sam'],
  startTimestamp: messages[0].timestamp,
  endTimestamp: messages[1].timestamp,
  mediaReferences: 1,
  warnings: [],
}

describe('normalizeSavedSettings', () => {
  it('restores manual video associations and their individual settings', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const override = { messageId: 'one', layout: 'auto' as const, fit: 'contain' as const, focalX: 50, focalY: 50, rotation: 0 as const, showCaption: true, videoTime: 3.2 }
    const saved = { ...defaults, videoAssociations: [{ messageId: 'one', fileName: 'vacances.mov', attachmentId: 'attachment-one' }], photoOverrides: [override] }
    expect(normalizeSavedSettings(saved, defaults, chat)).toMatchObject({ videoAssociations: saved.videoAssociations, photoOverrides: [override] })
  })

  it('rejects invalid manual associations and preserves edited text independently of the media', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const saved = {
      ...defaults,
      videoAssociations: [
        { messageId: 'one', fileName: 'souvenir.mp4', attachmentId: 'attachment-one' },
        { messageId: 'one', fileName: 'autre.mov', attachmentId: 'attachment-two' },
        { messageId: 'photo', fileName: 'souvenir.mp4', attachmentId: 'attachment-three' },
        { messageId: 'missing', fileName: 'souvenir.mp4', attachmentId: 'attachment-four' },
        { messageId: 'one', fileName: '../video.mp4', attachmentId: 'attachment-five' },
      ],
      captionOverrides: [{ messageId: 'one', text: 'Texte conservé' }],
    }
    const result = normalizeSavedSettings(saved, defaults, chat)
    expect(result.videoAssociations).toEqual([saved.videoAssociations[0]])
    expect(result.captionOverrides).toEqual(saved.captionOverrides)
  })
  it('restores a video frame time and text-only choice', () => {
    const video = { ...messages[1], id: 'video', mediaName: 'VID-001.mp4' }
    const videoChat = { ...chat, messages: [...messages, video] }
    const defaults = createInitialSettings(videoChat, 'chat.zip')
    const override = { messageId: video.id, layout: 'auto' as const, fit: 'contain' as const, focalX: 50, focalY: 50, rotation: 0 as const, showCaption: true, videoTime: 3.2, videoTextOnly: true }
    expect(normalizeSavedSettings({ ...defaults, photoOverrides: [override] }, defaults, videoChat).photoOverrides)
      .toEqual([override])
  })
  it('restores individual text-page presentation settings', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const page = {
      id: 'custom-text', kind: 'text' as const, title: 'Souvenir', body: 'Notre histoire', anchorMessageId: null,
      layout: { vertical: 'bottom' as const, align: 'center' as const, fontSize: 16, titleSize: 30, widthPercent: 70 },
    }
    expect(normalizeSavedSettings({ ...defaults, editorialPages: [page] }, defaults, chat).editorialPages)
      .toEqual([page])
  })

  it('restores custom physical dimensions with safe bounds', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    expect(normalizeSavedSettings({ ...defaults, format: 'custom', customSize: { widthMm: 180, heightMm: 240 } }, defaults, chat))
      .toMatchObject({ format: 'custom', customSize: { widthMm: 180, heightMm: 240 } })
  })

  it.each([
    ['album', 'collage'],
    ['conversation', 'journal'],
  ] as const)('migrates the retired %s composition to %s', (retired, replacement) => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const saved = { ...defaults, theme: retired, title: 'Notre histoire' }
    const restored = normalizeSavedSettings(saved, defaults, chat)
    expect(restored.theme).toBe(replacement)
    expect(restored.title).toBe(saved.title)
    expect(restored.includedParticipants).toEqual(saved.includedParticipants)
    expect(restored.photoOverrides).toEqual(saved.photoOverrides)
  })

  it.each(['gazette', 'photo-story', 'collage'] as const)(
    'preserves the %s composition when reopening a project',
    (theme) => {
      const defaults = createInitialSettings(chat, 'chat.zip')
      expect(normalizeSavedSettings({ ...defaults, theme }, defaults, chat).theme).toBe(theme)
    },
  )

  it.each(['bullet', 'travel', 'scrapbook'] as const)(
    'restores the %s journaling preset without replacing its settings',
    (preset) => {
      const defaults = createInitialSettings(chat, 'chat.zip')
      const artDirection = clonePresetArtDirection(preset)
      const saved = {
        ...defaults,
        accent: BOOK_STYLE_PRESETS[preset].accent,
        artDirection,
      }
      const restored = normalizeSavedSettings(saved, defaults, chat)
      expect(restored.artDirection).toEqual(artDirection)
      expect(restored.accent).toBe(saved.accent)
    },
  )

  it('restores valid exclusions and the selected cover', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const settings = normalizeSavedSettings(
      {
        ...defaults,
        title: 'Notre livre',
        excludedMessageIds: ['one'],
        coverMediaName: 'IMG-001.jpg',
        coverPhotoOverride: {
          mediaName: 'IMG-001.jpg',
          fit: 'cover',
          focalX: 25,
          focalY: 70,
          rotation: 90,
        },
        captionOverrides: [{ messageId: 'photo', text: 'Légende locale' }],
        participantProfiles: [{
          participant: 'Sam',
          displayName: 'Samuel',
          color: '#315FA7',
        }],
        editorialPages: [{
          id: 'intro',
          kind: 'introduction',
          title: 'Avant-propos',
          body: 'Notre histoire.',
          anchorMessageId: 'photo',
        }],
        showTableOfContents: true,
        bookmarks: [{ messageId: 'one', label: 'Premier souvenir' }],
      },
      defaults,
      chat,
    )

    expect(settings).toMatchObject({
      title: 'Notre livre',
      excludedMessageIds: ['one'],
      coverMediaName: 'IMG-001.jpg',
      coverPhotoOverride: {
        mediaName: 'IMG-001.jpg',
        fit: 'cover',
        focalX: 25,
        focalY: 70,
        rotation: 90,
      },
      captionOverrides: [{ messageId: 'photo', text: 'Légende locale' }],
      participantProfiles: [{
        participant: 'Sam',
        displayName: 'Samuel',
        color: '#315fa7',
      }],
      editorialPages: [{
        id: 'intro',
        kind: 'introduction',
        title: 'Avant-propos',
        body: 'Notre histoire.',
        anchorMessageId: null,
      }],
      showTableOfContents: true,
      bookmarks: [{ messageId: 'one', label: 'Premier souvenir' }],
    })
  })

  it('drops references that do not belong to the imported chat', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const settings = normalizeSavedSettings(
      {
        ...defaults,
        includedParticipants: ['Lina', 'Intrus'],
        excludedMessageIds: ['missing'],
        coverMediaName: 'missing.jpg',
        coverPhotoOverride: {
          mediaName: 'missing.jpg',
          fit: 'cover',
          focalX: 130,
          focalY: -10,
          rotation: 90,
        },
        maxPhotosPerPage: 99,
        pageBreakBeforeIds: ['one', 'missing'],
        chapters: [
          { messageId: 'photo', title: '  Le voyage  ' },
          { messageId: 'photo', title: 'Doublon' },
          { messageId: 'missing', title: 'Intrus' },
          { messageId: 'one', title: '   ' },
        ],
        photoOverrides: [
          {
            messageId: 'photo',
            layout: 'wide',
            fit: 'cover',
            focalX: 130,
            focalY: -10,
            rotation: 90,
            showCaption: false,
          },
          {
            messageId: 'missing',
            layout: 'full-page',
            fit: 'contain',
            focalX: 50,
            focalY: 50,
            rotation: 0,
            showCaption: true,
          },
        ],
        captionOverrides: [
          { messageId: 'missing', text: 'Intrus' },
          { messageId: 'photo', text: 'Valide' },
        ],
        participantProfiles: [
          { participant: 'Intrus', displayName: 'Non', color: '#123456' },
          { participant: 'Sam', displayName: '  Sami  ', color: 'red' },
        ],
        editorialPages: [
          { id: '../bad', kind: 'text', title: 'Non', body: 'Non', anchorMessageId: 'one' },
          { id: 'valid', kind: 'text', title: '  Repère  ', body: 'Texte', anchorMessageId: 'missing' },
        ],
        bookmarks: [
          { messageId: 'missing', label: 'Intrus' },
          { messageId: 'one', label: '  Début  ' },
        ],
      },
      defaults,
      chat,
    )

    expect(settings.includedParticipants).toEqual(['Lina'])
    expect(settings.excludedMessageIds).toEqual([])
    expect(settings.coverMediaName).toBeNull()
    expect(settings.coverPhotoOverride).toBeNull()
    expect(settings.maxPhotosPerPage).toBe(4)
    expect(settings.pageBreakBeforeIds).toEqual(['one'])
    expect(settings.chapters).toEqual([
      { messageId: 'photo', title: 'Le voyage' },
    ])
    expect(settings.photoOverrides).toEqual([{
      messageId: 'photo',
      layout: 'wide',
      fit: 'cover',
      focalX: 100,
      focalY: 0,
      rotation: 90,
      showCaption: false,
    }])
    expect(settings.captionOverrides).toEqual([{ messageId: 'photo', text: 'Valide' }])
    expect(settings.participantProfiles).toEqual([])
    expect(settings.editorialPages).toEqual([{
      id: 'valid',
      kind: 'text',
      title: 'Repère',
      body: 'Texte',
      anchorMessageId: null,
    }])
    expect(settings.bookmarks).toEqual([{ messageId: 'one', label: 'Début' }])
  })

  it('rejects invalid scalar settings and unknown properties', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const settings = normalizeSavedSettings({
      ...defaults,
      format: 'poster' as never,
      orientation: 'diagonal' as never,
      theme: 'unsafe' as never,
      accent: 'javascript:alert(1)',
      fontScale: 9,
      dateFrom: 'hier',
      showSystem: 'yes' as never,
      artDirection: {
        ...defaults.artDirection,
        preset: 'unsafe' as never,
        paperColor: 'transparent',
        lineHeight: 9,
        dateHeadingStyle: 'unsafe' as never,
        coverOverlay: -20,
      },
      unknownProperty: 'ignored',
    } as Partial<BookSettings> & { unknownProperty: string }, defaults, chat)

    expect(settings).toMatchObject({
      format: defaults.format,
      orientation: defaults.orientation,
      theme: defaults.theme,
      accent: defaults.accent,
      fontScale: defaults.fontScale,
      dateFrom: defaults.dateFrom,
      showSystem: defaults.showSystem,
      artDirection: {
        ...defaults.artDirection,
        coverOverlay: 0,
      },
    })
    expect(settings).not.toHaveProperty('unknownProperty')
  })

  it('migrates older projects to the default art direction', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const legacy = { ...defaults } as Partial<BookSettings>
    delete legacy.artDirection

    expect(normalizeSavedSettings(legacy, defaults, chat).artDirection).toEqual(
      defaults.artDirection,
    )
  })

  it('migrates older projects without a back cover', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const legacy = { ...defaults } as Partial<BookSettings>
    delete legacy.backCover

    expect(normalizeSavedSettings(legacy, defaults, chat).backCover).toEqual(
      defaults.backCover,
    )
  })

  it('normalizes back-cover settings and blank pages', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const settings = normalizeSavedSettings({
      ...defaults,
      backCover: {
        enabled: true,
        layout: 'photo',
        text: '  Un mot au dos.  ',
        mediaName: 'IMG-001.jpg',
        photoOverride: {
          mediaName: 'IMG-001.jpg',
          fit: 'cover',
          focalX: 130,
          focalY: -10,
          rotation: 270,
        },
        overlay: 140,
        textPosition: 'bottom-left',
      },
      editorialPages: [{
        id: 'blank-page',
        kind: 'blank',
        title: 'Ignoré',
        body: 'Ignoré',
        anchorMessageId: 'photo',
      }],
    }, defaults, chat)

    expect(settings.backCover).toEqual({
      enabled: true,
      layout: 'photo',
      text: '  Un mot au dos.  ',
      mediaName: 'IMG-001.jpg',
      photoOverride: {
        mediaName: 'IMG-001.jpg',
        fit: 'cover',
        focalX: 100,
        focalY: 0,
        rotation: 270,
      },
      overlay: 100,
      textPosition: 'bottom-left',
    })
    expect(settings.editorialPages).toEqual([{
      id: 'blank-page',
      kind: 'blank',
      title: '',
      body: '',
      anchorMessageId: 'photo',
    }])
  })

  it('fills a partial art direction from its validated preset', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const settings = normalizeSavedSettings({
      ...defaults,
      artDirection: { preset: 'modern' } as BookSettings['artDirection'],
    }, defaults, chat)

    expect(settings.artDirection).toMatchObject({
      preset: 'modern',
      fontPair: 'modern',
      density: 'balanced',
      coverLayout: 'full-image',
      coverOverlay: 56,
    })
  })

  it('keeps full-image overlays across the supported range', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const lightOverlay = normalizeSavedSettings({
      ...defaults,
      artDirection: {
        ...defaults.artDirection,
        coverLayout: 'full-image',
        coverOverlay: 12,
      },
    }, defaults, chat)
    const heavyOverlay = normalizeSavedSettings({
      ...defaults,
      artDirection: {
        ...defaults.artDirection,
        coverLayout: 'full-image',
        coverOverlay: 140,
      },
    }, defaults, chat)

    expect(lightOverlay.artDirection.coverOverlay).toBe(12)
    expect(heavyOverlay.artDirection.coverOverlay).toBe(100)
  })

  it('keeps distinct bookmarks for separate continuation pages', () => {
    const defaults = createInitialSettings(chat, 'chat.zip')
    const settings = normalizeSavedSettings({
      ...defaults,
      bookmarks: [
        { messageId: 'photo', label: 'Début' },
        { messageId: 'photo', label: 'Suite', continuationPart: 2 },
        { messageId: 'photo', label: 'Doublon', continuationPart: 2 },
      ],
    }, defaults, chat)

    expect(settings.bookmarks).toEqual([
      { messageId: 'photo', label: 'Début' },
      { messageId: 'photo', label: 'Suite', continuationPart: 2 },
    ])
  })

  it('saves, loads and deletes a project in IndexedDB', async () => {
    const settings = createInitialSettings(chat, 'chat.zip')
    settings.excludedMessageIds = ['one']
    settings.coverMediaName = 'IMG-001.jpg'
    settings.captionOverrides = [{ messageId: 'photo', text: 'Légende locale' }]
    settings.participantProfiles = [{
      participant: 'Sam',
      displayName: 'Samuel',
      color: '#315fa7',
    }]
    settings.editorialPages = [{
      id: 'intro',
      kind: 'introduction',
      title: 'Avant-propos',
      body: 'Notre histoire.',
      anchorMessageId: null,
    }]
    settings.showTableOfContents = true
    settings.bookmarks = [{ messageId: 'one', label: 'Premier souvenir' }]

    const saved = await saveBookProject({
      projectId: 'project-persistence-test',
      archiveName: 'chat.zip',
      settings,
    })
    const loaded = await loadBookProject('project-persistence-test')

    expect(loaded).toEqual(saved)
    await expect(listBookProjects()).resolves.toContainEqual(saved)
    await deleteBookProject('project-persistence-test')
    await expect(loadBookProject('project-persistence-test')).resolves.toBeNull()
  })
})