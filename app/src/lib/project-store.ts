import {
  isDefaultCoverPhotoOverride,
  isDefaultPhotoOverride,
  type BookSettings,
  type BackCoverSettings,
  type BookBookmark,
  type CaptionOverride,
  type CoverPhotoOverride,
  type EditorialPage,
  type EditorialPageKind,
  type ParticipantProfile,
  type PhotoFit,
  type PhotoLayout,
  type PhotoOverride,
  type PhotoRotation,
} from './book-model'
import type {
  BookArtDirection,
  BookDateStyle,
  BookDensity,
  BookFontPair,
  BookVisualPreset,
  ChapterStyle,
  CoverLayout,
  CoverTitlePosition,
  DateHeadingStyle,
  PageNumberStyle,
  ParticipantPalette,
  PhotoFrameStyle,
} from './book-style'
import {
  BOOK_STYLE_PRESETS,
  COVER_OVERLAY_MAX,
  COVER_OVERLAY_MIN,
} from './book-style'
import type { ParsedChat } from './chat-types'

const DATABASE_NAME = 'chatbound-projects'
const STORE_NAME = 'projects'
const DATABASE_VERSION = 1
const PROJECT_VERSION = 1

export interface SavedBookProject {
  version: number
  projectId: string
  archiveName: string
  settings: BookSettings
  updatedAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'projectId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function transact<Type>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<Type>,
): Promise<Type> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = operation(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  }))
}

function validParticipants(
  participants: string[],
  availableParticipants: string[],
): string[] {
  const available = new Set(availableParticipants)
  return participants.filter((participant) => available.has(participant))
}

export function normalizeSavedSettings(
  saved: Partial<BookSettings> | null | undefined,
  defaults: BookSettings,
  chat: ParsedChat,
): BookSettings {
  if (!saved) return defaults

  const messageIds = new Set(chat.messages.map((message) => message.id))
  const mediaNames = new Set(
    chat.messages.flatMap((message) => message.mediaName ? [message.mediaName] : []),
  )
  const mediaMessageIds = new Set(
    chat.messages.flatMap((message) => message.mediaName ? [message.id] : []),
  )
  const includedParticipants = validParticipants(
    Array.isArray(saved.includedParticipants)
      ? saved.includedParticipants
      : defaults.includedParticipants,
    chat.participants,
  )
  const pageBreakBeforeIds = Array.isArray(saved.pageBreakBeforeIds)
    ? [...new Set(saved.pageBreakBeforeIds.filter((id) => messageIds.has(id)))]
    : []
  const chapterMessageIds = new Set<string>()
  const chapters = Array.isArray(saved.chapters)
    ? saved.chapters.flatMap((chapter) => {
      if (
        !chapter ||
        typeof chapter.messageId !== 'string' ||
        typeof chapter.title !== 'string' ||
        !messageIds.has(chapter.messageId) ||
        chapterMessageIds.has(chapter.messageId)
      ) {
        return []
      }
      const title = chapter.title.trim().slice(0, 80)
      if (!title) return []
      chapterMessageIds.add(chapter.messageId)
      return [{ messageId: chapter.messageId, title }]
    })
    : []

  const validFormat = ['a5', 'a4', 'letter', 'square'].includes(
    String(saved.format),
  )
    ? saved.format as BookSettings['format']
    : defaults.format
  const validOrientation = ['portrait', 'landscape'].includes(
    String(saved.orientation),
  )
    ? saved.orientation as BookSettings['orientation']
    : defaults.orientation
  const validTheme = ['journal', 'conversation', 'album'].includes(
    String(saved.theme),
  )
    ? saved.theme as BookSettings['theme']
    : defaults.theme
  const validDate = (value: unknown, fallback: string) => (
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : fallback
  )
  const validChoice = <Choice extends string>(
    value: unknown,
    choices: readonly Choice[],
    fallback: Choice,
  ): Choice => choices.includes(value as Choice) ? value as Choice : fallback
  const validHex = (value: unknown, fallback: string) => (
    typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      ? value.toLowerCase()
      : fallback
  )
  const artCandidate = saved.artDirection
  const candidatePreset = artCandidate && typeof artCandidate === 'object'
    ? validChoice<BookVisualPreset>(
        artCandidate.preset,
        ['timeless', 'modern', 'correspondence', 'graphic', 'minimal'],
        defaults.artDirection.preset,
      )
    : defaults.artDirection.preset
  const artDefaults = artCandidate && typeof artCandidate === 'object'
    ? BOOK_STYLE_PRESETS[candidatePreset].artDirection
    : defaults.artDirection
  const candidateCoverLayout = artCandidate && typeof artCandidate === 'object'
    ? validChoice<CoverLayout>(
        artCandidate.coverLayout,
        ['split', 'full-image', 'typographic'],
        artDefaults.coverLayout,
      )
    : artDefaults.coverLayout
  const artDirection: BookArtDirection = artCandidate && typeof artCandidate === 'object'
    ? {
        preset: candidatePreset,
        fontPair: validChoice<BookFontPair>(
          artCandidate.fontPair,
          ['editorial', 'literary', 'modern', 'correspondence'],
          artDefaults.fontPair,
        ),
        paperColor: validHex(artCandidate.paperColor, artDefaults.paperColor),
        inkColor: validHex(artCandidate.inkColor, artDefaults.inkColor),
        density: validChoice<BookDensity>(
          artCandidate.density,
          ['airy', 'balanced', 'compact'],
          artDefaults.density,
        ),
        lineHeight: typeof artCandidate.lineHeight === 'number' &&
          Number.isFinite(artCandidate.lineHeight) &&
          artCandidate.lineHeight >= 1.2 &&
          artCandidate.lineHeight <= 1.8
            ? artCandidate.lineHeight
            : artDefaults.lineHeight,
        pageNumbers: validChoice<PageNumberStyle>(
          artCandidate.pageNumbers,
          ['outer', 'center', 'hidden'],
          artDefaults.pageNumbers,
        ),
        dateStyle: validChoice<BookDateStyle>(
          artCandidate.dateStyle,
          ['full', 'compact', 'minimal'],
          artDefaults.dateStyle,
        ),
        dateHeadingStyle: validChoice<DateHeadingStyle>(
          artCandidate.dateHeadingStyle,
          ['classic', 'label', 'minimal'],
          artDefaults.dateHeadingStyle,
        ),
        photoFrame: validChoice<PhotoFrameStyle>(
          artCandidate.photoFrame,
          ['square', 'soft', 'bordered'],
          artDefaults.photoFrame,
        ),
        chapterStyle: validChoice<ChapterStyle>(
          artCandidate.chapterStyle,
          ['classic', 'band', 'minimal'],
          artDefaults.chapterStyle,
        ),
        participantPalette: validChoice<ParticipantPalette>(
          artCandidate.participantPalette,
          ['custom', 'accent', 'neutral'],
          artDefaults.participantPalette,
        ),
        coverLayout: candidateCoverLayout,
        coverTitlePosition: validChoice<CoverTitlePosition>(
          artCandidate.coverTitlePosition,
          ['bottom-left', 'center'],
          artDefaults.coverTitlePosition,
        ),
        coverOverlay: typeof artCandidate.coverOverlay === 'number' &&
          Number.isFinite(artCandidate.coverOverlay)
            ? Math.min(
                COVER_OVERLAY_MAX,
                Math.max(COVER_OVERLAY_MIN, artCandidate.coverOverlay),
              )
            : artDefaults.coverOverlay,
      }
    : { ...artDefaults }
  const photoOverrideMessageIds = new Set<string>()
  const photoOverrides = Array.isArray(saved.photoOverrides)
    ? saved.photoOverrides.flatMap((candidate): PhotoOverride[] => {
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        typeof candidate.messageId !== 'string' ||
        !mediaMessageIds.has(candidate.messageId) ||
        photoOverrideMessageIds.has(candidate.messageId)
      ) {
        return []
      }
      const layout = ['auto', 'wide', 'half', 'full-page'].includes(
        String(candidate.layout),
      ) ? candidate.layout as PhotoLayout : 'auto'
      const fit = ['contain', 'cover'].includes(String(candidate.fit))
        ? candidate.fit as PhotoFit
        : 'contain'
      const rotation = [0, 90, 180, 270].includes(Number(candidate.rotation))
        ? Number(candidate.rotation) as PhotoRotation
        : 0
      const focalX = typeof candidate.focalX === 'number' && Number.isFinite(candidate.focalX)
        ? Math.min(100, Math.max(0, candidate.focalX))
        : 50
      const focalY = typeof candidate.focalY === 'number' && Number.isFinite(candidate.focalY)
        ? Math.min(100, Math.max(0, candidate.focalY))
        : 50
      const override: PhotoOverride = {
        messageId: candidate.messageId,
        layout,
        fit,
        focalX,
        focalY,
        rotation,
        showCaption: typeof candidate.showCaption === 'boolean'
          ? candidate.showCaption
          : true,
      }
      photoOverrideMessageIds.add(candidate.messageId)
      return isDefaultPhotoOverride(override) ? [] : [override]
    })
    : []
  const coverPhotoOverride = (() => {
    const candidate = saved.coverPhotoOverride
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      typeof candidate.mediaName !== 'string' ||
      !mediaNames.has(candidate.mediaName)
    ) {
      return null
    }
    const override: CoverPhotoOverride = {
      mediaName: candidate.mediaName,
      fit: ['contain', 'cover'].includes(String(candidate.fit))
        ? candidate.fit as PhotoFit
        : 'contain',
      focalX: typeof candidate.focalX === 'number' && Number.isFinite(candidate.focalX)
        ? Math.min(100, Math.max(0, candidate.focalX))
        : 50,
      focalY: typeof candidate.focalY === 'number' && Number.isFinite(candidate.focalY)
        ? Math.min(100, Math.max(0, candidate.focalY))
        : 50,
      rotation: [0, 90, 180, 270].includes(Number(candidate.rotation))
        ? Number(candidate.rotation) as PhotoRotation
        : 0,
    }
    return isDefaultCoverPhotoOverride(override) ? null : override
  })()
  const backCover = (() => {
    const candidate = saved.backCover
    if (!candidate || typeof candidate !== 'object') {
      return { ...defaults.backCover }
    }
    const mediaName = typeof candidate.mediaName === 'string' &&
      mediaNames.has(candidate.mediaName)
      ? candidate.mediaName
      : null
    const photoCandidate = candidate.photoOverride
    const photoOverride: CoverPhotoOverride | null = mediaName &&
      photoCandidate &&
      typeof photoCandidate === 'object' &&
      photoCandidate.mediaName === mediaName
      ? {
          mediaName,
          fit: ['contain', 'cover'].includes(String(photoCandidate.fit))
            ? photoCandidate.fit as PhotoFit
            : 'contain',
          focalX: typeof photoCandidate.focalX === 'number' && Number.isFinite(photoCandidate.focalX)
            ? Math.min(100, Math.max(0, photoCandidate.focalX))
            : 50,
          focalY: typeof photoCandidate.focalY === 'number' && Number.isFinite(photoCandidate.focalY)
            ? Math.min(100, Math.max(0, photoCandidate.focalY))
            : 50,
          rotation: [0, 90, 180, 270].includes(Number(photoCandidate.rotation))
            ? Number(photoCandidate.rotation) as PhotoRotation
            : 0,
        }
      : null
    return {
      enabled: typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : defaults.backCover.enabled,
      layout: validChoice(candidate.layout, ['photo', 'text'], defaults.backCover.layout),
      text: typeof candidate.text === 'string'
        ? candidate.text.slice(0, 2_000)
        : defaults.backCover.text,
      mediaName,
      photoOverride: photoOverride && isDefaultCoverPhotoOverride(photoOverride)
        ? null
        : photoOverride,
      overlay: typeof candidate.overlay === 'number' && Number.isFinite(candidate.overlay)
        ? Math.min(COVER_OVERLAY_MAX, Math.max(COVER_OVERLAY_MIN, candidate.overlay))
        : defaults.backCover.overlay,
      textPosition: validChoice(
        candidate.textPosition,
        ['bottom-left', 'center'],
        defaults.backCover.textPosition,
      ),
    } satisfies BackCoverSettings
  })()
  const captionMessageIds = new Set<string>()
  const captionOverrides = Array.isArray(saved.captionOverrides)
    ? saved.captionOverrides.flatMap((candidate): CaptionOverride[] => {
      if (
        !candidate ||
        typeof candidate.messageId !== 'string' ||
        typeof candidate.text !== 'string' ||
        !mediaMessageIds.has(candidate.messageId) ||
        captionMessageIds.has(candidate.messageId)
      ) {
        return []
      }
      captionMessageIds.add(candidate.messageId)
      return [{ messageId: candidate.messageId, text: candidate.text.slice(0, 2_000) }]
    })
    : []
  const profileParticipants = new Set<string>()
  const participantProfiles = Array.isArray(saved.participantProfiles)
    ? saved.participantProfiles.flatMap((candidate): ParticipantProfile[] => {
      if (
        !candidate ||
        typeof candidate.participant !== 'string' ||
        typeof candidate.displayName !== 'string' ||
        typeof candidate.color !== 'string' ||
        !chat.participants.includes(candidate.participant) ||
        profileParticipants.has(candidate.participant) ||
        !/^#[0-9a-f]{6}$/i.test(candidate.color)
      ) {
        return []
      }
      const displayName = candidate.displayName.trim().slice(0, 60)
      if (!displayName) return []
      profileParticipants.add(candidate.participant)
      return [{
        participant: candidate.participant,
        displayName,
        color: candidate.color.toLowerCase(),
      }]
    })
    : []
  const editorialPageIds = new Set<string>()
  const editorialKinds: EditorialPageKind[] = [
    'dedication',
    'introduction',
    'text',
    'epilogue',
    'blank',
  ]
  const editorialPages = Array.isArray(saved.editorialPages)
    ? saved.editorialPages.flatMap((candidate): EditorialPage[] => {
      if (
        !candidate ||
        typeof candidate.id !== 'string' ||
        !/^[a-z0-9-]{1,80}$/i.test(candidate.id) ||
        editorialPageIds.has(candidate.id) ||
        !editorialKinds.includes(candidate.kind as EditorialPageKind) ||
        typeof candidate.title !== 'string' ||
        typeof candidate.body !== 'string'
      ) {
        return []
      }
      const title = candidate.title.trim().slice(0, 100)
      const body = candidate.body.slice(0, 12_000)
      const kind = candidate.kind as EditorialPageKind
      if (kind !== 'blank' && !title && !body.trim()) return []
      const anchorMessageId = (kind === 'text' || kind === 'blank') &&
        typeof candidate.anchorMessageId === 'string' &&
        messageIds.has(candidate.anchorMessageId)
        ? candidate.anchorMessageId
        : null
      editorialPageIds.add(candidate.id)
      return [{
        id: candidate.id,
        kind,
        title: kind === 'blank' ? '' : title,
        body: kind === 'blank' ? '' : body,
        anchorMessageId,
      }]
    })
    : []
  const bookmarkKeys = new Set<string>()
  const bookmarks = Array.isArray(saved.bookmarks)
    ? saved.bookmarks.flatMap((candidate): BookBookmark[] => {
      const continuationPart = Number.isInteger(candidate?.continuationPart) &&
        Number(candidate.continuationPart) >= 2 &&
        Number(candidate.continuationPart) <= 999
        ? Number(candidate.continuationPart)
        : undefined
      const bookmarkKey = `${candidate?.messageId}:${continuationPart ?? 1}`
      if (
        !candidate ||
        typeof candidate.messageId !== 'string' ||
        typeof candidate.label !== 'string' ||
        !messageIds.has(candidate.messageId) ||
        bookmarkKeys.has(bookmarkKey)
      ) {
        return []
      }
      const label = candidate.label.trim().slice(0, 80)
      if (!label) return []
      bookmarkKeys.add(bookmarkKey)
      return [{
        messageId: candidate.messageId,
        label,
        ...(continuationPart === undefined ? {} : { continuationPart }),
      }]
    })
    : []

  return {
    title: typeof saved.title === 'string'
      ? saved.title.slice(0, 72)
      : defaults.title,
    subtitle: typeof saved.subtitle === 'string'
      ? saved.subtitle.slice(0, 100)
      : defaults.subtitle,
    format: validFormat,
    orientation: validOrientation,
    theme: validTheme,
    accent: typeof saved.accent === 'string' && /^#[0-9a-f]{6}$/i.test(saved.accent)
      ? saved.accent
      : defaults.accent,
    fontScale: typeof saved.fontScale === 'number' &&
      saved.fontScale >= 0.85 &&
      saved.fontScale <= 1.2
      ? saved.fontScale
      : defaults.fontScale,
    artDirection,
    maxPhotosPerPage:
      typeof saved.maxPhotosPerPage === 'number' &&
      Number.isInteger(saved.maxPhotosPerPage) &&
      saved.maxPhotosPerPage >= 1 &&
      saved.maxPhotosPerPage <= 6
        ? saved.maxPhotosPerPage
        : defaults.maxPhotosPerPage,
    dateFrom: validDate(saved.dateFrom, defaults.dateFrom),
    dateTo: validDate(saved.dateTo, defaults.dateTo),
    includedParticipants,
    showSystem: typeof saved.showSystem === 'boolean'
      ? saved.showSystem
      : defaults.showSystem,
    showMissingMedia: typeof saved.showMissingMedia === 'boolean'
      ? saved.showMissingMedia
      : defaults.showMissingMedia,
    showDeleted: typeof saved.showDeleted === 'boolean'
      ? saved.showDeleted
      : defaults.showDeleted,
    excludedMessageIds: Array.isArray(saved.excludedMessageIds)
      ? [...new Set(saved.excludedMessageIds.filter((id) => messageIds.has(id)))]
      : [],
    coverMediaName:
      typeof saved.coverMediaName === 'string' && mediaNames.has(saved.coverMediaName)
        ? saved.coverMediaName
        : null,
    coverPhotoOverride,
    backCover,
    pageBreakBeforeIds,
    chapters,
    photoOverrides,
    captionOverrides,
    participantProfiles,
    editorialPages,
    showTableOfContents: typeof saved.showTableOfContents === 'boolean'
      ? saved.showTableOfContents
      : false,
    bookmarks,
  }
}

export async function loadBookProject(
  projectId: string,
): Promise<SavedBookProject | null> {
  if (!('indexedDB' in globalThis)) return null
  const project = await transact<SavedBookProject | undefined>(
    'readonly',
    (store) => store.get(projectId),
  )
  return project?.version === PROJECT_VERSION ? project : null
}

export async function listBookProjects(): Promise<SavedBookProject[]> {
  if (!('indexedDB' in globalThis)) return []
  const projects = await transact<SavedBookProject[]>(
    'readonly',
    (store) => store.getAll(),
  )
  return projects
    .filter((project) => project.version === PROJECT_VERSION)
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

export async function saveBookProject(
  project: Omit<SavedBookProject, 'version' | 'updatedAt'>,
): Promise<SavedBookProject> {
  const savedProject: SavedBookProject = {
    ...project,
    version: PROJECT_VERSION,
    updatedAt: Date.now(),
  }
  if (!('indexedDB' in globalThis)) return savedProject
  await transact<IDBValidKey>('readwrite', (store) => store.put(savedProject))
  return savedProject
}

export async function deleteBookProject(projectId: string): Promise<void> {
  if (!('indexedDB' in globalThis)) return
  await transact<undefined>('readwrite', (store) => store.delete(projectId))
}