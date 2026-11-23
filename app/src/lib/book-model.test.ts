import { describe, expect, it } from 'vitest'
import type { ChatMessage, ParsedChat } from './chat-types'
import { layoutCompositionPage } from './book-composition'
import {
  applyCaptionOverrides,
  createInitialSettings,
  filterMessages,
  getAlbumDayLayout,
  getCoverPhotoOverride,
  getDayLayoutWeight,
  getBookNavigationEntries,
  getMediaLayoutWeight,
  getPageDimensions,
  getPhotoOverride,
  isDefaultPhotoOverride,
  paginateMessages,
  normalizeCustomSize,
  getEditorialTextGeometry,
  normalizeEditorialLayout,
} from './book-model'

function message(
  id: string,
  day: number,
  sender: string,
  kind: ChatMessage['kind'] = 'message',
): ChatMessage {
  return {
    id,
    timestamp: new Date(2024, 0, day, 10).getTime(),
    sender,
    body: kind === 'media' ? 'Une légende' : 'Un message à conserver.',
    mediaName: kind === 'media' ? `${id}.jpg` : null,
    kind,
  }
}

const messages = [
  message('one', 1, 'Lina'),
  message('two', 2, 'Sam', 'media'),
  message('three', 3, 'Lina', 'system'),
]

const chat: ParsedChat = {
  messages,
  participants: ['Lina', 'Sam'],
  startTimestamp: messages[0].timestamp,
  endTimestamp: messages[2].timestamp,
  mediaReferences: 1,
  warnings: [],
}

describe('book model', () => {
  it('keeps edited text visible when a previously attached omitted video is removed', () => {
    const settings = createInitialSettings(chat, 'chat.zip')
    const missing: ChatMessage = { ...message('missing', 1, 'Lina'), kind: 'missing-media', body: '<media omitted>' }
    settings.showMissingMedia = false
    settings.captionOverrides = [{ messageId: missing.id, text: 'Notre souvenir. '.repeat(120) }]
    const visible = filterMessages([missing], settings)
    const rendered = paginateMessages(visible, settings).flat()
    expect(visible).toHaveLength(1)
    expect(rendered[0].kind).toBe('message')
    expect(rendered.map((entry) => entry.body).join(' ').replace(/\s+/g, ' ').trim())
      .toBe(settings.captionOverrides[0].text.trim())
  })
  it.each(['journal', 'gazette', 'photo-story', 'collage'] as const)('paginates text-only videos in %s without losing their text', (theme) => {
    const settings = { ...createInitialSettings(chat, 'chat.zip'), theme }
    const video = { ...message('video', 1, 'Lina', 'media'), mediaName: 'VID-001.mp4', body: 'Un souvenir précieux. '.repeat(120) }
    settings.photoOverrides = [{ ...getPhotoOverride(settings, video.id), videoTextOnly: true, showCaption: false }]
    const pages = paginateMessages([video], settings)
    const rendered = pages.flat().filter((entry) => entry.sourceMessageId === video.id)
    expect(rendered[0]).toMatchObject({ videoName: video.mediaName, mediaName: null, kind: 'message' })
    expect(rendered.map((entry) => entry.body).join(' ').replace(/\s+/g, ' ').trim())
      .toBe(video.body.trim())
  })

  it('does not hide a video caption when a legacy photo setting hides captions', () => {
    const settings = createInitialSettings(chat, 'chat.zip')
    const video = { ...message('video', 1, 'Lina', 'media'), mediaName: 'VID-001.mp4', body: 'Un souvenir précieux. '.repeat(120) }
    settings.photoOverrides = [{ ...getPhotoOverride(settings, video.id), showCaption: false }]
    const rendered = paginateMessages([video], settings).flat()
    expect(rendered.length).toBeGreaterThan(1)
    expect(rendered.map((entry) => entry.body).join(' ').replace(/\s+/g, ' ').trim()).toBe(video.body.trim())
  })
  it('keeps existing dedications centered when no custom layout was saved', () => {
    const settings = createInitialSettings(chat, 'chat.zip')
    settings.editorialPages = [{ id: 'legacy', kind: 'dedication', title: 'Pour nous', body: 'Merci', anchorMessageId: null }]
    const editorial = paginateMessages([], settings)[0][0]
    expect(getEditorialTextGeometry(editorial, settings).layout.align).toBe('center')
  })

  it('positions and paginates styled free text on a custom page', () => {
    const settings = createInitialSettings(chat, 'chat.zip')
    settings.format = 'custom'
    settings.customSize = { widthMm: 180, heightMm: 240 }
    settings.editorialPages = [{
      id: 'free-text', kind: 'text', title: 'Notre voyage', body: 'Un beau souvenir. '.repeat(300),
      anchorMessageId: null,
      layout: { ...normalizeEditorialLayout(undefined), vertical: 'bottom', align: 'center', fontSize: 18, widthPercent: 70 },
    }]
    const pages = paginateMessages([], settings)
    expect(pages.length).toBeGreaterThan(1)
    pages.forEach((page) => {
      const geometry = getEditorialTextGeometry(page[0], settings)
      expect(geometry.layout.align).toBe('center')
      expect(geometry.fontPt).toBe(18)
      expect(geometry.topMm + geometry.heightMm).toBeLessThan(240)
    })
    expect(pages.flat().map(({ body }) => body).join(' ').replace(/\s+/g, ' ').trim())
      .toBe(settings.editorialPages[0].body.trim())
  })

  it('uses custom physical dimensions and preserves orientation', () => {
    expect(getPageDimensions('custom', 'portrait', { widthMm: 180, heightMm: 240 }))
      .toEqual({ widthMm: 180, heightMm: 240, label: 'Personnalisé' })
    expect(getPageDimensions('custom', 'landscape', { widthMm: 180, heightMm: 240 }))
      .toMatchObject({ widthMm: 240, heightMm: 180 })
    expect(normalizeCustomSize({ widthMm: 0, heightMm: Number.NaN }))
      .toEqual({ widthMm: 80, heightMm: 210 })
  })

  it.each((['gazette', 'photo-story', 'collage'] as const).flatMap((theme) => (
    (['a5', 'a4', 'letter', 'square'] as const).flatMap((format) => (
      (['portrait', 'landscape'] as const).flatMap((orientation) => (
        [0.85, 1.2].map((fontScale) => ({ theme, format, orientation, fontScale }))
      ))
    ))
  )))(
    'paginates $theme on $format/$orientation at $fontScale without losing or overflowing content',
    ({ theme, format, orientation, fontScale }) => {
      const settings = { ...createInitialSettings(chat, 'chat.zip'), theme, format, orientation, fontScale }
      settings.photoOverrides = [{
        ...getPhotoOverride(settings, 'composition-0'),
        layout: 'wide',
      }]
      const content = Array.from({ length: 30 }, (_, index) => ({
        ...message(`composition-${index}`, 1, index % 2 ? 'Lina' : 'Sam', index % 3 === 0 ? 'media' : 'message'),
        body: 'Les souvenirs du voyage restent avec nous. '.repeat(index % 5 + 1),
      }))
      settings.photoAspectRatios = Object.fromEntries(content.flatMap((entry, index) => (
        entry.mediaName ? [[entry.mediaName, index % 2 ? 2 / 3 : 3 / 2]] : []
      )))
      const pages = paginateMessages(content, settings)
      expect(pages.length).toBeGreaterThan(1)
      expect([...new Set(pages.flat().map(({ sourceMessageId }) => sourceMessageId))])
        .toEqual(content.map(({ id }) => id))
      content.forEach((source) => {
        const restoredBody = pages.flat()
          .filter((entry) => entry.sourceMessageId === source.id)
          .map(({ body }) => body)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        expect(restoredBody).toBe(source.body.replace(/\s+/g, ' ').trim())
      })
      pages.forEach((page) => {
        expect(layoutCompositionPage(page, {
          theme,
          ...getPageDimensions(settings.format, settings.orientation),
          fontScale: settings.fontScale,
          lineHeight: settings.artDirection.lineHeight,
          photoOverrides: settings.photoOverrides,
          photoAspectRatios: settings.photoAspectRatios,
        }).fits).toBe(true)
      })
    },
  )

  it('creates settings from the archive metadata', () => {
    const settings = createInitialSettings(chat, 'WhatsApp Chat - Lina & Sam.zip')

    expect(settings.title).toBe('Lina & Sam')
    expect(settings.dateFrom).toBe('2024-01-01')
    expect(settings.dateTo).toBe('2024-01-03')
    expect(settings.includedParticipants).toEqual(['Lina', 'Sam'])
    expect(settings.photoOverrides).toEqual([])
    expect(settings.coverPhotoOverride).toBeNull()
    expect(settings.captionOverrides).toEqual([])
    expect(settings.participantProfiles).toEqual([])
    expect(settings.editorialPages).toEqual([])
    expect(settings.showTableOfContents).toBe(false)
    expect(settings.bookmarks).toEqual([])
    expect(settings.artDirection).toMatchObject({
      preset: 'timeless',
      density: 'balanced',
      paperColor: '#ffffff',
    })
  })

  it('resolves individual photo settings with safe non-cropping defaults', () => {
    const settings = createInitialSettings(chat, 'chat.zip')

    expect(getPhotoOverride(settings, 'photo')).toEqual({
      messageId: 'photo',
      layout: 'auto',
      fit: 'contain',
      focalX: 50,
      focalY: 50,
      rotation: 0,
      showCaption: true,
    })
    expect(isDefaultPhotoOverride(getPhotoOverride(settings, 'photo'))).toBe(true)
  })

  it('returns a persisted individual photo override', () => {
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      photoOverrides: [{
        messageId: 'two',
        layout: 'wide' as const,
        fit: 'cover' as const,
        focalX: 25,
        focalY: 70,
        rotation: 90 as const,
        showCaption: false,
      }],
    }

    const override = getPhotoOverride(settings, 'two')
    expect(override).toMatchObject({ layout: 'wide', rotation: 90 })
    expect(isDefaultPhotoOverride(override)).toBe(false)
  })

  it('keeps pagination stable for color-only style changes', () => {
    const content = Array.from({ length: 80 }, (_, index) => (
      message(`styled-${index}`, (index % 12) + 1, 'Lina')
    ))
    const defaults = createInitialSettings(chat, 'chat.zip')
    const recolored = {
      ...defaults,
      artDirection: {
        ...defaults.artDirection,
        paperColor: '#f8faf8',
        inkColor: '#18221f',
      },
    }

    expect(paginateMessages(content, recolored)).toEqual(
      paginateMessages(content, defaults),
    )
  })

  it('lets visual density change pagination capacity', () => {
    const content = Array.from({ length: 80 }, (_, index) => (
      message(`density-${index}`, (index % 12) + 1, 'Lina')
    ))
    const defaults = createInitialSettings(chat, 'chat.zip')
    const airy = {
      ...defaults,
      artDirection: { ...defaults.artDirection, density: 'airy' as const },
    }
    const compact = {
      ...defaults,
      artDirection: { ...defaults.artDirection, density: 'compact' as const },
    }

    expect(paginateMessages(content, airy).length).toBeGreaterThan(
      paginateMessages(content, compact).length,
    )
  })

  it('reserves more pages for a larger line height', () => {
    const content = Array.from({ length: 80 }, (_, index) => (
      message(`line-height-${index}`, (index % 12) + 1, 'Lina')
    ))
    const defaults = createInitialSettings(chat, 'chat.zip')
    const tight = {
      ...defaults,
      artDirection: { ...defaults.artDirection, lineHeight: 1.2 },
    }
    const loose = {
      ...defaults,
      artDirection: { ...defaults.artDirection, lineHeight: 1.8 },
    }

    expect(paginateMessages(content, loose).length).toBeGreaterThan(
      paginateMessages(content, tight).length,
    )
  })

  it('reserves less date-heading space for the minimal treatment', () => {
    const content = Array.from({ length: 96 }, (_, index) => (
      message(`date-heading-${index}`, (index % 24) + 1, 'Lina')
    ))
    const defaults = createInitialSettings(chat, 'chat.zip')
    const classic = {
      ...defaults,
      artDirection: {
        ...defaults.artDirection,
        dateHeadingStyle: 'classic' as const,
      },
    }
    const minimal = {
      ...defaults,
      artDirection: {
        ...defaults.artDirection,
        dateHeadingStyle: 'minimal' as const,
      },
    }

    expect(paginateMessages(content, classic).length).toBeGreaterThan(
      paginateMessages(content, minimal).length,
    )
  })

  it('keeps cover framing tied to the selected media', () => {
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      coverPhotoOverride: {
        mediaName: 'two.jpg',
        fit: 'cover' as const,
        focalX: 20,
        focalY: 75,
        rotation: 90 as const,
      },
    }

    expect(getCoverPhotoOverride(settings, 'two.jpg')).toMatchObject({
      fit: 'cover',
      focalX: 20,
      focalY: 75,
      rotation: 90,
    })
    expect(getCoverPhotoOverride(settings, 'another.jpg')).toEqual({
      mediaName: 'another.jpg',
      fit: 'contain',
      focalX: 50,
      focalY: 50,
      rotation: 0,
    })
  })

  it('applies a local caption without mutating the source message', () => {
    const source = messages[1]
    const edited = applyCaptionOverrides([source], {
      captionOverrides: [{ messageId: source.id, text: 'Légende réécrite' }],
    })

    expect(edited[0].body).toBe('Légende réécrite')
    expect(source.body).toBe('Une légende')
  })

  it('swaps paper dimensions in landscape mode', () => {
    expect(getPageDimensions('a5', 'landscape')).toMatchObject({
      widthMm: 210,
      heightMm: 148,
    })
  })

  it('filters dates, participants and optional entries', () => {
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      dateTo: '2024-01-02',
      includedParticipants: ['Sam'],
    }

    expect(filterMessages(messages, settings).map(({ id }) => id)).toEqual(['two'])
  })

  it('removes individually excluded messages from the book', () => {
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      excludedMessageIds: ['two'],
    }

    expect(filterMessages(messages, settings).map(({ id }) => id)).toEqual(['one'])
  })

  it('allocates day height proportionally to photos and caption text', () => {
    const singlePhoto = [message('single', 1, 'Lina', 'media')]
    const twoPhotos = [
      message('first-photo', 1, 'Lina', 'media'),
      message('second-photo', 1, 'Sam', 'media'),
    ]
    const captionedPhoto = [{
      ...message('captioned', 1, 'Lina', 'media'),
      body: 'Une légende assez longue pour occuper une ligne dans le livre.',
    }]

    expect(getDayLayoutWeight(singlePhoto)).toBeCloseTo(1.15)
    expect(getDayLayoutWeight(twoPhotos)).toBeCloseTo(2.3)
    expect(getDayLayoutWeight(captionedPhoto)).toBeCloseTo(1.15)
  })

  it('compensates text messages sharing a day with photos', () => {
    const mixedDay = [
      message('photo', 1, 'Lina', 'media'),
      message('text', 1, 'Sam'),
    ]

    expect(getDayLayoutWeight(mixedDay)).toBeGreaterThan(
      getDayLayoutWeight([mixedDay[0]]),
    )
  })

  it('gives captioned media enough block height to preserve image size', () => {
    const shortCaption = message('short', 1, 'Lina', 'media')
    const longCaption = {
      ...message('long', 1, 'Lina', 'media'),
      body: 'Une longue légende '.repeat(30),
    }

    expect(getMediaLayoutWeight(shortCaption)).toBeCloseTo(1.07)
    expect(getMediaLayoutWeight(longCaption)).toBeGreaterThan(
      getMediaLayoutWeight(shortCaption),
    )
  })

  it('pairs short Album photos and widens long captions or orphans', () => {
    const first = { ...message('first', 1, 'Lina', 'media'), body: '' }
    const second = { ...message('second', 1, 'Sam', 'media'), body: '' }
    const third = { ...message('third', 1, 'Lina', 'media'), body: '' }
    const long = {
      ...message('long-album', 1, 'Lina', 'media'),
      body: 'Une légende éditoriale très détaillée. '.repeat(8),
    }

    expect(getAlbumDayLayout([first, second])).toEqual({
      rowCount: 1,
      mediaRows: 1,
      rowTemplate: 'minmax(0, 1fr)',
      wideMessageIds: [],
    })
    expect(getAlbumDayLayout([first, second, third])).toEqual({
      rowCount: 2,
      mediaRows: 2,
      rowTemplate: 'minmax(0, 1fr) minmax(0, 1fr)',
      wideMessageIds: ['third'],
    })
    expect(getAlbumDayLayout([long, first])).toEqual({
      rowCount: 2,
      mediaRows: 2,
      rowTemplate: 'minmax(0, 1fr) minmax(0, 1fr)',
      wideMessageIds: ['long-album', 'first'],
    })
  })

  it('keeps Album text rows at natural height', () => {
    const photo = { ...message('photo-row', 1, 'Lina', 'media'), body: '' }
    const text = message('text-row', 1, 'Sam')

    expect(getAlbumDayLayout([photo, text])).toMatchObject({
      rowCount: 2,
      mediaRows: 1,
      rowTemplate: 'minmax(0, 1fr) auto',
      wideMessageIds: ['photo-row'],
    })
  })

  it('weights Album days by rows rather than raw photo count', () => {
    const pair = [
      { ...message('first', 1, 'Lina', 'media'), body: '' },
      { ...message('second', 1, 'Sam', 'media'), body: '' },
    ]

    expect(getDayLayoutWeight(pair, 'album')).toBe(1)
    expect(getDayLayoutWeight(pair, 'journal')).toBe(2)
  })

  it('paginates without losing or duplicating messages', () => {
    const settings = createInitialSettings(chat, 'chat.zip')
    const manyMessages = Array.from({ length: 80 }, (_, index) =>
      message(`message-${index}`, (index % 12) + 1, index % 2 ? 'Lina' : 'Sam'),
    )

    const pages = paginateMessages(manyMessages, settings)

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.flat().map(({ id }) => id)).toEqual(
      manyMessages.map(({ id }) => id),
    )
  })

  it('enforces the configured maximum number of photos per page', () => {
    const photos = Array.from({ length: 7 }, (_, index) =>
      message(`photo-${index}`, 1, 'Lina', 'media'),
    )
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      format: 'a4' as const,
      maxPhotosPerPage: 3,
    }

    const pages = paginateMessages(photos, settings)

    expect(pages.map((page) => page.filter(({ mediaName }) => mediaName).length)).toEqual([
      3,
      3,
      1,
    ])
  })

  it('isolates a full-page photo before and after surrounding messages', () => {
    const content = [
      message('before', 1, 'Lina'),
      message('hero', 1, 'Lina', 'media'),
      message('after', 1, 'Sam'),
    ]
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      photoOverrides: [{
        messageId: 'hero',
        layout: 'full-page' as const,
        fit: 'contain' as const,
        focalX: 50,
        focalY: 50,
        rotation: 0 as const,
        showCaption: true,
      }],
    }

    const pages = paginateMessages(content, settings)

    expect(pages.map((page) => page.map(({ sourceMessageId }) => sourceMessageId))).toEqual([
      ['before'],
      ['hero'],
      ['after'],
    ])
  })

  it('does not split a hidden photo caption into continuation pages', () => {
    const photo = {
      ...message('hidden-caption', 1, 'Lina', 'media'),
      body: 'Longue légende. '.repeat(200),
    }
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      photoOverrides: [{
        messageId: 'hidden-caption',
        layout: 'auto' as const,
        fit: 'contain' as const,
        focalX: 50,
        focalY: 50,
        rotation: 0 as const,
        showCaption: false,
      }],
    }

    expect(paginateMessages([photo], settings).flat()).toHaveLength(1)
  })

  it('uses four photos per page by default', () => {
    expect(createInitialSettings(chat, 'chat.zip').maxPhotosPerPage).toBe(4)
  })

  it('starts a new page before a manually selected message', () => {
    const sameDayMessages = [
      message('first', 1, 'Lina'),
      message('second', 1, 'Sam'),
      message('third', 1, 'Lina'),
    ]
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      pageBreakBeforeIds: ['second'],
    }

    const pages = paginateMessages(sameDayMessages, settings)

    expect(pages[0].map(({ sourceMessageId }) => sourceMessageId)).toEqual(['first'])
    expect(pages[1].map(({ sourceMessageId }) => sourceMessageId)).toEqual([
      'second',
      'third',
    ])
  })

  it('forces a chapter onto a new page and decorates its first message', () => {
    const sameDayMessages = [
      message('first', 1, 'Lina'),
      message('second', 1, 'Sam'),
    ]
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      chapters: [{ messageId: 'second', title: 'Le départ' }],
    }

    const pages = paginateMessages(sameDayMessages, settings)

    expect(pages).toHaveLength(2)
    expect(pages[1][0]).toMatchObject({
      sourceMessageId: 'second',
      chapterTitle: 'Le départ',
    })
  })

  it('isolates a personal text page before its anchor message', () => {
    const content = [
      message('first', 1, 'Lina'),
      message('second', 1, 'Sam'),
    ]
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      editorialPages: [{
        id: 'souvenir',
        kind: 'text' as const,
        title: 'Avant le départ',
        body: 'Quelques mots personnels.',
        anchorMessageId: 'second',
      }],
    }

    const pages = paginateMessages(content, settings)

    expect(pages.map((page) => page.map(({ id }) => id))).toEqual([
      ['first'],
      ['editorial-souvenir'],
      ['second'],
    ])
    expect(pages[1][0].editorial).toMatchObject({
      kind: 'text',
      title: 'Avant le départ',
    })
  })

  it('keeps blank pages isolated and out of navigation', () => {
    const content = [
      message('first', 1, 'Lina'),
      message('second', 2, 'Sam'),
    ]
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      backCover: {
        ...createInitialSettings(chat, 'chat.zip').backCover,
        enabled: true,
      },
      editorialPages: [
        {
          id: 'pause',
          kind: 'blank' as const,
          title: '',
          body: '',
          anchorMessageId: 'second',
        },
        {
          id: 'final-blank',
          kind: 'blank' as const,
          title: '',
          body: '',
          anchorMessageId: null,
        },
      ],
    }

    const pages = paginateMessages(content, settings)

    expect(pages.map((page) => page[0].id)).toEqual([
      'first',
      'editorial-pause',
      'second',
      'editorial-final-blank',
    ])
    expect(pages[1][0].editorial?.kind).toBe('blank')
    expect(pages[3][0].editorial?.kind).toBe('blank')
    expect(getBookNavigationEntries(pages, settings)).toEqual([
      expect.objectContaining({ label: 'Couverture', pageIndex: 0 }),
      expect.objectContaining({
        label: 'Quatrième de couverture',
        pageIndex: pages.length + 1,
      }),
    ])
  })

  it('derives a table of contents from final chapter and editorial pages', () => {
    const content = [
      message('first', 1, 'Lina'),
      message('second', 2, 'Sam'),
    ]
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      showTableOfContents: true,
      chapters: [{ messageId: 'second', title: 'Le départ' }],
      editorialPages: [{
        id: 'intro',
        kind: 'introduction' as const,
        title: 'Avant-propos',
        body: 'Notre histoire.',
        anchorMessageId: null,
      }],
      bookmarks: [{ messageId: 'first', label: 'Premier souvenir' }],
    }

    const pages = paginateMessages(content, settings)
    const table = pages.find((page) => (
      page[0]?.editorial?.kind === 'table-of-contents'
    ))

    expect(pages[0][0].editorial?.kind).toBe('introduction')
    expect(table?.[0].editorial?.entries).toEqual([
      expect.objectContaining({ label: 'Avant-propos', page: 1 }),
      expect.objectContaining({ label: 'Premier souvenir', page: 3 }),
      expect.objectContaining({ label: 'Le départ', page: 4 }),
    ])
    expect(getBookNavigationEntries(pages, settings).map(({ label }) => label)).toEqual([
      'Couverture',
      'Avant-propos',
      'Sommaire',
      'Premier souvenir',
      'Le départ',
    ])
  })

  it('continues an oversized personal page without mixing chat messages', () => {
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      orientation: 'landscape' as const,
      fontScale: 1.2,
      editorialPages: [{
        id: 'long-intro',
        kind: 'introduction' as const,
        title: 'Une longue histoire',
        body: Array.from(
          { length: 30 },
          (_, index) => `Paragraphe personnel ${index + 1} à conserver dans le livre.`,
        ).join('\n'),
        anchorMessageId: null,
      }],
    }

    const pages = paginateMessages([message('chat', 1, 'Lina')], settings)
    const editorialPages = pages.filter((page) => page[0]?.editorial?.pageId === 'long-intro')

    expect(editorialPages.length).toBeGreaterThan(1)
    expect(editorialPages.every((page) => page.length === 1)).toBe(true)
    expect(editorialPages.flat().every((part) => (
      part.continuation?.total === editorialPages.length
    ))).toBe(true)
    expect(editorialPages.flat().map(({ body }) => body).join('\n')).toContain(
      'Paragraphe personnel 30',
    )
  })

  it('keeps an editorial page when its anchor is outside the selection', () => {
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      editorialPages: [{
        id: 'detached',
        kind: 'text' as const,
        title: 'Souvenir conservé',
        body: 'Cette page reste dans le livre.',
        anchorMessageId: 'filtered-message',
      }],
    }

    const pages = paginateMessages([message('visible', 1, 'Lina')], settings)

    expect(pages.map((page) => page[0].id)).toEqual([
      'visible',
      'editorial-detached',
    ])
  })

  it('accounts for multiple table of contents pages in printed numbers', () => {
    const content = Array.from({ length: 16 }, (_, index) => (
      message(`chapter-${index + 1}`, index + 1, 'Lina')
    ))
    const settings = {
      ...createInitialSettings(chat, 'chat.zip'),
      showTableOfContents: true,
      chapters: content.map((entry, index) => ({
        messageId: entry.id,
        title: `Chapitre ${index + 1}`,
      })),
    }

    const pages = paginateMessages(content, settings)
    const tablePages = pages.filter((page) => (
      page[0]?.editorial?.kind === 'table-of-contents'
    ))
    const entries = tablePages.flatMap((page) => page[0].editorial?.entries ?? [])

    expect(tablePages).toHaveLength(2)
    expect(tablePages.map((page) => page[0].editorial?.entries?.length)).toEqual([14, 2])
    expect(entries[0]).toMatchObject({ label: 'Chapitre 1', page: 3 })
    expect(entries.at(-1)).toMatchObject({ label: 'Chapitre 16', page: 18 })
  })

  it('reduces table of contents capacity for airy A5 landscape pages', () => {
    const content = Array.from({ length: 14 }, (_, index) => (
      message(`airy-chapter-${index + 1}`, index + 1, 'Lina')
    ))
    const defaults = createInitialSettings(chat, 'chat.zip')
    const settings = {
      ...defaults,
      orientation: 'landscape' as const,
      showTableOfContents: true,
      chapters: content.map((entry, index) => ({
        messageId: entry.id,
        title: `Chapitre aéré ${index + 1}`,
      })),
      artDirection: {
        ...defaults.artDirection,
        density: 'airy' as const,
        lineHeight: 1.8,
      },
    }

    const pages = paginateMessages(content, settings)
    const tablePages = pages.filter((page) => (
      page[0]?.editorial?.kind === 'table-of-contents'
    ))
    const entries = tablePages.flatMap((page) => page[0].editorial?.entries ?? [])

    expect(tablePages.map((page) => page[0].editorial?.entries?.length)).toEqual([5, 5, 4])
    expect(entries[0]).toMatchObject({ label: 'Chapitre aéré 1', page: 4 })
    expect(entries.at(-1)).toMatchObject({ label: 'Chapitre aéré 14', page: 17 })
  })

  it('splits a message that is taller than an A5 landscape page', () => {
    const longMessage = {
      ...message('long', 1, 'Lina'),
      body: Array.from(
        { length: 18 },
        (_, index) => `Paragraphe ${index + 1} avec une phrase à conserver.`,
      ).join('\n'),
    }
    const settings = {
      ...createInitialSettings({ ...chat, messages: [longMessage] }, 'chat.zip'),
      orientation: 'landscape' as const,
      fontScale: 1.2,
    }

    const pages = paginateMessages([longMessage], settings)
    const parts = pages.flat()

    expect(parts.length).toBeGreaterThan(1)
    expect(pages.every((page) => page.length === 1)).toBe(true)
    expect(parts.every((part) => part.continuation?.total === parts.length)).toBe(true)
    expect(parts.map((part) => part.body).join('\n')).toContain('Paragraphe 18')
  })

  it('keeps the photo on the first page of a long caption continuation', () => {
    const longCaption = {
      ...message('photo', 1, 'Lina', 'media'),
      body: Array.from(
        { length: 24 },
        (_, index) => `Ligne de légende ${index + 1} avec son contexte.`,
      ).join('\n'),
    }
    const settings = {
      ...createInitialSettings({ ...chat, messages: [longCaption] }, 'chat.zip'),
      orientation: 'landscape' as const,
      theme: 'conversation' as const,
      fontScale: 1.2,
    }

    const parts = paginateMessages([longCaption], settings).flat()

    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0]).toMatchObject({ kind: 'media', mediaName: 'photo.jpg' })
    expect(parts.slice(1).every((part) => (
      part.kind === 'message' && part.mediaName === null
    ))).toBe(true)
  })

  it('navigates a bookmark to the exact continuation page', () => {
    const longMessage = {
      ...message('continued', 1, 'Lina'),
      body: Array.from(
        { length: 32 },
        (_, index) => `Ligne ${index + 1} de ce souvenir très détaillé.`,
      ).join('\n'),
    }
    const settings = {
      ...createInitialSettings({ ...chat, messages: [longMessage] }, 'chat.zip'),
      orientation: 'landscape' as const,
      fontScale: 1.2,
      showTableOfContents: true,
      bookmarks: [{
        messageId: 'continued',
        label: 'Suite précise',
        continuationPart: 2,
      }],
    }

    const pages = paginateMessages([longMessage], settings)
    const targetPageIndex = pages.findIndex((page) => page.some((entry) => (
      entry.sourceMessageId === 'continued' && entry.continuation?.part === 2
    )))
    const navigation = getBookNavigationEntries(pages, settings)
    const tableEntry = pages.flatMap((page) => (
      page[0]?.editorial?.entries ?? []
    )).find((entry) => entry.label === 'Suite précise')

    expect(targetPageIndex).toBeGreaterThan(0)
    expect(navigation).toContainEqual(expect.objectContaining({
      label: 'Suite précise',
      pageIndex: targetPageIndex + 1,
    }))
    expect(tableEntry?.page).toBe(targetPageIndex + 1)

    const collapsedPages = paginateMessages([
      { ...longMessage, body: 'Une version courte.' },
    ], settings)
    expect(getBookNavigationEntries(collapsedPages, settings)).toContainEqual(
      expect.objectContaining({
        label: 'Suite précise',
        pageIndex: 2,
      }),
    )
  })

  it('uses the same pagination for both square orientations', () => {
    const manyMessages = Array.from({ length: 40 }, (_, index) =>
      message(`square-${index}`, (index % 12) + 1, 'Lina'),
    )
    const portrait = {
      ...createInitialSettings(chat, 'chat.zip'),
      format: 'square' as const,
      orientation: 'portrait' as const,
    }
    const landscape = { ...portrait, orientation: 'landscape' as const }

    expect(paginateMessages(manyMessages, landscape)).toEqual(
      paginateMessages(manyMessages, portrait),
    )
  })
})