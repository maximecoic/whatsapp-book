import { describe, expect, it } from 'vitest'
import {
  BOOK_STYLE_PRESETS,
  bestContrastText,
  clonePresetArtDirection,
  contrastRatio,
  ensureReadableColor,
  getBookStyleClassName,
  getBookStyleVariables,
} from './book-style'

describe('book style', () => {
  it('provides five independent art direction presets', () => {
    expect(Object.keys(BOOK_STYLE_PRESETS)).toEqual([
      'timeless',
      'modern',
      'correspondence',
      'graphic',
      'minimal',
    ])

    const modern = clonePresetArtDirection('modern')
    modern.paperColor = '#000000'
    expect(BOOK_STYLE_PRESETS.modern.artDirection.paperColor).toBe('#f8faf8')
  })

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
