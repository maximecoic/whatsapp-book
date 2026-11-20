import { describe, expect, it } from 'vitest'
import { layoutCompositionPage, type CompositionOptions } from './book-composition'
import type { ChatMessage } from './chat-types'

const options: CompositionOptions = {
  theme: 'gazette',
  widthMm: 148,
  heightMm: 210,
  fontScale: 1,
  lineHeight: 1.45,
  photoOverrides: [],
}

function message(index: number, photo = false): ChatMessage {
  return {
    id: `message-${index}`,
    sender: 'Lina',
    timestamp: new Date(2024, 0, 1, 10, index).getTime(),
    body: 'Un souvenir de notre voyage. '.repeat(3),
    mediaName: photo ? `photo-${index}.jpg` : null,
    kind: photo ? 'media' : 'message',
  }
}

describe('designed book compositions', () => {
  it('removes the repeated collage heading and gives its space to photos', () => {
    const photos = Array.from({ length: 3 }, (_, index) => message(index, true))
    const plain = layoutCompositionPage(photos, { ...options, theme: 'collage' })
    const chapter = layoutCompositionPage(
      [{ ...photos[0], chapterTitle: 'Notre voyage' }, ...photos.slice(1)],
      { ...options, theme: 'collage' },
    )
    expect(plain.headerMm).toBe(0)
    expect(plain.headerGapMm).toBe(0)
    expect(chapter.headerMm).toBe(20)
    expect(chapter.headerGapMm).toBe(3)
    expect(plain.heightMm - chapter.heightMm).toBe(23)
    expect(plain.items[0].photoHeightMm).toBeGreaterThan(chapter.items[0].photoHeightMm)
    expect(plain.fits).toBe(true)
    expect(chapter.fits).toBe(true)
  })

  it('flows the gazette down two distinct columns in reading order', () => {
    const messages = Array.from({ length: 7 }, (_, index) => message(index))
    const layout = layoutCompositionPage(messages, options)
    expect(new Set(layout.items.map((item) => item.xMm)).size).toBe(2)
    expect(layout.items.map((item) => item.message.id)).toEqual(messages.map(({ id }) => id))
    expect(layout.items.find((item) => item.xMm > 0)?.yMm).toBe(0)
  })

  it('gives the photographic story a date rail and a dominant image', () => {
    const layout = layoutCompositionPage([message(0, true)], { ...options, theme: 'photo-story' })
    expect(layout.items[0].xMm).toBe(22)
    expect(layout.items[0].photoHeightMm).toBeGreaterThan(80)
    expect(layout.items[0].widthMm).toBe(106)
    expect(layout.fits).toBe(true)
  })

  it('keeps collage notes in chronological order between photos', () => {
    const layout = layoutCompositionPage(
      [message(0, true), message(1), message(2, true)],
      { ...options, theme: 'collage' },
    )
    expect(layout.items[0].rotation).not.toBe(0)
    expect(layout.items[1].rotation).toBe(0)
    expect(layout.items[1].yMm).toBeGreaterThan(layout.items[0].yMm)
    expect(layout.items[2].yMm).toBeGreaterThan(layout.items[1].yMm)
    expect(layout.items[0].heightMm).not.toBe(layout.items[1].heightMm)
  })

  it.each([1, 3, 5])('uses complete rows for %s photos without an empty final cell', (count) => {
    const photos = Array.from({ length: count }, (_, index) => ({ ...message(index, true), body: '' }))
    const layout = layoutCompositionPage(photos, { ...options, theme: 'collage' })
    expect(layout.fits).toBe(true)
    expect(layout.photoRows.reduce((total, length) => total + length, 0)).toBe(count)
    const rows = new Map<number, typeof layout.items>()
    layout.items.forEach((item) => rows.set(item.yMm, [...(rows.get(item.yMm) ?? []), item]))
    rows.forEach((row) => {
      expect(row[0].xMm).toBeGreaterThanOrEqual(0)
      const last = row.at(-1)!
      expect(row[0].xMm).toBeCloseTo(layout.widthMm - last.xMm - last.widthMm)
    })
    if (count === 1) expect(layout.items[0].widthMm).toBe(layout.widthMm)
    if (count === 3) expect(layout.photoRows).toEqual([1, 2])
  })

  it('scales constrained photo frames proportionally instead of leaving empty bands', () => {
    const photos = Array.from({ length: 3 }, (_, index) => message(index, true))
    const layout = layoutCompositionPage(photos, { ...options, theme: 'collage' })
    expect(layout.fits).toBe(true)
    layout.items.forEach((item) => {
      expect((item.widthMm - layout.tilePaddingMm * 2) / item.photoHeightMm)
        .toBeCloseTo(4 / 3)
    })
  })

  it.each(['half', 'wide'] as const)('respects a manually chosen %s photo width', (photoLayout) => {
    const photo = message(0, true)
    const layout = layoutCompositionPage([photo], {
      ...options,
      theme: 'collage',
      photoOverrides: [{
        messageId: photo.id,
        layout: photoLayout,
        fit: 'contain',
        focalX: 50,
        focalY: 50,
        rotation: 0,
        showCaption: true,
      }],
    })
    expect(layout.fits).toBe(true)
    expect(layout.items[0].widthMm).toBeCloseTo(photoLayout === 'wide'
      ? layout.widthMm
      : (layout.widthMm - layout.gapMm) / 2)
  })

  it('adapts photo widths to portrait, landscape and rotated aspect ratios', () => {
    const photos = [message(0, true), message(1, true), message(2, true)]
    const layout = layoutCompositionPage(photos, {
      ...options,
      theme: 'collage',
      photoAspectRatios: { 'photo-0.jpg': 2 / 3, 'photo-1.jpg': 3 / 2, 'photo-2.jpg': 2 / 3 },
      photoOverrides: [{
        messageId: photos[2].id,
        layout: 'auto',
        fit: 'contain',
        rotation: 90,
        focalX: 50,
        focalY: 50,
        showCaption: true,
      }],
    })
    expect(layout.fits).toBe(true)
    const rotated = layout.items[2]
    const portrait = layout.items[0]
    expect(rotated.widthMm / rotated.photoHeightMm)
      .toBeGreaterThan(portrait.widthMm / portrait.photoHeightMm)
  })

  it('accepts a panoramic photo at its natural short height', () => {
    const layout = layoutCompositionPage([{ ...message(0, true), body: '' }], {
      ...options,
      theme: 'collage',
      photoAspectRatios: { 'photo-0.jpg': 10 },
    })
    expect(layout.fits).toBe(true)
    expect(layout.items[0].photoHeightMm).toBeLessThan(16)
    expect(layout.items[0].widthMm).toBe(layout.widthMm)
  })

  it('reports overflow instead of silently clipping long content', () => {
    const layout = layoutCompositionPage(
      [message(0), { ...message(1), body: 'Long souvenir. '.repeat(500) }],
      options,
    )
    expect(layout.fits).toBe(false)
  })

  it.each(['gazette', 'photo-story', 'collage'] as const)(
    'keeps a full-page photo and its caption inside the %s composition',
    (theme) => {
      const photo = message(0, true)
      const layout = layoutCompositionPage([photo], {
        ...options,
        theme,
        photoOverrides: [{
          messageId: photo.id,
          layout: 'full-page',
          fit: 'contain',
          focalX: 50,
          focalY: 50,
          rotation: 0,
          showCaption: true,
        }],
      })
      expect(layout.fullPagePhoto).toBe(true)
      expect(layout.items[0].xMm).toBe(0)
      expect(layout.items[0].rotation).toBe(0)
      expect(layout.items[0].widthMm).toBe(layout.widthMm)
      expect(layout.fits).toBe(true)
    },
  )
})