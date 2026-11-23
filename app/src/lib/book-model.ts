import type {
  ChatMessage,
  ParsedChat,
  TableOfContentsEntry,
} from './chat-types'
import { DEFAULT_VIDEO_TIME, isVideoMedia, showMediaCaption } from './video-frame'
import type { ManualVideoAssociation } from './manual-video'
import {
  getCompositionLineWidth,
  getCompositionMetrics,
  getCompositionPhotoHeight,
  isDesignedComposition,
  layoutCompositionPage,
  type DesignedComposition,
} from './book-composition'
import {
  DEFAULT_ART_DIRECTION,
  DENSITY_CAPACITY_FACTOR,
  type BookArtDirection,
  type CoverTitlePosition,
} from './book-style'

export type BookFormat = 'a5' | 'a4' | 'letter' | 'square' | 'custom'
export type BookOrientation = 'portrait' | 'landscape'
export type BookTheme = 'journal' | 'conversation' | 'album' | DesignedComposition
export type PhotoLayout = 'auto' | 'wide' | 'half' | 'full-page'
export type PhotoFit = 'contain' | 'cover'
export type PhotoRotation = 0 | 90 | 180 | 270

export interface PhotoTransform {
  fit: PhotoFit
  focalX: number
  focalY: number
  rotation: PhotoRotation
}

export interface PhotoOverride extends PhotoTransform {
  messageId: string
  layout: PhotoLayout
  showCaption: boolean
  videoTime?: number
  videoTextOnly?: boolean
}

export interface CoverPhotoOverride extends PhotoTransform {
  mediaName: string
}

export type BackCoverLayout = 'photo' | 'text'

export interface BackCoverSettings {
  enabled: boolean
  layout: BackCoverLayout
  text: string
  mediaName: string | null
  photoOverride: CoverPhotoOverride | null
  overlay: number
  textPosition: CoverTitlePosition
}

export const DEFAULT_PHOTO_OVERRIDE: Omit<PhotoOverride, 'messageId'> = {
  layout: 'auto',
  fit: 'contain',
  focalX: 50,
  focalY: 50,
  rotation: 0,
  showCaption: true,
}

export const DEFAULT_COVER_PHOTO_OVERRIDE: Omit<CoverPhotoOverride, 'mediaName'> = {
  fit: 'contain',
  focalX: 50,
  focalY: 50,
  rotation: 0,
}

export const DEFAULT_BACK_COVER: BackCoverSettings = {
  enabled: false,
  layout: 'text',
  text: '',
  mediaName: null,
  photoOverride: null,
  overlay: 48,
  textPosition: 'center',
}

export interface BookChapter {
  messageId: string
  title: string
}

export interface CaptionOverride {
  messageId: string
  text: string
}

export interface ParticipantProfile {
  participant: string
  displayName: string
  color: string
}

export type EditorialPageKind =
  | 'dedication'
  | 'introduction'
  | 'text'
  | 'epilogue'
  | 'blank'

export interface EditorialPage {
  id: string
  kind: EditorialPageKind
  title: string
  body: string
  anchorMessageId: string | null
  layout?: EditorialTextLayout
}

export interface EditorialTextLayout {
  vertical: 'top' | 'center' | 'bottom'
  align: 'left' | 'center' | 'right'
  fontSize: number
  titleSize: number
  widthPercent: number
}

export function normalizeEditorialLayout(value: unknown): EditorialTextLayout {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const numeric = (input: unknown, fallback: number, min: number, max: number) => (
    typeof input === 'number' && Number.isFinite(input) ? Math.min(max, Math.max(min, input)) : fallback
  )
  return {
    vertical: ['top', 'center', 'bottom'].includes(String(candidate.vertical)) ? candidate.vertical as EditorialTextLayout['vertical'] : 'center',
    align: ['left', 'center', 'right'].includes(String(candidate.align)) ? candidate.align as EditorialTextLayout['align'] : 'left',
    fontSize: numeric(candidate.fontSize, 11, 8, 24),
    titleSize: numeric(candidate.titleSize, 25, 12, 40),
    widthPercent: numeric(candidate.widthPercent, 100, 50, 100),
  }
}

export interface BookBookmark {
  messageId: string
  label: string
  continuationPart?: number
}

export interface BookNavigationEntry {
  id: string
  label: string
  pageIndex: number
  type: 'cover' | 'back-cover' | 'chapter' | 'editorial' | 'bookmark' | 'table-of-contents'
}

export interface BookSettings {
  title: string
  subtitle: string
  format: BookFormat
  customSize?: { widthMm: number; heightMm: number }
  orientation: BookOrientation
  theme: BookTheme
  accent: string
  fontScale: number
  artDirection: BookArtDirection
  maxPhotosPerPage: number
  dateFrom: string
  dateTo: string
  includedParticipants: string[]
  showSystem: boolean
  showMissingMedia: boolean
  showDeleted: boolean
  coverMediaName: string | null
  coverPhotoOverride: CoverPhotoOverride | null
  backCover: BackCoverSettings
  excludedMessageIds: string[]
  pageBreakBeforeIds: string[]
  chapters: BookChapter[]
  photoOverrides: PhotoOverride[]
  videoAssociations?: ManualVideoAssociation[]
  photoAspectRatios?: Record<string, number>
  captionOverrides: CaptionOverride[]
  participantProfiles: ParticipantProfile[]
  editorialPages: EditorialPage[]
  showTableOfContents: boolean
  bookmarks: BookBookmark[]
}

export interface PageDimensions {
  widthMm: number
  heightMm: number
  label: string
}

const FORMATS: Record<Exclude<BookFormat, 'custom'>, PageDimensions> = {
  a5: { widthMm: 148, heightMm: 210, label: 'A5' },
  a4: { widthMm: 210, heightMm: 297, label: 'A4' },
  letter: { widthMm: 215.9, heightMm: 279.4, label: 'Letter' },
  square: { widthMm: 210, heightMm: 210, label: 'Carré' },
}

const BASE_BOOK_LINE_HEIGHT = 1.45

export function normalizeCustomSize(value: unknown): { widthMm: number; heightMm: number } {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const dimension = (input: unknown, fallback: number) => typeof input === 'number' && Number.isFinite(input)
    ? Math.round(Math.min(420, Math.max(80, input)) * 10) / 10
    : fallback
  return { widthMm: dimension(candidate.widthMm, 148), heightMm: dimension(candidate.heightMm, 210) }
}

function toDateInput(timestamp: number | null): string {
  if (timestamp === null) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getPageDimensions(
  format: BookFormat,
  orientation: BookOrientation,
  customSize?: { widthMm: number; heightMm: number },
): PageDimensions {
  const dimensions = format === 'custom'
    ? { ...normalizeCustomSize(customSize), label: 'Personnalisé' }
    : FORMATS[format]
  if (orientation === 'portrait') return dimensions
  return {
    ...dimensions,
    widthMm: dimensions.heightMm,
    heightMm: dimensions.widthMm,
  }
}

export function createInitialSettings(
  chat: ParsedChat,
  archiveName: string,
): BookSettings {
  const title = archiveName
    .replace(/\.zip$/i, '')
    .replace(/^whatsapp chat\s*[-–—]?\s*/i, '')
    .replaceAll('_', ' ')
    .trim()

  return {
    title: title || 'Notre histoire',
    subtitle: 'Une conversation à garder',
    format: 'a5',
    orientation: 'portrait',
    theme: 'journal',
    accent: '#e6503f',
    fontScale: 1,
    artDirection: { ...DEFAULT_ART_DIRECTION },
    maxPhotosPerPage: 4,
    dateFrom: toDateInput(chat.startTimestamp),
    dateTo: toDateInput(chat.endTimestamp),
    includedParticipants: chat.participants,
    showSystem: false,
    showMissingMedia: false,
    showDeleted: false,
    coverMediaName: null,
    coverPhotoOverride: null,
    backCover: { ...DEFAULT_BACK_COVER },
    excludedMessageIds: [],
    pageBreakBeforeIds: [],
    chapters: [],
    photoOverrides: [],
    videoAssociations: [],
    captionOverrides: [],
    participantProfiles: [],
    editorialPages: [],
    showTableOfContents: false,
    bookmarks: [],
  }
}

export function getPhotoOverride(
  settings: Pick<BookSettings, 'photoOverrides'>,
  messageId: string,
): PhotoOverride {
  return settings.photoOverrides.find((override) => (
    override.messageId === messageId
  )) ?? { messageId, ...DEFAULT_PHOTO_OVERRIDE }
}

export function getCoverPhotoOverride(
  settings: Pick<BookSettings, 'coverPhotoOverride'>,
  mediaName: string,
): CoverPhotoOverride {
  return settings.coverPhotoOverride?.mediaName === mediaName
    ? settings.coverPhotoOverride
    : { mediaName, ...DEFAULT_COVER_PHOTO_OVERRIDE }
}

export function getBackCoverPhotoOverride(
  settings: Pick<BookSettings, 'backCover'>,
  mediaName: string,
): CoverPhotoOverride {
  return settings.backCover.photoOverride?.mediaName === mediaName
    ? settings.backCover.photoOverride
    : { mediaName, ...DEFAULT_COVER_PHOTO_OVERRIDE }
}

export function isDefaultPhotoOverride(
  override: Omit<PhotoOverride, 'messageId'>,
): boolean {
  return (
    override.layout === DEFAULT_PHOTO_OVERRIDE.layout &&
    override.fit === DEFAULT_PHOTO_OVERRIDE.fit &&
    override.focalX === DEFAULT_PHOTO_OVERRIDE.focalX &&
    override.focalY === DEFAULT_PHOTO_OVERRIDE.focalY &&
    override.rotation === DEFAULT_PHOTO_OVERRIDE.rotation &&
    override.showCaption === DEFAULT_PHOTO_OVERRIDE.showCaption &&
    (override.videoTime ?? DEFAULT_VIDEO_TIME) === DEFAULT_VIDEO_TIME &&
    !override.videoTextOnly
  )
}

export function isDefaultCoverPhotoOverride(
  override: Omit<CoverPhotoOverride, 'mediaName'>,
): boolean {
  return (
    override.fit === DEFAULT_COVER_PHOTO_OVERRIDE.fit &&
    override.focalX === DEFAULT_COVER_PHOTO_OVERRIDE.focalX &&
    override.focalY === DEFAULT_COVER_PHOTO_OVERRIDE.focalY &&
    override.rotation === DEFAULT_COVER_PHOTO_OVERRIDE.rotation
  )
}

export function filterMessages(
  messages: ChatMessage[],
  settings: BookSettings,
): ChatMessage[] {
  const start = settings.dateFrom
    ? new Date(`${settings.dateFrom}T00:00:00`).getTime()
    : Number.NEGATIVE_INFINITY
  const end = settings.dateTo
    ? new Date(`${settings.dateTo}T23:59:59.999`).getTime()
    : Number.POSITIVE_INFINITY
  const participants = new Set(settings.includedParticipants)
  const excludedMessages = new Set(settings.excludedMessageIds)
  const editedMessages = new Set(settings.captionOverrides.filter((override) => override.text.trim()).map((override) => override.messageId))

  return messages.filter((message) => {
    if (excludedMessages.has(message.id)) return false
    if (message.timestamp < start || message.timestamp > end) return false
    if (message.kind === 'system') return settings.showSystem
    if (message.kind === 'missing-media') return settings.showMissingMedia || editedMessages.has(message.id)
    if (message.kind === 'deleted') return settings.showDeleted
    return !message.sender || participants.has(message.sender)
  })
}

export function applyCaptionOverrides(
  messages: ChatMessage[],
  settings: Pick<BookSettings, 'captionOverrides'>,
): ChatMessage[] {
  const captions = new Map(
    settings.captionOverrides.map((override) => [override.messageId, override.text]),
  )
  return messages.map((message) => {
    const caption = captions.get(message.id)
    return caption === undefined ? message : {
      ...message,
      body: caption,
      kind: message.kind === 'missing-media' && caption.trim() ? 'message' : message.kind,
    }
  })
}

export function getParticipantProfile(
  settings: Pick<BookSettings, 'participantProfiles'>,
  participant: string | null,
): ParticipantProfile | null {
  if (!participant) return null
  return settings.participantProfiles.find((profile) => (
    profile.participant === participant
  )) ?? null
}

function createEditorialMessage(
  page: EditorialPage,
  timestamp: number,
): ChatMessage {
  return {
    id: `editorial-${page.id}`,
    timestamp,
    sender: null,
    body: page.body,
    mediaName: null,
    kind: 'editorial',
    editorial: {
      pageId: page.id,
      kind: page.kind,
      title: page.title,
      layout: page.layout,
    },
  }
}

function insertEditorialPages(
  messages: ChatMessage[],
  settings: Pick<BookSettings, 'editorialPages'>,
): ChatMessage[] {
  if (settings.editorialPages.length === 0) return messages

  const firstTimestamp = messages[0]?.timestamp ?? Date.now()
  const lastTimestamp = messages.at(-1)?.timestamp ?? firstTimestamp
  const visibleMessageIds = new Set(messages.map((message) => message.id))
  const frontPages = settings.editorialPages.filter((page) => (
    page.kind === 'dedication' || page.kind === 'introduction'
  )).sort((left, right) => (
    (left.kind === 'dedication' ? 0 : 1) - (right.kind === 'dedication' ? 0 : 1)
  ))
  const backPages = settings.editorialPages.filter((page) => (
    page.kind === 'epilogue' || (
      (page.kind === 'text' || page.kind === 'blank') && (
        !page.anchorMessageId || !visibleMessageIds.has(page.anchorMessageId)
      )
    )
  )).sort((left, right) => (
    (left.kind === 'epilogue' ? 1 : 0) - (right.kind === 'epilogue' ? 1 : 0)
  ))
  const pagesByAnchor = new Map<string, EditorialPage[]>()
  settings.editorialPages.forEach((page) => {
    if (
      (page.kind !== 'text' && page.kind !== 'blank') ||
      !page.anchorMessageId ||
      !visibleMessageIds.has(page.anchorMessageId)
    ) return
    const current = pagesByAnchor.get(page.anchorMessageId) ?? []
    current.push(page)
    pagesByAnchor.set(page.anchorMessageId, current)
  })

  return [
    ...frontPages.map((page) => createEditorialMessage(page, firstTimestamp)),
    ...messages.flatMap((message) => [
      ...(pagesByAnchor.get(message.id) ?? []).map((page) => (
        createEditorialMessage(page, message.timestamp)
      )),
      message,
    ]),
    ...backPages.map((page) => createEditorialMessage(page, lastTimestamp)),
  ]
}

function pageCapacity(settings: BookSettings): number {
  if (isDesignedComposition(settings.theme)) {
    const metrics = getCompositionMetrics(compositionOptions(settings, settings.theme))
    return Math.max(8, (metrics.heightMm - 15) / metrics.lineMm)
  }
  const baseCapacity: Record<BookFormat, number> = {
    a5: 22,
    a4: 40,
    letter: 37,
    square: 27,
    custom: 22 * getPageDimensions(settings.format, settings.orientation, settings.customSize).heightMm / 210,
  }
  const orientationFactor =
    settings.format !== 'square' && settings.format !== 'custom' && settings.orientation === 'landscape' ? 0.82 : 1
  const themeFactor = settings.theme === 'album' ? 0.88 : 1
  return (
    (
      baseCapacity[settings.format] *
      orientationFactor *
      themeFactor *
      DENSITY_CAPACITY_FACTOR[settings.artDirection.density] *
      (BASE_BOOK_LINE_HEIGHT / settings.artDirection.lineHeight)
    ) /
    settings.fontScale
  )
}

function estimatedLineWidth(settings: BookSettings): number {
  if (isDesignedComposition(settings.theme)) {
    return getCompositionLineWidth(compositionOptions(settings, settings.theme))
  }
  const baseWidth = settings.format === 'custom'
    ? 62 * getPageDimensions(settings.format, settings.orientation, settings.customSize).widthMm / 148
    : settings.format !== 'square' && settings.orientation === 'landscape'
    ? 92
    : 62
  const densityFactor = settings.artDirection.density === 'compact'
    ? 1.04
    : settings.artDirection.density === 'airy'
      ? 0.97
      : 1
  const fontFactor = settings.artDirection.fontPair === 'literary' ||
    settings.artDirection.fontPair === 'correspondence'
    ? 0.94
    : 1
  return Math.max(settings.format === 'custom' ? 18 : 40, Math.round(baseWidth * densityFactor * fontFactor))
}

function dateHeadingWeight(settings: BookSettings): number {
  if (settings.artDirection.dateHeadingStyle === 'minimal') return 1
  if (settings.artDirection.dateHeadingStyle === 'label') return 1.7
  if (settings.artDirection.dateStyle === 'minimal') return 1.3
  if (settings.artDirection.dateStyle === 'compact') return 1.8
  return 2.2
}

function chapterHeadingWeight(settings: BookSettings): number {
  if (settings.artDirection.chapterStyle === 'minimal') return 3.2
  if (settings.artDirection.chapterStyle === 'band') return 4.8
  return 4.5
}

function textLineCount(body: string, lineWidth: number): number {
  if (!body) return 0
  return body
    .split('\n')
    .reduce(
      (total, line) => total + Math.max(1, Math.ceil(line.length / lineWidth)),
      0,
    )
}

export function getEditorialTextGeometry(message: ChatMessage, settings: BookSettings) {
  const dimensions = getPageDimensions(settings.format, settings.orientation, settings.customSize)
  const layout = normalizeEditorialLayout(message.editorial?.layout)
  if (!message.editorial?.layout && message.editorial?.kind === 'dedication') layout.align = 'center'
  const paddingMm = Math.max(8, Math.min(dimensions.widthMm, dimensions.heightMm) * 0.08)
  const widthMm = (dimensions.widthMm - paddingMm * 2) * layout.widthPercent / 100
  const fontPt = layout.fontSize * settings.fontScale
  const titlePt = layout.titleSize * settings.fontScale
  const lineMm = fontPt * 25.4 / 72 * settings.artDirection.lineHeight
  const characters = Math.max(10, Math.floor(widthMm / (fontPt * 25.4 / 72 * 0.56)))
  const title = message.editorial?.title ?? ''
  const titleLines = title ? textLineCount(title, Math.max(8, Math.floor(widthMm / (titlePt * 25.4 / 72 * 0.56)))) : 0
  const headerMm = titleLines ? 5 + titleLines * titlePt * 25.4 / 72 * 1.1 + 6 : 0
  const availableMm = dimensions.heightMm - paddingMm * 2 - 8
  const heightMm = headerMm + textLineCount(message.body, characters) * lineMm + (message.continuation ? 6 : 0)
  const freeMm = Math.max(0, availableMm - heightMm)
  return {
    layout, widthMm, heightMm, fontPt, titlePt, lineMm, headerMm, characters,
    leftMm: (dimensions.widthMm - widthMm) / 2,
    topMm: paddingMm + (layout.vertical === 'center' ? freeMm / 2 : layout.vertical === 'bottom' ? freeMm : 0),
    maxLines: Math.max(1, Math.floor((availableMm - headerMm - 6) / lineMm)),
  }
}

const DAY_LAYOUT_LINE_WIDTH = 90
const DAY_LAYOUT_LINE_WEIGHT = 0.15
const DAY_LAYOUT_MESSAGE_OVERHEAD = 0.25
const MEDIA_LAYOUT_LINE_WEIGHT = 0.07
const ALBUM_COLUMN_LINE_WIDTH = 45
const ALBUM_WIDE_CAPTION_LINES = 3

export interface AlbumDayLayout {
  rowCount: number
  mediaRows: number
  rowTemplate: string
  wideMessageIds: string[]
}

export function getAlbumDayLayout(
  messages: ChatMessage[],
  photoOverrides: PhotoOverride[] = [],
): AlbumDayLayout {
  const wideMessageIds = new Set<string>()
  let pendingMedia: { id: string; forcedHalf: boolean } | null = null
  let mediaRows = 0
  const rowTracks: string[] = []
  const overrideByMessage = new Map(
    photoOverrides.map((override) => [override.messageId, override]),
  )

  const flushPendingMedia = () => {
    if (!pendingMedia) return
    if (!pendingMedia.forcedHalf) wideMessageIds.add(pendingMedia.id)
    pendingMedia = null
    mediaRows += 1
    rowTracks.push('minmax(0, 1fr)')
  }

  messages.forEach((message) => {
    if (!message.mediaName) {
      flushPendingMedia()
      rowTracks.push('auto')
      return
    }

    const messageId = message.sourceMessageId ?? message.id
    const override = overrideByMessage.get(messageId) ?? {
      messageId,
      ...DEFAULT_PHOTO_OVERRIDE,
    }
    const caption = showMediaCaption(message.mediaName, override.showCaption) ? message.body : ''
    const hasLongCaption = override.layout === 'auto' && textLineCount(
      caption,
      DAY_LAYOUT_LINE_WIDTH,
    ) >= ALBUM_WIDE_CAPTION_LINES
    const forcesWide = (
      override.layout === 'wide' ||
      override.layout === 'full-page' ||
      hasLongCaption
    )
    if (forcesWide) {
      flushPendingMedia()
      wideMessageIds.add(message.id)
      mediaRows += 1
      rowTracks.push('minmax(0, 1fr)')
      return
    }

    if (pendingMedia) {
      pendingMedia = null
      mediaRows += 1
      rowTracks.push('minmax(0, 1fr)')
    } else {
      pendingMedia = {
        id: message.id,
        forcedHalf: override.layout === 'half',
      }
    }
  })
  flushPendingMedia()

  return {
    rowCount: Math.max(1, rowTracks.length),
    mediaRows,
    rowTemplate: rowTracks.join(' ') || 'auto',
    wideMessageIds: [...wideMessageIds],
  }
}

export function getMediaLayoutWeight(
  message: ChatMessage,
  override: PhotoOverride = {
    messageId: message.sourceMessageId ?? message.id,
    ...DEFAULT_PHOTO_OVERRIDE,
  },
): number {
  if (!message.mediaName) return 1
  return 1 +
    textLineCount(
      showMediaCaption(message.mediaName, override.showCaption) ? message.body : '',
      DAY_LAYOUT_LINE_WIDTH,
    ) * MEDIA_LAYOUT_LINE_WEIGHT
}

export function getDayLayoutWeight(
  messages: ChatMessage[],
  theme: BookTheme = 'journal',
  photoOverrides: PhotoOverride[] = [],
): number {
  const mediaMessages = messages.filter((message) => message.mediaName)
  if (mediaMessages.length === 0) return 1

  const albumLayout = theme === 'album'
    ? getAlbumDayLayout(messages, photoOverrides)
    : null
  const albumWideMessages = new Set(albumLayout?.wideMessageIds ?? [])
  const overrideByMessage = new Map(
    photoOverrides.map((override) => [override.messageId, override]),
  )
  const captionLines = mediaMessages.reduce(
    (total, message) => {
      const messageId = message.sourceMessageId ?? message.id
      const override = overrideByMessage.get(messageId)
      return total + textLineCount(
      showMediaCaption(message.mediaName, override?.showCaption) ? message.body : '',
      theme === 'album' && !albumWideMessages.has(message.id)
        ? ALBUM_COLUMN_LINE_WIDTH
        : DAY_LAYOUT_LINE_WIDTH,
      )
    },
    0,
  )
  const textMessages = messages.filter((message) => !message.mediaName)
  const textLines = textMessages.reduce(
    (total, message) => total + textLineCount(
      message.body,
      DAY_LAYOUT_LINE_WIDTH,
    ),
    0,
  )

  return Math.max(
    1,
    (albumLayout?.mediaRows ?? mediaMessages.length) +
      (captionLines + textLines) * DAY_LAYOUT_LINE_WEIGHT +
      textMessages.length * DAY_LAYOUT_MESSAGE_OVERHEAD,
  )
}

function mediaBaseWeight(settings: BookSettings, message?: ChatMessage): number {
  if (isDesignedComposition(settings.theme)) {
    const options = compositionOptions(settings, settings.theme)
    const metrics = getCompositionMetrics(options)
    const override = message ? getPhotoOverride(settings, message.sourceMessageId ?? message.id) : null
    const width = settings.theme === 'photo-story'
      ? metrics.widthMm - 22
      : override?.layout === 'wide'
        ? metrics.widthMm
        : (metrics.widthMm - metrics.gapMm) / 2
    const height = getCompositionPhotoHeight(options, width - (settings.theme === 'collage' ? 8 : 0))
    return height / metrics.lineMm + 6
  }
  return settings.theme === 'album'
    ? 5.5
    : settings.theme === 'conversation'
      ? 8
      : 7.5
}

function messageWeight(message: ChatMessage, settings: BookSettings): number {
  const sourceMessageId = message.sourceMessageId ?? message.id
  const override = message.mediaName
    ? getPhotoOverride(settings, sourceMessageId)
    : null
  const textWeight = textLineCount(
    showMediaCaption(message.mediaName, override?.showCaption) ? message.body : '',
    estimatedLineWidth(settings),
  )

  if (message.kind === 'media') {
    return mediaBaseWeight(settings, message) + textWeight
  }
  if (message.kind === 'editorial') return pageCapacity(settings)
  if (message.kind === 'system') return 1.5
  if (message.kind === 'missing-media' || message.kind === 'deleted') return 2
  return 1.8 + textWeight
}

function wrapTextLines(body: string, lineWidth: number): string[] {
  return body.split('\n').flatMap((sourceLine) => {
    if (!sourceLine) return ['']

    const lines: string[] = []
    let remaining = sourceLine
    while (remaining.length > lineWidth) {
      const candidateBreak = remaining.lastIndexOf(' ', lineWidth)
      const breakAt = candidateBreak >= Math.floor(lineWidth * 0.45)
        ? candidateBreak
        : lineWidth
      lines.push(remaining.slice(0, breakAt).trimEnd())
      remaining = remaining.slice(breakAt).trimStart()
    }
    lines.push(remaining)
    return lines
  })
}

function splitOversizedMessage(
  message: ChatMessage,
  settings: BookSettings,
  availableWeight: number,
): ChatMessage[] {
  if (
    (message.kind !== 'message' && message.kind !== 'media' && message.kind !== 'editorial') ||
    !message.body
  ) {
    return [message]
  }

  const editorialGeometry = message.kind === 'editorial' && message.editorial?.kind !== 'table-of-contents'
    ? getEditorialTextGeometry(message, settings)
    : null
  const lineWidth = editorialGeometry?.characters ?? estimatedLineWidth(settings)
  const photoOverride = message.mediaName
    ? getPhotoOverride(settings, message.sourceMessageId ?? message.id)
    : null
  if (!showMediaCaption(message.mediaName, photoOverride?.showCaption)) return [message]
  const reservedWeight = message.kind === 'media'
    ? mediaBaseWeight(settings, message) + 2
    : message.kind === 'editorial'
      ? 7
      : 3.8
  const maxLines = editorialGeometry?.maxLines ?? Math.max(3, Math.floor(availableWeight - reservedWeight))
  const lines = wrapTextLines(message.body, lineWidth)
  if (lines.length <= maxLines) return [message]

  const bodies: string[] = []
  for (let index = 0; index < lines.length; index += maxLines) {
    bodies.push(lines.slice(index, index + maxLines).join('\n').trim())
  }

  return bodies.map((body, index) => {
    const continuesMediaCaption = message.kind === 'media' && index > 0
    return {
      ...message,
      id: `${message.id}-part-${index + 1}`,
      body,
      kind: continuesMediaCaption ? 'message' : message.kind,
      mediaName: continuesMediaCaption ? null : message.mediaName,
      videoName: index === 0 ? message.videoName : undefined,
      continuation: { part: index + 1, total: bodies.length },
      sourceMessageId: message.sourceMessageId ?? message.id,
      chapterTitle: index === 0 ? message.chapterTitle : undefined,
    }
  })
}

function dayKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function tableOfContentsPageSize(settings: Pick<
  BookSettings,
  'format' | 'orientation' | 'artDirection' | 'customSize'
>): number {
  const formatBase: Record<BookFormat, number> = {
    a5: 14,
    a4: 22,
    letter: 20,
    square: 18,
    custom: 14 * getPageDimensions(settings.format, settings.orientation, settings.customSize).heightMm / 210,
  }
  const orientationFactor = settings.format !== 'square' && settings.format !== 'custom' && settings.orientation === 'landscape'
    ? 0.56
    : 1
  const densityFactor = settings.artDirection.density === 'airy'
    ? 0.86
    : settings.artDirection.density === 'compact'
      ? 1.12
      : 1
  const lineHeightFactor = BASE_BOOK_LINE_HEIGHT / settings.artDirection.lineHeight
  return Math.max(5, Math.floor(
    formatBase[settings.format] * orientationFactor * densityFactor * lineHeightFactor,
  ))
}

function editorialPageLabel(page: Pick<EditorialPage, 'kind' | 'title'>): string {
  const title = page.title.trim()
  if (title) return title
  if (page.kind === 'introduction') return 'Introduction'
  if (page.kind === 'epilogue') return 'Épilogue'
  if (page.kind === 'dedication') return 'Dédicace'
  if (page.kind === 'blank') return 'Page blanche'
  return 'Texte personnel'
}

function bookmarkKey(messageId: string, continuationPart?: number): string {
  return `${messageId}:${continuationPart ?? 1}`
}

function bookmarkMatchesMessage(
  bookmark: Pick<BookBookmark, 'messageId' | 'continuationPart'>,
  message: ChatMessage,
): boolean {
  return (
    (message.sourceMessageId ?? message.id) === bookmark.messageId &&
    (message.continuation?.part ?? 1) === (bookmark.continuationPart ?? 1)
  )
}

export function getBookmarkPageIndex(
  pages: ChatMessage[][],
  bookmark: Pick<BookBookmark, 'messageId' | 'continuationPart'>,
): number {
  const exactPage = pages.findIndex((page) => page.some((message) => (
    bookmarkMatchesMessage(bookmark, message)
  )))
  if (exactPage >= 0 || bookmark.continuationPart === undefined) return exactPage
  return pages.findIndex((page) => page.some((message) => (
    (message.sourceMessageId ?? message.id) === bookmark.messageId
  )))
}

function sourcePageIndex(pages: ChatMessage[][], messageId: string): number {
  return getBookmarkPageIndex(pages, { messageId })
}

function insertTableOfContents(
  pages: ChatMessage[][],
  settings: Pick<
    BookSettings,
    | 'showTableOfContents'
    | 'chapters'
    | 'editorialPages'
    | 'bookmarks'
    | 'format'
    | 'orientation'
    | 'artDirection'
  >,
): ChatMessage[][] {
  if (!settings.showTableOfContents) return pages

  const entriesWithPage = [
    ...settings.chapters.flatMap((chapter) => {
      const pageIndex = sourcePageIndex(pages, chapter.messageId)
      return pageIndex < 0 ? [] : [{
        id: `chapter-${chapter.messageId}`,
        label: chapter.title,
        pageIndex,
        type: 'chapter' as const,
      }]
    }),
    ...settings.editorialPages.flatMap((editorialPage) => {
      if (editorialPage.kind === 'dedication' || editorialPage.kind === 'blank') return []
      const pageIndex = pages.findIndex((page) => (
        page[0]?.editorial?.pageId === editorialPage.id
      ))
      return pageIndex < 0 ? [] : [{
        id: `editorial-${editorialPage.id}`,
        label: editorialPageLabel(editorialPage),
        pageIndex,
        type: 'editorial' as const,
      }]
    }),
    ...settings.bookmarks.flatMap((bookmark) => {
      const pageIndex = getBookmarkPageIndex(pages, bookmark)
      return pageIndex < 0 ? [] : [{
        id: `bookmark-${bookmarkKey(bookmark.messageId, bookmark.continuationPart)}`,
        label: bookmark.label.trim(),
        pageIndex,
        type: 'bookmark' as const,
      }]
    }),
  ].filter((entry) => entry.label).sort((left, right) => left.pageIndex - right.pageIndex)

  if (entriesWithPage.length === 0) return pages

  let insertAt = 0
  while (
    insertAt < pages.length &&
    ['dedication', 'introduction'].includes(
      pages[insertAt][0]?.editorial?.kind ?? '',
    )
  ) {
    insertAt += 1
  }
  const entriesPerPage = tableOfContentsPageSize(settings)
  const tablePageCount = Math.ceil(entriesWithPage.length / entriesPerPage)
  const entries: TableOfContentsEntry[] = entriesWithPage.map((entry) => ({
    id: entry.id,
    label: entry.label,
    page: entry.pageIndex + 1 + (entry.pageIndex >= insertAt ? tablePageCount : 0),
    type: entry.type,
  }))
  const timestamp = pages[insertAt]?.[0]?.timestamp ?? pages[0]?.[0]?.timestamp ?? Date.now()
  const tablePages = Array.from({ length: tablePageCount }, (_, index) => [{
    id: `editorial-table-of-contents-${index + 1}`,
    timestamp,
    sender: null,
    body: '',
    mediaName: null,
    kind: 'editorial' as const,
    editorial: {
      pageId: `table-of-contents-${index + 1}`,
      kind: 'table-of-contents' as const,
      title: 'Sommaire',
      entries: entries.slice(
        index * entriesPerPage,
        (index + 1) * entriesPerPage,
      ),
    },
  }])

  return [
    ...pages.slice(0, insertAt),
    ...tablePages,
    ...pages.slice(insertAt),
  ]
}

export function getBookNavigationEntries(
  pages: ChatMessage[][],
  settings: Pick<BookSettings, 'bookmarks' | 'backCover'>,
): BookNavigationEntry[] {
  const entries: BookNavigationEntry[] = [{
    id: 'cover',
    label: 'Couverture',
    pageIndex: 0,
    type: 'cover',
  }]
  pages.forEach((page, index) => {
    const physicalPage = index + 1
    const editorial = page[0]?.editorial
    if (editorial) {
      if (editorial.kind === 'blank') return
      entries.push({
        id: `editorial-${editorial.pageId}`,
        label: editorial.title.trim() || (
          editorial.kind === 'introduction'
            ? 'Introduction'
            : editorial.kind === 'epilogue'
              ? 'Épilogue'
              : editorial.kind === 'table-of-contents'
                ? 'Sommaire'
                : editorial.kind === 'dedication'
                  ? 'Dédicace'
                  : 'Texte personnel'
        ),
        pageIndex: physicalPage,
        type: editorial.kind === 'table-of-contents'
          ? 'table-of-contents'
          : 'editorial',
      })
    }
    if (page[0]?.chapterTitle) {
      entries.push({
        id: `chapter-${page[0].sourceMessageId ?? page[0].id}`,
        label: page[0].chapterTitle,
        pageIndex: physicalPage,
        type: 'chapter',
      })
    }
  })

  settings.bookmarks.forEach((bookmark) => {
    const label = bookmark.label.trim()
    const targetPageIndex = getBookmarkPageIndex(pages, bookmark)
    if (!label || targetPageIndex < 0) return
    entries.push({
      id: `bookmark-${bookmarkKey(bookmark.messageId, bookmark.continuationPart)}`,
      label,
      pageIndex: targetPageIndex + 1,
      type: 'bookmark',
    })
  })

  if (settings.backCover.enabled) {
    entries.push({
      id: 'back-cover',
      label: 'Quatrième de couverture',
      pageIndex: pages.length + 1,
      type: 'back-cover',
    })
  }

  const uniqueEntries = entries.filter((entry, index) => (
    entries.findIndex((candidate) => candidate.id === entry.id) === index
  ))
  return [
    uniqueEntries[0],
    ...uniqueEntries.slice(1).sort((left, right) => left.pageIndex - right.pageIndex),
  ]
}

function compositionOptions(settings: BookSettings, theme: DesignedComposition) {
  return {
    theme,
    ...getPageDimensions(settings.format, settings.orientation, settings.customSize),
    fontScale: settings.fontScale,
    lineHeight: settings.artDirection.lineHeight,
    photoOverrides: settings.photoOverrides,
    photoAspectRatios: settings.photoAspectRatios,
  }
}

export function paginateMessages(
  messages: ChatMessage[],
  settings: BookSettings,
): ChatMessage[][] {
  const materializedMessages = insertEditorialPages(
    applyCaptionOverrides(messages, settings).map((message) => {
      if (!isVideoMedia(message.mediaName) || !getPhotoOverride(settings, message.id).videoTextOnly) return message
      return { ...message, kind: 'message' as const, videoName: message.mediaName!, mediaName: null }
    }),
    settings,
  )
  if (materializedMessages.length === 0) return [[]]

  const capacity = pageCapacity(settings)
  const chaptersByMessage = new Map(
    settings.chapters.map((chapter) => [chapter.messageId, chapter.title]),
  )
  const manualBreaks = new Set(settings.pageBreakBeforeIds)
  const paginatedMessages = materializedMessages.flatMap((message) => {
    const chapterTitle = chaptersByMessage.get(message.id)
    const chapterWeight = chapterTitle ? chapterHeadingWeight(settings) : 0
    return splitOversizedMessage(
      {
        ...message,
        sourceMessageId: message.id,
        chapterTitle,
      },
      settings,
      capacity - dateHeadingWeight(settings) - chapterWeight,
    )
  })
  const pages: ChatMessage[][] = []
  let page: ChatMessage[] = []
  let weight = 0
  let previousDay = ''
  let photoCount = 0

  paginatedMessages.forEach((message) => {
    const currentDay = dayKey(message.timestamp)
    const isEditorial = message.kind === 'editorial'
    const dateWeight = isEditorial || currentDay === previousDay
      ? 0
      : dateHeadingWeight(settings)
    const chapterWeight = message.chapterTitle ? chapterHeadingWeight(settings) : 0
    const nextWeight = messageWeight(message, settings) + dateWeight + chapterWeight
    const startsSourceMessage =
      message.continuation === undefined || message.continuation.part === 1
    const startsManualSection = startsSourceMessage && (
      Boolean(message.chapterTitle) ||
      manualBreaks.has(message.sourceMessageId ?? message.id)
    )
    const exceedsPhotoLimit = Boolean(
      message.mediaName && photoCount >= settings.maxPhotosPerPage,
    )
    const photoOverride = message.mediaName
      ? getPhotoOverride(settings, message.sourceMessageId ?? message.id)
      : null
    const startsFullPage = photoOverride?.layout === 'full-page'
    const exceedsCapacity = isDesignedComposition(settings.theme)
      ? !layoutCompositionPage(
          [...page, message],
          compositionOptions(settings, settings.theme),
        ).fits
      : weight + nextWeight > capacity

    if (
      page.length > 0 &&
      (
        startsManualSection ||
        isEditorial ||
        startsFullPage ||
        exceedsPhotoLimit ||
        message.continuation !== undefined ||
        exceedsCapacity
      )
    ) {
      pages.push(page)
      page = []
      weight = 0
      previousDay = ''
      photoCount = 0
    }

    page.push(message)
    if (message.mediaName) photoCount += 1
    weight += messageWeight(message, settings) + chapterWeight
    if (!isEditorial && currentDay !== previousDay) weight += dateHeadingWeight(settings)
    previousDay = currentDay

    if (startsFullPage || isEditorial) {
      pages.push(page)
      page = []
      weight = 0
      previousDay = ''
      photoCount = 0
    }
  })

  if (page.length > 0) pages.push(page)
  return insertTableOfContents(pages, settings)
}

export function findCoverMedia(
  messages: ChatMessage[],
  preferredMediaName: string | null = null,
): string | null {
  return preferredMediaName ?? messages.find((message) => message.mediaName)?.mediaName ?? null
}

export function findBackCoverMedia(
  messages: ChatMessage[],
  preferredMediaName: string | null = null,
): string | null {
  return preferredMediaName ?? messages.findLast((message) => message.mediaName)?.mediaName ?? null
}