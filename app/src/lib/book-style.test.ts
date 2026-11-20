import { describe, expect, it } from 'vitest'
import {
  BOOK_STYLE_PRESETS,
  bestContrastText,
  clonePresetArtDirection,
  contrastRatio,
  ensureReadableColor,
  getBookStyleClassName,
  getBookStyleVariables,
  getJournalPageDecoration,
} from './book-style'

describe('book style', () => {
  it('provides independent editorial and journaling presets', () => {
    expect(Object.keys(BOOK_STYLE_PRESETS)).toEqual([
      'timeless',
      'modern',
      'correspondence',
      'graphic',
      'minimal',
      'bullet',
      'travel',
      'scrapbook',
    ])

    const modern = clonePresetArtDirection('modern')
    modern.paperColor = '#000000'
    expect(BOOK_STYLE_PRESETS.modern.artDirection.paperColor).toBe('#f8faf8')
  })

  it.each(Object.keys(BOOK_STYLE_PRESETS) as Array<keyof typeof BOOK_STYLE_PRESETS>)(
    'keeps the %s preset readable and independently editable',
    (preset) => {
      const definition = BOOK_STYLE_PRESETS[preset]
      const artDirection = clonePresetArtDirection(preset)
      expect(artDirection.preset).toBe(preset)
      expect(contrastRatio(artDirection.inkColor, artDirection.paperColor))
        .toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(definition.accent, artDirection.paperColor))
        .toBeGreaterThanOrEqual(3)
      artDirection.paperColor = '#000000'
      expect(definition.artDirection.paperColor).not.toBe('#000000')
    },
  )

  it('derives stable CSS classes and variables from structured settings', () => {
    const artDirection = clonePresetArtDirection('graphic')

    expect(getBookStyleClassName(artDirection)).toContain('visual-graphic')
    expect(getBookStyleClassName(artDirection)).toContain('cover-full-image')
    expect(getBookStyleClassName(artDirection)).toContain('date-headings-label')
    expect(getBookStyleVariables(artDirection)).toMatchObject({
      '--book-paper': '#f5f3ee',
      '--book-ink': '#18202d',
      '--book-body-font': "'DM Sans Variable', sans-serif",
      '--book-page-padding-x': '6.5%',
      '--book-cover-overlay': '62%',
    })
  })

  it('shares print-sized journaling decorations between CSS and PDF', () => {
    const bullet = clonePresetArtDirection('bullet')
    const size = { widthMm: 210, heightMm: 148 }
    const decoration = getJournalPageDecoration(bullet, size)
    expect(decoration?.path).toContain('M7.5 7.5h0.01')
    expect(decoration?.path).toContain('M202.5 142.5h0.01')
    expect(decoration?.path).not.toContain('M207.5')
    const background = getBookStyleVariables(bullet, '#386552', size)['--book-page-decoration']
    expect(decodeURIComponent(String(background))).toContain('viewBox="0 0 210 148"')
    expect(decodeURIComponent(String(background))).toContain(decoration?.path)
    expect(getJournalPageDecoration(clonePresetArtDirection('travel'), size)?.path)
      .toBe('M7 10V138 M8.5 10V138')
    expect(getJournalPageDecoration(clonePresetArtDirection('timeless'))).toBeNull()
    expect(getBookStyleVariables(clonePresetArtDirection('scrapbook')))
      .toMatchObject({
        '--book-photo-mat-side': '2mm',
        '--book-photo-mat-bottom': '6mm',
        '--book-page-decoration': 'none',
      })
  })

  it('clamps cover overlays to the complete percentage range', () => {
    const artDirection = clonePresetArtDirection('modern')
    artDirection.coverOverlay = -20
    expect(getBookStyleVariables(artDirection)['--book-cover-overlay']).toBe('0%')

    artDirection.coverOverlay = 140
    expect(getBookStyleVariables(artDirection)['--book-cover-overlay']).toBe('100%')
  })

  it('calculates print contrast thresholds', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21)
    expect(contrastRatio('#777777', '#777777')).toBe(1)
    expect(contrastRatio('invalid', '#ffffff')).toBe(1)
  })

  it('automatically makes accents readable for print', () => {
    const adjusted = ensureReadableColor('#e6503f', '#ffffff')

    expect(contrastRatio(adjusted, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(bestContrastText('#e6503f')).toBe('#000000')
    expect(bestContrastText('#18202d')).toBe('#ffffff')
  })
})
