export type BookVisualPreset =
  | 'timeless'
  | 'modern'
  | 'correspondence'
  | 'graphic'
  | 'minimal'
  | 'bullet'
  | 'travel'
  | 'scrapbook'

export type BookFontPair = 'editorial' | 'literary' | 'modern' | 'correspondence'
export type BookDensity = 'airy' | 'balanced' | 'compact'
export type PageNumberStyle = 'outer' | 'center' | 'hidden'
export type BookDateStyle = 'full' | 'compact' | 'minimal'
export type DateHeadingStyle = 'classic' | 'label' | 'minimal'
export type PhotoFrameStyle = 'square' | 'soft' | 'bordered'
export type ChapterStyle = 'classic' | 'band' | 'minimal'
export type CoverLayout = 'split' | 'full-image' | 'typographic'
export type CoverTitlePosition = 'bottom-left' | 'center'
export type ParticipantPalette = 'custom' | 'accent' | 'neutral'

export const COVER_OVERLAY_MIN = 0
export const COVER_OVERLAY_MAX = 100

export interface BookArtDirection {
  preset: BookVisualPreset
  fontPair: BookFontPair
  paperColor: string
  inkColor: string
  density: BookDensity
  lineHeight: number
  pageNumbers: PageNumberStyle
  dateStyle: BookDateStyle
  dateHeadingStyle: DateHeadingStyle
  photoFrame: PhotoFrameStyle
  chapterStyle: ChapterStyle
  participantPalette: ParticipantPalette
  coverLayout: CoverLayout
  coverTitlePosition: CoverTitlePosition
  coverOverlay: number
}

export interface BookStylePresetDefinition {
  label: string
  description: string
  collection: 'editorial' | 'journaling'
  accent: string
  artDirection: BookArtDirection
}

export const BOOK_STYLE_PRESETS: Record<BookVisualPreset, BookStylePresetDefinition> = {
  timeless: {
    label: 'Intemporel',
    collection: 'editorial',
    description: 'Éditorial, chaleureux et équilibré.',
    accent: '#e6503f',
    artDirection: {
      preset: 'timeless',
      fontPair: 'editorial',
      paperColor: '#ffffff',
      inkColor: '#26302d',
      density: 'balanced',
      lineHeight: 1.45,
      pageNumbers: 'outer',
      dateStyle: 'full',
      dateHeadingStyle: 'classic',
      photoFrame: 'soft',
      chapterStyle: 'classic',
      participantPalette: 'custom',
      coverLayout: 'split',
      coverTitlePosition: 'bottom-left',
      coverOverlay: 32,
    },
  },
  modern: {
    label: 'Moderne',
    collection: 'editorial',
    description: 'Net, direct et contemporain.',
    accent: '#176b67',
    artDirection: {
      preset: 'modern',
      fontPair: 'modern',
      paperColor: '#f8faf8',
      inkColor: '#18221f',
      density: 'balanced',
      lineHeight: 1.4,
      pageNumbers: 'center',
      dateStyle: 'compact',
      dateHeadingStyle: 'label',
      photoFrame: 'square',
      chapterStyle: 'minimal',
      participantPalette: 'accent',
      coverLayout: 'full-image',
      coverTitlePosition: 'bottom-left',
      coverOverlay: 56,
    },
  },
  correspondence: {
    label: 'Correspondance',
    collection: 'editorial',
    description: 'Littéraire, intime et aéré.',
    accent: '#9d4561',
    artDirection: {
      preset: 'correspondence',
      fontPair: 'correspondence',
      paperColor: '#fffdf8',
      inkColor: '#382f31',
      density: 'airy',
      lineHeight: 1.55,
      pageNumbers: 'outer',
      dateStyle: 'full',
      dateHeadingStyle: 'classic',
      photoFrame: 'bordered',
      chapterStyle: 'classic',
      participantPalette: 'custom',
      coverLayout: 'split',
      coverTitlePosition: 'center',
      coverOverlay: 28,
    },
  },
  graphic: {
    label: 'Graphique',
    collection: 'editorial',
    description: 'Contrasté, dense et affirmé.',
    accent: '#315fa7',
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
      coverOverlay: 62,
    },
  },
  minimal: {
    label: 'Minimal',
    collection: 'editorial',
    description: 'Calme, blanc et essentiel.',
    accent: '#46534f',
    artDirection: {
      preset: 'minimal',
      fontPair: 'literary',
      paperColor: '#ffffff',
      inkColor: '#252b29',
      density: 'airy',
      lineHeight: 1.5,
      pageNumbers: 'hidden',
      dateStyle: 'minimal',
      dateHeadingStyle: 'minimal',
      photoFrame: 'soft',
      chapterStyle: 'minimal',
      participantPalette: 'neutral',
      coverLayout: 'typographic',
      coverTitlePosition: 'center',
      coverOverlay: 0,
    },
  },
  bullet: {
    label: 'Bullet journal',
    collection: 'journaling',
    description: 'Papier pointillé, encre nette et dates compactes.',
    accent: '#386552',
    artDirection: {
      preset: 'bullet',
      fontPair: 'modern',
      paperColor: '#ffffff',
      inkColor: '#252b29',
      density: 'compact',
      lineHeight: 1.4,
      pageNumbers: 'outer',
      dateStyle: 'compact',
      dateHeadingStyle: 'label',
      photoFrame: 'square',
      chapterStyle: 'minimal',
      participantPalette: 'neutral',
      coverLayout: 'typographic',
      coverTitlePosition: 'center',
      coverOverlay: 0,
    },
  },
  travel: {
    label: 'Carnet de voyage',
    collection: 'journaling',
    description: 'Papier naturel, photos encadrées et récit littéraire.',
    accent: '#38664b',
    artDirection: {
      preset: 'travel',
      fontPair: 'literary',
      paperColor: '#fffdf6',
      inkColor: '#29382f',
      density: 'balanced',
      lineHeight: 1.5,
      pageNumbers: 'outer',
      dateStyle: 'full',
      dateHeadingStyle: 'classic',
      photoFrame: 'bordered',
      chapterStyle: 'classic',
      participantPalette: 'accent',
      coverLayout: 'split',
      coverTitlePosition: 'bottom-left',
      coverOverlay: 28,
    },
  },
  scrapbook: {
    label: 'Scrapbook',
    collection: 'journaling',
    description: 'Photos instantanées, accents framboise et pages aérées.',
    accent: '#a43f64',
    artDirection: {
      preset: 'scrapbook',
      fontPair: 'editorial',
      paperColor: '#fff9fb',
      inkColor: '#322b32',
      density: 'airy',
      lineHeight: 1.5,
      pageNumbers: 'center',
      dateStyle: 'compact',
      dateHeadingStyle: 'label',
      photoFrame: 'bordered',
      chapterStyle: 'band',
      participantPalette: 'accent',
      coverLayout: 'full-image',
      coverTitlePosition: 'bottom-left',
      coverOverlay: 56,
    },
  },
}

export const DEFAULT_ART_DIRECTION: BookArtDirection = {
  ...BOOK_STYLE_PRESETS.timeless.artDirection,
}

export const FONT_PAIR_META: Record<BookFontPair, {
  label: string
  heading: string
  body: string
}> = {
  editorial: {
    label: 'Éditorial',
    heading: "'Newsreader Variable', serif",
    body: "'DM Sans Variable', sans-serif",
  },
  literary: {
    label: 'Littéraire',
    heading: "'Newsreader Variable', serif",
    body: "'Newsreader Variable', serif",
  },
  modern: {
    label: 'Contemporain',
    heading: "'DM Sans Variable', sans-serif",
    body: "'DM Sans Variable', sans-serif",
  },
  correspondence: {
    label: 'Correspondance',
    heading: "'DM Sans Variable', sans-serif",
    body: "'Newsreader Variable', serif",
  },
}

export const DENSITY_CAPACITY_FACTOR: Record<BookDensity, number> = {
  airy: 0.86,
  balanced: 1,
  compact: 1.14,
}

const DENSITY_PAGE_GEOMETRY: Record<BookDensity, {
  paddingX: string
  paddingTop: string
  paddingBottom: string
}> = {
  airy: { paddingX: '9%', paddingTop: '8%', paddingBottom: '10%' },
  balanced: { paddingX: '8%', paddingTop: '7%', paddingBottom: '9%' },
  compact: { paddingX: '6.5%', paddingTop: '5.5%', paddingBottom: '7%' },
}

const PHOTO_RADIUS: Record<PhotoFrameStyle, string> = {
  square: '0px',
  soft: '3px',
  bordered: '1px',
}

export const SCRAPBOOK_PHOTO_MAT = {
  sideMm: 2,
  bottomMm: 6,
  color: '#ffffff',
}

export function getCompositionColors(artDirection: BookArtDirection, accent: string) {
  return {
    notePaper: mixHex(artDirection.paperColor, accent, 0.08),
    tape: mixHex('#fff8df', accent, 0.3),
  }
}

export function getJournalPageDecoration(
  artDirection: BookArtDirection,
  dimensions = { widthMm: 148, heightMm: 210 },
): { path: string; color: string; strokeWidth: number } | null {
  if (artDirection.preset === 'bullet') {
    const marks: string[] = []
    for (let vertical = 7.5; vertical < dimensions.heightMm - 5; vertical += 5) {
      for (let horizontal = 7.5; horizontal < dimensions.widthMm - 5; horizontal += 5) {
        marks.push(`M${horizontal} ${vertical}h0.01`)
      }
    }
    return {
      path: marks.join(' '),
      color: mixHex(artDirection.inkColor, artDirection.paperColor, 0.82),
      strokeWidth: 0.32,
    }
  }
  if (artDirection.preset === 'travel') {
    const bottom = dimensions.heightMm - 10
    return {
      path: `M7 10V${bottom} M8.5 10V${bottom}`,
      color: mixHex(artDirection.inkColor, artDirection.paperColor, 0.72),
      strokeWidth: 0.2,
    }
  }
  return null
}

export function getBookStyleVariables(
  artDirection: BookArtDirection,
  accent = '#000000',
  dimensions = { widthMm: 148, heightMm: 210 },
): Record<string, string | number> {
  const fonts = FONT_PAIR_META[artDirection.fontPair]
  const geometry = DENSITY_PAGE_GEOMETRY[artDirection.density]
  const compositionColors = getCompositionColors(artDirection, accent)
  const decoration = getJournalPageDecoration(artDirection, dimensions)
  const decorationSvg = decoration
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.widthMm} ${dimensions.heightMm}"><path d="${decoration.path}" fill="none" stroke="${decoration.color}" stroke-width="${decoration.strokeWidth}" stroke-linecap="round"/></svg>`
    : null
  return {
    '--book-paper': artDirection.paperColor,
    '--book-ink': artDirection.inkColor,
    '--book-heading-font': fonts.heading,
    '--book-body-font': fonts.body,
    '--book-muted-ink': ensureReadableColor(
      mixHex(artDirection.inkColor, artDirection.paperColor, 0.35),
      artDirection.paperColor,
    ),
    '--book-line-height': artDirection.lineHeight,
    '--book-page-padding-x': geometry.paddingX,
    '--book-page-padding-top': geometry.paddingTop,
    '--book-page-padding-bottom': geometry.paddingBottom,
    '--book-photo-radius': PHOTO_RADIUS[artDirection.photoFrame],
    '--book-page-decoration': decorationSvg
      ? `url("data:image/svg+xml,${encodeURIComponent(decorationSvg)}")`
      : 'none',
    '--book-photo-mat-side': `${SCRAPBOOK_PHOTO_MAT.sideMm}mm`,
    '--book-photo-mat-bottom': `${SCRAPBOOK_PHOTO_MAT.bottomMm}mm`,
    '--book-photo-mat-color': SCRAPBOOK_PHOTO_MAT.color,
    '--book-note-paper': compositionColors.notePaper,
    '--book-tape-color': compositionColors.tape,
    '--book-readable-accent': ensureReadableColor(accent, artDirection.paperColor),
    '--book-accent-contrast': bestContrastText(accent),
    '--book-cover-overlay': `${Math.min(
      COVER_OVERLAY_MAX,
      Math.max(COVER_OVERLAY_MIN, artDirection.coverOverlay),
    )}%`,
    '--book-cover-scrim': '#000000',
    '--book-cover-text': '#ffffff',
  }
}

export function getBookStyleClassName(artDirection: BookArtDirection): string {
  return [
    `visual-${artDirection.preset}`,
    `font-${artDirection.fontPair}`,
    `density-${artDirection.density}`,
    `page-numbers-${artDirection.pageNumbers}`,
    `dates-${artDirection.dateStyle}`,
    `date-headings-${artDirection.dateHeadingStyle}`,
    `photo-frame-${artDirection.photoFrame}`,
    `chapters-${artDirection.chapterStyle}`,
    `participants-${artDirection.participantPalette}`,
    `cover-${artDirection.coverLayout}`,
    `cover-title-${artDirection.coverTitlePosition}`,
  ].join(' ')
}

function hexChannel(value: string, offset: number): number {
  return Number.parseInt(value.slice(offset, offset + 2), 16) / 255
}

function linearChannel(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

export function contrastRatio(foreground: string, background: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(foreground) || !/^#[0-9a-f]{6}$/i.test(background)) {
    return 1
  }
  const luminance = (color: string) => (
    linearChannel(hexChannel(color, 1)) * 0.2126 +
    linearChannel(hexChannel(color, 3)) * 0.7152 +
    linearChannel(hexChannel(color, 5)) * 0.0722
  )
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}

function parseHex(color: string): [number, number, number] | null {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return null
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
}

function mixHex(source: string, target: string, amount: number): string {
  const sourceChannels = parseHex(source)
  const targetChannels = parseHex(target)
  if (!sourceChannels || !targetChannels) return target
  const channels = sourceChannels.map((channel, index) => (
    Math.round(channel + (targetChannels[index] - channel) * amount)
  ))
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function bestContrastText(background: string): '#000000' | '#ffffff' {
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background)
    ? '#000000'
    : '#ffffff'
}

export function ensureReadableColor(
  foreground: string,
  background: string,
  minimumRatio = 4.5,
): string {
  if (contrastRatio(foreground, background) >= minimumRatio) return foreground.toLowerCase()
  const target = bestContrastText(background)
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHex(foreground, target, step / 20)
    if (contrastRatio(candidate, background) >= minimumRatio) return candidate
  }
  return target
}

export function clonePresetArtDirection(preset: BookVisualPreset): BookArtDirection {
  return { ...BOOK_STYLE_PRESETS[preset].artDirection }
}
