import {
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import {
  BookOpen,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileDown,
  FolderCog,
  HardDrive,
  Image,
  ListFilter,
  LoaderCircle,
  MessageSquareText,
  Palette,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react'
import type { ChatArchive } from '../lib/archive-reader'
import {
  applyCaptionOverrides,
  createInitialSettings,
  filterMessages,
  findBackCoverMedia,
  findCoverMedia,
  getBackCoverPhotoOverride,
  getCoverPhotoOverride,
  getBookmarkPageIndex,
  getPhotoOverride,
  isDefaultCoverPhotoOverride,
  isDefaultPhotoOverride,
  paginateMessages,
  type BookSettings,
  type EditorialPage,
  type PhotoOverride,
} from '../lib/book-model'
import {
  BOOK_STYLE_PRESETS,
  clonePresetArtDirection,
  contrastRatio,
  type BookArtDirection,
  type BookVisualPreset,
} from '../lib/book-style'
import { updateExcludedMessages } from '../lib/content-selection'
import type { ContentView } from '../lib/content-selection'
import { inspectPrintLayout } from '../lib/layout-validation'
import {
  inspectPhotoQuality,
  type PhotoPreflightReport,
} from '../lib/photo-preflight'
import {
  deleteBookProject,
  loadBookProject,
  normalizeSavedSettings,
  saveBookProject,
} from '../lib/project-store'
import {
  PortableProjectError,
  portableProjectFileName,
  serializePortableProject,
} from '../lib/portable-project'
import {
  createSettingsHistory,
  settingsHistoryReducer,
} from '../lib/settings-history'
import { BookPreview } from './BookPreview'
import { ContentManager } from './ContentManager'
import { CoverPanel } from './CoverPanel'
import { EditorialPanel } from './EditorialPanel'
import { PhotoInspector } from './PhotoInspector'
import { StructureInspector } from './StructureInspector'
import { StylePanel } from './StylePanel'
import { PreflightDialog } from './PreflightDialog'
import { PrintDocument } from './PrintDocument'
import { getPhotoAspectRatios, inspectPhotoAspectRatio, usePhotoAspectRatios } from './usePhotoAspectRatios'
import { createManualVideoArchive, isValidManualVideoFileName, manualVideoMediaName } from '../lib/manual-video'
import { isVideoMedia } from '../lib/video-frame'
import { hasMissingMediaMarker } from '../lib/chat-parser'

interface StudioProps {
  archive: ChatArchive
  onReset(): void
}

type SaveStatus = 'loading' | 'saving' | 'saved' | 'error'
type WorkspacePanel = 'couverture' | 'souvenirs' | 'organiser' | 'apparence'

const WORKSPACE_OPTIONS: Array<{
  id: WorkspacePanel
  label: string
  icon: typeof BookOpen
  className: string
}> = [
  { id: 'couverture', label: 'Couverture', icon: BookOpen, className: 'cover-panel-button' },
  { id: 'souvenirs', label: 'Souvenirs', icon: ListFilter, className: 'content-manager-button' },
  { id: 'organiser', label: 'Organiser', icon: BookOpenText, className: 'editorial-panel-button' },
  { id: 'apparence', label: 'Apparence', icon: Palette, className: 'style-panel-button' },
]

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const complete = () => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(fallback)
      resolve()
    }
    const fallback = globalThis.setTimeout(complete, 100)
    requestAnimationFrame(() => requestAnimationFrame(complete))
  })
}

function shortWait(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 40))
}

function waitForImageDecode(image: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const complete = () => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(fallback)
      resolve()
    }
    const fallback = globalThis.setTimeout(complete, 1_000)
    void image.decode().then(complete, complete)
  })
}

export function Studio({ archive: originalArchive, onReset }: StudioProps) {
  const [settingsHistory, dispatchSettings] = useReducer(
    settingsHistoryReducer<BookSettings>,
    createSettingsHistory(createInitialSettings(originalArchive.chat, originalArchive.fileName)),
  )
  const settings = settingsHistory.present
  const [manualVideoFiles, setManualVideoFiles] = useState<ReadonlyMap<string, File>>(() => new Map())
  const videoFileInput = useRef<HTMLInputElement>(null)
  const pendingVideoMessageId = useRef<string | null>(null)
  const [videoAssociationError, setVideoAssociationError] = useState<string | null>(null)
  const [videoAssociationNotice, setVideoAssociationNotice] = useState<string | null>(null)
  const archive = useMemo(() => createManualVideoArchive(
    originalArchive,
    settings.videoAssociations ?? [],
    manualVideoFiles,
  ), [originalArchive, settings.videoAssociations, manualVideoFiles])
  useEffect(() => () => archive.dispose(), [archive])
  const photoAspectRatios = usePhotoAspectRatios(archive)
  const renderingSettings = useMemo(() => ({ ...settings, photoAspectRatios }), [settings, photoAspectRatios])
  const latestSettings = useRef(settings)
  latestSettings.current = settings
  const [pageIndex, setPageIndex] = useState(0)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [selectedCoverMediaName, setSelectedCoverMediaName] = useState<string | null>(null)
  const [selectedBackCoverMediaName, setSelectedBackCoverMediaName] = useState<string | null>(null)
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspacePanel | null>(null)
  const [contentInitialView, setContentInitialView] = useState<ContentView>('all')
  const [contentQuery, setContentQuery] = useState('')
  const [contentFiltersOpen, setContentFiltersOpen] = useState(false)
  const contentScrollPosition = useRef(0)
  const inspectorReturnWorkspace = useRef<WorkspacePanel | null>(null)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [editorialPageAnchorId, setEditorialPageAnchorId] = useState<string | null>(null)
  const [pendingPageBookmark, setPendingPageBookmark] = useState<{
    messageId: string
    bookmarked: boolean
    continuationPart?: number
  } | null>(null)
  const [projectReady, setProjectReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading')
  const [isPreparingPrint, setIsPreparingPrint] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [printProgress, setPrintProgress] = useState(0)
  const [printSnapshot, setPrintSnapshot] = useState<{
    settings: BookSettings
    messages: ReturnType<typeof filterMessages>
    pages: ReturnType<typeof paginateMessages>
  } | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [preflightReport, setPreflightReport] = useState<PhotoPreflightReport | null>(null)
  const [preparedPdf, setPreparedPdf] = useState<{
    url: string
    fileName: string
    size: number
  } | null>(null)
  const cancelPrint = useRef(false)
  const pdfAbortController = useRef<AbortController | null>(null)
  useEffect(() => () => {
    cancelPrint.current = true
    pdfAbortController.current?.abort()
  }, [])
  const projectMenuRef = useRef<HTMLDivElement>(null)
  const deferredSettings = useDeferredValue(renderingSettings)
  const filteredMessages = filterMessages(archive.chat.messages, deferredSettings)
  const selectableMessages = filterMessages(archive.chat.messages, {
    ...deferredSettings,
    excludedMessageIds: [],
  })
  const editorialMessages = filterMessages(archive.chat.messages, {
    ...settings,
    excludedMessageIds: [],
    showMissingMedia: contentInitialView === 'missing' || settings.showMissingMedia,
  })
  const missingVideoMessageIds = useMemo(() => {
    const missingNames = new Set(originalArchive.missingMedia.map((name) => name.toLocaleLowerCase()))
    const associations = new Map(settings.videoAssociations?.map((association) => [association.messageId, association]))
    return originalArchive.chat.messages.filter((message) => {
      const association = associations.get(message.id)
      if (association) return !manualVideoFiles.has(association.attachmentId)
      return message.kind === 'missing-media' || (!message.mediaName && hasMissingMediaMarker(message.body)) || Boolean(message.mediaName && isVideoMedia(message.mediaName) &&
        missingNames.has(message.mediaName.toLocaleLowerCase()))
    }).map((message) => message.id)
  }, [originalArchive, settings.videoAssociations, manualVideoFiles])
  const editorialVisibleMessages = filterMessages(archive.chat.messages, settings)
  const pages = paginateMessages(filteredMessages, deferredSettings)
  const physicalPageCount = pages.length + 1 + (deferredSettings.backCover.enabled ? 1 : 0)
  const selectedPhotos = filteredMessages.filter((message) => message.mediaName).length
  const hasPrintableContent = filteredMessages.length > 0 ||
    settings.editorialPages.length > 0 ||
    settings.backCover.enabled
  const selectedPhotoMessage = selectedPhotoId
    ? archive.chat.messages.find((message) => (
      message.id === selectedPhotoId && Boolean(message.mediaName)
    )) ?? null
    : null
  const selectedPhotoOverride = selectedPhotoId
    ? getPhotoOverride(settings, selectedPhotoId)
    : null
  const selectedCaptionOverride = selectedPhotoId
    ? settings.captionOverrides.find((override) => override.messageId === selectedPhotoId)
    : null
  const activeCoverMediaName = findCoverMedia(
    filteredMessages,
    settings.coverMediaName,
  )
  const selectedCoverPhotoMessage = selectedCoverMediaName
    ? archive.chat.messages.find((message) => (
      message.mediaName === selectedCoverMediaName
    )) ?? null
    : null
  const selectedCoverPhotoOverride = selectedCoverMediaName
    ? getCoverPhotoOverride(settings, selectedCoverMediaName)
    : null
  const activeBackCoverMediaName = settings.backCover.enabled &&
    settings.backCover.layout === 'photo'
    ? findBackCoverMedia(editorialVisibleMessages, settings.backCover.mediaName)
    : null
  const selectedBackCoverPhotoMessage = selectedBackCoverMediaName
    ? archive.chat.messages.find((message) => (
      message.mediaName === selectedBackCoverMediaName
    )) ?? null
    : null
  const selectedBackCoverPhotoOverride = selectedBackCoverMediaName
    ? getBackCoverPhotoOverride(settings, selectedBackCoverMediaName)
    : null
  const selectedStructureMessage = selectedStructureId
    ? archive.chat.messages.find((message) => message.id === selectedStructureId) ?? null
    : null
  const selectedChapter = selectedStructureId
    ? settings.chapters.find((chapter) => chapter.messageId === selectedStructureId) ?? null
    : null
  const selectedHasPageBreak = selectedStructureId
    ? settings.pageBreakBeforeIds.includes(selectedStructureId)
    : false
  const selectedBookmark = selectedStructureId
    ? settings.bookmarks.find((bookmark) => (
        bookmark.messageId === selectedStructureId &&
        bookmark.continuationPart === undefined
      )) ?? null
    : null

  useEffect(() => {
    setPageIndex((current) => Math.min(
      current,
      pages.length + (settings.backCover.enabled ? 1 : 0),
    ))
  }, [pages.length, settings.backCover.enabled])

  useEffect(() => {
    if (!selectedPhotoId) return
    const targetPage = pages.findIndex((page) => page.some((message) => (
      (message.sourceMessageId ?? message.id) === selectedPhotoId
    )))
    if (targetPage < 0) {
      setSelectedPhotoId(null)
      return
    }
    setPageIndex(targetPage + 1)
    if (!pages[targetPage].some((message) => (
      (message.sourceMessageId ?? message.id) === selectedPhotoId && Boolean(message.mediaName || message.videoName)
    ))) setSelectedPhotoId(null)
  }, [pages, selectedPhotoId])

  useEffect(() => {
    if (
      selectedCoverMediaName &&
      selectedCoverMediaName !== activeCoverMediaName
    ) {
      setSelectedCoverMediaName(null)
    }
  }, [activeCoverMediaName, selectedCoverMediaName])

  useEffect(() => {
    if (
      selectedBackCoverMediaName &&
      selectedBackCoverMediaName !== activeBackCoverMediaName
    ) {
      setSelectedBackCoverMediaName(null)
    }
  }, [activeBackCoverMediaName, selectedBackCoverMediaName])

  useEffect(() => {
    if (!selectedStructureId) return
    const targetPage = pages.findIndex((page) => page.some((message) => (
      (message.sourceMessageId ?? message.id) === selectedStructureId
    )))
    if (targetPage < 0) {
      setSelectedStructureId(null)
      return
    }
    setPageIndex(targetPage + 1)
  }, [pages, selectedStructureId])

  useEffect(() => {
    if (!pendingPageBookmark) return
    const isBookmarked = deferredSettings.bookmarks.some((bookmark) => (
      bookmark.messageId === pendingPageBookmark.messageId &&
      bookmark.continuationPart === pendingPageBookmark.continuationPart
    ))
    if (isBookmarked !== pendingPageBookmark.bookmarked) return
    const targetPage = getBookmarkPageIndex(pages, pendingPageBookmark)
    if (targetPage >= 0) setPageIndex(targetPage + 1)
    setPendingPageBookmark(null)
  }, [deferredSettings.bookmarks, pages, pendingPageBookmark])

  useEffect(() => {
    let active = true
    const defaults = createInitialSettings(originalArchive.chat, originalArchive.fileName)

    setProjectReady(false)
    setSaveStatus('loading')
    void loadBookProject(originalArchive.projectId)
      .then((project) => {
        if (!active) return
        dispatchSettings({
          type: 'replace',
          value: normalizeSavedSettings(project?.settings, defaults, originalArchive.chat),
        })
        setProjectReady(true)
        setSaveStatus('saved')
      })
      .catch(() => {
        if (!active) return
        dispatchSettings({ type: 'replace', value: defaults })
        setProjectReady(true)
        setSaveStatus('error')
      })

    return () => {
      active = false
    }
  }, [originalArchive])

  useEffect(() => {
    if (!projectReady) return
    let active = true
    setSaveStatus('saving')

    const timeout = globalThis.setTimeout(() => {
      void saveBookProject({
        projectId: archive.projectId,
        archiveName: archive.fileName,
        settings,
      })
        .then(() => {
          if (active) setSaveStatus('saved')
        })
        .catch(() => {
          if (active) setSaveStatus('error')
        })
    }, 500)

    return () => {
      active = false
      globalThis.clearTimeout(timeout)
    }
  }, [archive.fileName, archive.projectId, projectReady, settings])

  useEffect(() => {
    if (!projectReady) return
    const saveLatestProject = () => {
      void saveBookProject({
        projectId: archive.projectId,
        archiveName: archive.fileName,
        settings: latestSettings.current,
      })
    }
    globalThis.addEventListener('pagehide', saveLatestProject)
    return () => globalThis.removeEventListener('pagehide', saveLatestProject)
  }, [archive.fileName, archive.projectId, projectReady])

  useEffect(() => () => {
    if (preparedPdf) URL.revokeObjectURL(preparedPdf.url)
  }, [preparedPdf])

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLocaleLowerCase() !== 'z') {
        return
      }
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      dispatchSettings({ type: event.shiftKey ? 'redo' : 'undo' })
    }
    document.addEventListener('keydown', handleHistoryShortcut)
    return () => document.removeEventListener('keydown', handleHistoryShortcut)
  }, [])

  useEffect(() => {
    if (!projectMenuOpen) return
    const closeMenu = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (
        event instanceof PointerEvent &&
        event.target instanceof Node &&
        projectMenuRef.current?.contains(event.target)
      ) return
      setProjectMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [projectMenuOpen])

  const updateSetting = <Key extends keyof BookSettings>(
    key: Key,
    value: BookSettings[Key],
  ) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => ({ ...current, [key]: value }),
      historyKey: String(key),
    })
  }

  const applyVisualPreset = (preset: BookVisualPreset) => {
    const definition = BOOK_STYLE_PRESETS[preset]
    dispatchSettings({
      type: 'commit',
      update: (current) => ({
        ...current,
        accent: definition.accent,
        artDirection: clonePresetArtDirection(preset),
      }),
    })
  }

  const updateArtDirection = (
    changes: Partial<Omit<BookArtDirection, 'preset'>>,
  ) => {
    const historyKey = Object.keys(changes).length === 1
      ? `art:${Object.keys(changes)[0]}`
      : undefined
    dispatchSettings({
      type: 'commit',
      historyKey,
      update: (current) => ({
        ...current,
        artDirection: { ...current.artDirection, ...changes },
      }),
    })
  }

  const toggleParticipant = (participant: string) => {
    const participants = settings.includedParticipants.includes(participant)
      ? settings.includedParticipants.filter((name) => name !== participant)
      : [...settings.includedParticipants, participant]
    updateSetting('includedParticipants', participants)
  }

  const setExcludedMessages = (messageIds: string[], excluded: boolean) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => ({
        ...current,
        excludedMessageIds: updateExcludedMessages(
          current.excludedMessageIds,
          messageIds,
          excluded,
        ),
      }),
    })
  }

  const setCoverMedia = (mediaName: string | null) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => ({
        ...current,
        coverMediaName: mediaName,
        coverPhotoOverride: current.coverPhotoOverride?.mediaName === mediaName
          ? current.coverPhotoOverride
          : null,
      }),
    })
    setPageIndex(0)
    setSelectedCoverMediaName(null)
  }

  const setBackCoverMedia = (mediaName: string | null) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => ({
        ...current,
        backCover: {
          ...current.backCover,
          enabled: true,
          layout: 'photo',
          mediaName,
          photoOverride: current.backCover.photoOverride?.mediaName === mediaName
            ? current.backCover.photoOverride
            : null,
        },
      }),
    })
    setPageIndex(pages.length + 1)
    setSelectedBackCoverMediaName(null)
  }

  const setPageBreak = (messageId: string, enabled: boolean) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => ({
        ...current,
        pageBreakBeforeIds: updateExcludedMessages(
          current.pageBreakBeforeIds,
          [messageId],
          enabled,
        ),
      }),
    })
  }

  const setChapter = (messageId: string, title: string | null) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => {
        const chapters = current.chapters.filter(
          (chapter) => chapter.messageId !== messageId,
        )
        const normalizedTitle = title?.trim().slice(0, 80)
        return {
          ...current,
          chapters: normalizedTitle
            ? [...chapters, { messageId, title: normalizedTitle }]
            : chapters,
          pageBreakBeforeIds: normalizedTitle
            ? current.pageBreakBeforeIds.filter((id) => id !== messageId)
            : current.pageBreakBeforeIds,
        }
      },
    })
  }

  const saveEditorialPage = (page: EditorialPage) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => {
        const existingIndex = current.editorialPages.findIndex((candidate) => (
          candidate.id === page.id
        ))
        return {
          ...current,
          editorialPages: existingIndex < 0
            ? [...current.editorialPages, page]
            : current.editorialPages.map((candidate, index) => (
              index === existingIndex ? page : candidate
            )),
        }
      },
    })
  }

  const deleteEditorialPage = (pageId: string) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => ({
        ...current,
        editorialPages: current.editorialPages.filter((page) => page.id !== pageId),
      }),
    })
  }

  const setParticipantProfile = (
    participant: string,
    displayName: string,
    color: string,
  ) => {
    const normalizedDisplayName = displayName.trim()
    if (!normalizedDisplayName) {
      resetParticipantProfile(participant)
      return
    }
    dispatchSettings({
      type: 'commit',
      historyKey: `participant:${participant}`,
      update: (current) => ({
        ...current,
        participantProfiles: [
          ...current.participantProfiles.filter((profile) => (
            profile.participant !== participant
          )),
          { participant, displayName: normalizedDisplayName.slice(0, 60), color },
        ],
      }),
    })
  }

  const resetParticipantProfile = (participant: string) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => ({
        ...current,
        participantProfiles: current.participantProfiles.filter((profile) => (
          profile.participant !== participant
        )),
      }),
    })
  }

  const setBookmark = (
    messageId: string,
    label: string | null,
    continuationPart?: number,
  ) => {
    const normalizedLabel = label?.trim().slice(0, 80) || null
    const historySuffix = `${messageId}:${continuationPart ?? 1}`
    dispatchSettings({
      type: 'commit',
      historyKey: normalizedLabel === null ? undefined : `bookmark:${historySuffix}`,
      update: (current) => {
        const remaining = current.bookmarks.filter((bookmark) => (
          bookmark.messageId !== messageId ||
          bookmark.continuationPart !== continuationPart
        ))
        return {
          ...current,
          bookmarks: normalizedLabel === null
            ? remaining
            : [{
                messageId,
                label: normalizedLabel,
                ...(continuationPart === undefined ? {} : { continuationPart }),
              }, ...remaining],
        }
      },
    })
  }

  const setPageBookmark = (
    messageId: string,
    label: string | null,
    continuationPart?: number,
  ) => {
    setPendingPageBookmark({
      messageId,
      bookmarked: label !== null,
      continuationPart,
    })
    setBookmark(messageId, label, continuationPart)
  }

  const updatePhotoOverride = (
    messageId: string,
    changes: Partial<Omit<PhotoOverride, 'messageId'>>,
    historyKey?: string,
  ) => {
    dispatchSettings({
      type: 'commit',
      historyKey,
      update: (current) => {
        const nextOverride = {
          ...getPhotoOverride(current, messageId),
          ...changes,
          messageId,
        }
        const remaining = current.photoOverrides.filter((override) => (
          override.messageId !== messageId
        ))
        return {
          ...current,
          photoOverrides: isDefaultPhotoOverride(nextOverride)
            ? remaining
            : [...remaining, nextOverride],
        }
      },
    })
  }

  const chooseManualVideo = (messageId: string) => {
    pendingVideoMessageId.current = messageId
    setVideoAssociationError(null)
    setVideoAssociationNotice(null)
    videoFileInput.current?.click()
  }

  const associateManualVideo = (file: File | undefined) => {
    const messageId = pendingVideoMessageId.current
    pendingVideoMessageId.current = null
    if (!file || !messageId) return
    if (!isValidManualVideoFileName(file.name) || file.size === 0) {
      setVideoAssociationError('Choisissez un fichier vidéo non vide : MP4, MOV, M4V, AVI, WebM ou 3GP.')
      return
    }
    const attachmentId = crypto.randomUUID()
    setVideoAssociationNotice('Vidéo associée au message.')
    setManualVideoFiles((current) => new Map(current).set(attachmentId, file))
    dispatchSettings({
      type: 'commit',
      update: (current) => {
        const previous = current.videoAssociations?.find((association) => association.messageId === messageId)
        return {
          ...current,
          videoAssociations: [
            ...(current.videoAssociations ?? []).filter((association) => association.messageId !== messageId),
            { messageId, fileName: file.name, attachmentId },
          ],
          photoOverrides: previous && previous.fileName !== file.name
            ? current.photoOverrides.map((override) => override.messageId === messageId ? { ...override, videoTime: undefined } : override)
            : current.photoOverrides,
        }
      },
    })
  }

  const removeManualVideo = (messageId: string) => {
    const mediaName = manualVideoMediaName(messageId)
    dispatchSettings({
      type: 'commit',
      update: (current) => ({
        ...current,
        videoAssociations: (current.videoAssociations ?? []).filter((association) => association.messageId !== messageId),
        coverMediaName: current.coverMediaName === mediaName ? null : current.coverMediaName,
        coverPhotoOverride: current.coverPhotoOverride?.mediaName === mediaName ? null : current.coverPhotoOverride,
        backCover: current.backCover.mediaName === mediaName
          ? { ...current.backCover, mediaName: null, photoOverride: null }
          : current.backCover,
      }),
    })
  }

  const resetPhotoOverride = (messageId: string) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => {
        const hasPhotoOverride = current.photoOverrides.some((override) => (
          override.messageId === messageId
        ))
        const hasCaptionOverride = current.captionOverrides.some((override) => (
          override.messageId === messageId
        ))
        if (!hasPhotoOverride && !hasCaptionOverride) {
          return current
        }
        return {
          ...current,
          photoOverrides: current.photoOverrides.filter((override) => (
          override.messageId !== messageId
          )),
          captionOverrides: current.captionOverrides.filter((override) => (
            override.messageId !== messageId
          )),
        }
      },
    })
  }

  const updateCaptionOverride = (messageId: string, text: string) => {
    const sourceCaption = archive.chat.messages.find((message) => (
      message.id === messageId
    ))?.body
    if (sourceCaption === undefined) return
    dispatchSettings({
      type: 'commit',
      historyKey: `caption:${messageId}`,
      update: (current) => {
        const remaining = current.captionOverrides.filter((override) => (
          override.messageId !== messageId
        ))
        return {
          ...current,
          captionOverrides: text === sourceCaption
            ? remaining
            : [...remaining, { messageId, text: text.slice(0, 2_000) }],
        }
      },
    })
  }

  const updateCoverPhotoOverride = (
    mediaName: string,
    changes: Partial<Omit<PhotoOverride, 'messageId'>>,
    historyKey?: string,
  ) => {
    dispatchSettings({
      type: 'commit',
      historyKey,
      update: (current) => {
        const currentOverride = getCoverPhotoOverride(current, mediaName)
        const nextOverride = {
          ...currentOverride,
          ...(changes.fit === undefined ? {} : { fit: changes.fit }),
          ...(changes.focalX === undefined ? {} : { focalX: changes.focalX }),
          ...(changes.focalY === undefined ? {} : { focalY: changes.focalY }),
          ...(changes.rotation === undefined ? {} : { rotation: changes.rotation }),
          mediaName,
        }
        return {
          ...current,
          coverPhotoOverride: isDefaultCoverPhotoOverride(nextOverride)
            ? null
            : nextOverride,
        }
      },
    })
  }

  const resetCoverPhotoOverride = (mediaName: string) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => (
        current.coverPhotoOverride?.mediaName === mediaName
          ? { ...current, coverPhotoOverride: null }
          : current
      ),
    })
  }

  const updateBackCoverPhotoOverride = (
    mediaName: string,
    changes: Partial<Omit<PhotoOverride, 'messageId'>>,
    historyKey?: string,
  ) => {
    dispatchSettings({
      type: 'commit',
      historyKey,
      update: (current) => {
        const currentOverride = getBackCoverPhotoOverride(current, mediaName)
        const nextOverride = {
          ...currentOverride,
          ...(changes.fit === undefined ? {} : { fit: changes.fit }),
          ...(changes.focalX === undefined ? {} : { focalX: changes.focalX }),
          ...(changes.focalY === undefined ? {} : { focalY: changes.focalY }),
          ...(changes.rotation === undefined ? {} : { rotation: changes.rotation }),
          mediaName,
        }
        return {
          ...current,
          backCover: {
            ...current.backCover,
            photoOverride: isDefaultCoverPhotoOverride(nextOverride)
              ? null
              : nextOverride,
          },
        }
      },
    })
  }

  const resetBackCoverPhotoOverride = (mediaName: string) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => (
        current.backCover.photoOverride?.mediaName === mediaName
          ? {
              ...current,
              backCover: { ...current.backCover, photoOverride: null },
            }
          : current
      ),
    })
  }

  const inspectPhoto = (messageId: string) => {
    const targetPage = pages.findIndex((page) => page.some((message) => (
      (message.sourceMessageId ?? message.id) === messageId &&
      Boolean(message.mediaName || message.videoName)
    )))
    if (targetPage < 0) return
    inspectorReturnWorkspace.current = activeWorkspace
    setPageIndex(targetPage + 1)
    setSelectedPhotoId(messageId)
    setSelectedCoverMediaName(null)
    setSelectedBackCoverMediaName(null)
    setSelectedStructureId(null)
    setActiveWorkspace(null)
  }

  const inspectStructure = (messageId: string) => {
    const targetPage = pages.findIndex((page) => page.some((message) => (
      (message.sourceMessageId ?? message.id) === messageId
    )))
    if (targetPage < 0) return
    inspectorReturnWorkspace.current = activeWorkspace
    setPageIndex(targetPage + 1)
    setSelectedStructureId(messageId)
    setSelectedPhotoId(null)
    setSelectedCoverMediaName(null)
    setSelectedBackCoverMediaName(null)
    setActiveWorkspace(null)
  }

  const inspectCoverPhoto = (mediaName: string) => {
    if (!archive.chat.messages.some((message) => message.mediaName === mediaName)) return
    inspectorReturnWorkspace.current = activeWorkspace
    setPageIndex(0)
    setSelectedCoverMediaName(mediaName)
    setSelectedBackCoverMediaName(null)
    setSelectedPhotoId(null)
    setSelectedStructureId(null)
    setActiveWorkspace(null)
  }

  const inspectBackCoverPhoto = (mediaName: string) => {
    if (!archive.chat.messages.some((message) => message.mediaName === mediaName)) return
    inspectorReturnWorkspace.current = activeWorkspace
    setPageIndex(pages.length + 1)
    setSelectedBackCoverMediaName(mediaName)
    setSelectedPhotoId(null)
    setSelectedCoverMediaName(null)
    setSelectedStructureId(null)
    setActiveWorkspace(null)
  }

  const closeInspector = () => {
    setSelectedPhotoId(null)
    setSelectedCoverMediaName(null)
    setSelectedBackCoverMediaName(null)
    setSelectedStructureId(null)
    setActiveWorkspace(inspectorReturnWorkspace.current)
    inspectorReturnWorkspace.current = null
  }

  const chooseCoverPhoto = () => {
    setContentInitialView('photos')
    setContentQuery('')
    contentScrollPosition.current = 0
    setActiveWorkspace('souvenirs')
  }

  const openWorkspace = (workspace: WorkspacePanel) => {
    setSelectedPhotoId(null)
    setSelectedCoverMediaName(null)
    setSelectedBackCoverMediaName(null)
    setSelectedStructureId(null)
    setActiveWorkspace(workspace)
    if (workspace === 'couverture') setPageIndex(0)
    if (workspace === 'organiser') setEditorialPageAnchorId(null)
  }

  const resetStructure = (messageId: string) => {
    dispatchSettings({
      type: 'commit',
      update: (current) => {
        const chapters = current.chapters.filter((chapter) => (
          chapter.messageId !== messageId
        ))
        const pageBreakBeforeIds = current.pageBreakBeforeIds.filter((id) => (
          id !== messageId
        ))
        const bookmarks = current.bookmarks.filter((bookmark) => (
          bookmark.messageId !== messageId
        ))
        if (
          chapters.length === current.chapters.length &&
          pageBreakBeforeIds.length === current.pageBreakBeforeIds.length &&
          bookmarks.length === current.bookmarks.length
        ) {
          return current
        }
        return { ...current, chapters, pageBreakBeforeIds, bookmarks }
      },
    })
  }

  const previewMessage = (messageId: string, continuationPart?: number) => {
    let targetPage = pages.findIndex((page) => page.some((message) => (
      (message.sourceMessageId ?? message.id) === messageId &&
      (message.continuation?.part ?? 1) === (continuationPart ?? 1)
    )))
    if (targetPage < 0 && continuationPart !== undefined) {
      targetPage = pages.findIndex((page) => page.some((message) => (
        (message.sourceMessageId ?? message.id) === messageId
      )))
    }
    if (targetPage < 0) return
    setPageIndex(targetPage + 1)
    setSelectedCoverMediaName(null)
    if (globalThis.matchMedia('(max-width: 760px)').matches) {
      setActiveWorkspace(null)
    }
  }

  const previewEditorialPage = (pageId: string) => {
    const targetPage = pages.findIndex((page) => (
      page[0]?.editorial?.pageId === pageId
    ))
    if (targetPage < 0) return
    setPageIndex(targetPage + 1)
    if (globalThis.matchMedia('(max-width: 760px)').matches) {
      setActiveWorkspace(null)
    }
  }

  const addEditorialPageBefore = (messageId: string) => {
    setEditorialPageAnchorId(messageId)
    setSelectedStructureId(null)
    setActiveWorkspace('organiser')
  }

  const persistBeforeReset = async () => {
    if (projectReady) {
      await saveBookProject({
        projectId: archive.projectId,
        archiveName: archive.fileName,
        settings,
      }).catch(() => undefined)
    }
    onReset()
  }

  const resetProject = async () => {
    const confirmed = globalThis.confirm(
      'Réinitialiser tous les réglages, exclusions, contenus éditoriaux et la couverture de ce projet ?',
    )
    if (!confirmed) return
    await deleteBookProject(archive.projectId).catch(() => undefined)
    dispatchSettings({
      type: 'replace',
      value: createInitialSettings(archive.chat, archive.fileName),
    })
    setPageIndex(0)
    setSelectedPhotoId(null)
    setSelectedCoverMediaName(null)
    setSelectedStructureId(null)
    setActiveWorkspace(null)
  }

  const exportPortableProject = () => {
    setPrintError(null)
    try {
      const source = serializePortableProject({
        projectId: archive.projectId,
        archiveName: archive.fileName,
        settings,
      })
      const url = URL.createObjectURL(new Blob([source], {
        type: 'application/json;charset=utf-8',
      }))
      const link = document.createElement('a')
      link.href = url
      link.download = portableProjectFileName(settings.title)
      document.body.append(link)
      link.click()
      link.remove()
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error) {
      setPrintError(
        error instanceof PortableProjectError
          ? error.message
          : 'Le projet n’a pas pu être exporté.',
      )
    }
  }

  const closePreflight = () => {
    setPreflightReport(null)
    setPrintSnapshot(null)
  }

  const printPreparedDocument = () => {
    setPreflightReport(null)
    window.addEventListener(
      'afterprint',
      () => setPrintSnapshot(null),
      { once: true },
    )
    window.print()
  }

  const downloadPreparedPdf = async () => {
    if (!printSnapshot) return
    const report = preflightReport ?? undefined
    setPreflightReport(null)
    setPrintError(null)
    setPrintProgress(0)
    setIsGeneratingPdf(true)
    const controller = new AbortController()
    pdfAbortController.current = controller
    try {
      const {
        directPdfFileName,
        generateDirectPdf,
      } = await import('../lib/direct-pdf-export')
      const blob = await generateDirectPdf({
        archive,
        settings: printSnapshot.settings,
        messages: printSnapshot.messages,
        pages: printSnapshot.pages,
        onProgress: setPrintProgress,
        signal: controller.signal,
        report,
      })
      const url = URL.createObjectURL(blob)
      setPreparedPdf({
        url,
        fileName: directPdfFileName(printSnapshot.settings.title),
        size: blob.size,
      })
      setPrintSnapshot(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setPrintError(
        error instanceof Error
          ? `Le PDF n’a pas pu être créé : ${error.message}`
          : 'Le PDF direct n’a pas pu être créé. Utilisez l’impression système ou réduisez la période.',
      )
    } finally {
      pdfAbortController.current = null
      setIsGeneratingPdf(false)
    }
  }

  const viewPreflightPage = (physicalPage: number) => {
    setPageIndex(Math.max(0, Math.min(physicalPageCount - 1, physicalPage - 1)))
    closePreflight()
  }

  const preparePrint = async () => {
    cancelPrint.current = false
    setPrintError(null)
    setPrintProgress(0)
    const textContrast = contrastRatio(
      settings.artDirection.inkColor,
      settings.artDirection.paperColor,
    )
    if (textContrast < 4.5) {
      setPrintError(
        `Le contraste texte/papier est insuffisant (${textContrast.toFixed(2)}:1). Choisissez des couleurs atteignant au moins 4,5:1 dans Style.`,
      )
      return
    }
    setIsPreparingPrint(true)
    const snapshotSettings = structuredClone(settings)
    const snapshotMessages = filterMessages(
      archive.chat.messages,
      snapshotSettings,
    )
    try {
      const mediaNames = [
        ...new Set(
          snapshotMessages.flatMap((message) =>
            message.mediaName ? [message.mediaName] : [],
          ),
        ),
      ]

      for (let index = 0; index < mediaNames.length; index += 4) {
        if (cancelPrint.current) {
          setIsPreparingPrint(false)
          return
        }
        const batch = mediaNames.slice(index, index + 4)
        await Promise.all(batch.map((name) => inspectPhotoAspectRatio(archive, name)))
        setPrintProgress(Math.round(((index + batch.length) / mediaNames.length) * 88))
      }

      if (cancelPrint.current) {
        setIsPreparingPrint(false)
        return
      }

      setPrintSnapshot({
        settings: { ...snapshotSettings, photoAspectRatios: getPhotoAspectRatios(archive) },
        messages: snapshotMessages,
        pages: paginateMessages(snapshotMessages, {
          ...snapshotSettings,
          photoAspectRatios: getPhotoAspectRatios(archive),
        }),
      })
      setPrintProgress(92)
      await nextFrame()

      for (let attempt = 0; attempt < 125; attempt += 1) {
        if (!document.querySelector('.print-document .media-loading')) break
        if (cancelPrint.current) {
          setPrintSnapshot(null)
          setIsPreparingPrint(false)
          return
        }
        await shortWait()
      }

      await document.fonts.ready
      const printImages = Array.from(
        document.querySelectorAll<HTMLImageElement>('.print-document img'),
      )
      await Promise.all(printImages.map(waitForImageDecode))
      setPrintProgress(96)
      await nextFrame()

      const printDocument = document.querySelector<HTMLElement>('.print-document')
      if (!printDocument) throw new Error('Print document is unavailable')
      const layoutReport = inspectPrintLayout(printDocument)
      if (!layoutReport.valid) {
        const pagesWithIssues = [
          ...new Set(layoutReport.issues.map((issue) => issue.page)),
        ]
        const pageList = pagesWithIssues.slice(0, 6).join(', ')
        const remaining = Math.max(0, pagesWithIssues.length - 6)
        setPrintSnapshot(null)
        setIsPreparingPrint(false)
        setPrintError(
          `La vérification a détecté un problème de mise en page sur ${pagesWithIssues.length} page${pagesWithIssues.length > 1 ? 's' : ''} (${pageList}${remaining ? ` et ${remaining} autre${remaining > 1 ? 's' : ''}` : ''}). Changez le format ou réduisez la taille du texte.`,
        )
        return
      }

      setPrintProgress(100)
      setIsPreparingPrint(false)
      setPreflightReport(inspectPhotoQuality(printDocument))
    } catch {
      setPrintSnapshot(null)
      setIsPreparingPrint(false)
      setPrintError('Le document n’a pas pu être préparé. Réduisez la période puis réessayez.')
    }
  }

  const workspaceNavigation = (
    <nav className="workspace-switcher" aria-label="Réglages du livre">
      {WORKSPACE_OPTIONS.map(({ id, label, icon: Icon, className }) => {
        const isActive = (activeWorkspace ?? 'couverture') === id
        return (
          <button
            key={id}
            type="button"
            className={`${className}${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            onClick={() => openWorkspace(id)}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
            {id === 'souvenirs' && settings.excludedMessageIds.length > 0 ? (
              <span>{settings.excludedMessageIds.length}</span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )

  return (
    <main className="studio">
      <input ref={videoFileInput} type="file" accept="video/*,.mp4,.mov,.m4v,.avi,.webm,.3gp" hidden onChange={(event) => {
        associateManualVideo(event.currentTarget.files?.[0])
        event.currentTarget.value = ''
      }} />
      <div className="studio-toolbar">
        <div className="studio-file">
          <span className="file-status" aria-hidden="true"><Check size={13} /></span>
          <div>
            <strong>{archive.fileName.replace(/\.zip$/i, '')}</strong>
            <span>
              {archive.chat.messages.length.toLocaleString('fr-FR')} messages ·{' '}
              {archive.availableMedia.toLocaleString('fr-FR')} photos
            </span>
          </div>
        </div>
        {workspaceNavigation}
        <div className="toolbar-actions">
          <div className="project-menu" ref={projectMenuRef}>
            <button
              type="button"
              className="project-menu-trigger"
              aria-label="Projet"
              aria-expanded={projectMenuOpen}
              aria-haspopup="menu"
              onClick={() => setProjectMenuOpen((open) => !open)}
            >
              <FolderCog size={17} aria-hidden="true" />
              <span>Projet</span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
            {projectMenuOpen ? (
              <div className="project-menu-popover" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProjectMenuOpen(false)
                    void persistBeforeReset()
                  }}
                >
                  <RotateCcw size={14} /> Changer d’archive
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProjectMenuOpen(false)
                    exportPortableProject()
                  }}
                >
                  <Download size={14} /> Exporter .chatbound
                </button>
                <button
                  type="button"
                  className="is-danger"
                  role="menuitem"
                  onClick={() => {
                    setProjectMenuOpen(false)
                    void resetProject()
                  }}
                >
                  <Trash2 size={14} /> Réinitialiser le projet
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button"
            title="Annuler (⌘Z)"
            aria-label="Annuler"
            disabled={settingsHistory.past.length === 0}
            onClick={() => dispatchSettings({ type: 'undo' })}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            title="Rétablir (⌘⇧Z)"
            aria-label="Rétablir"
            disabled={settingsHistory.future.length === 0}
            onClick={() => dispatchSettings({ type: 'redo' })}
          >
            <Redo2 size={17} />
          </button>
          <span
            className={`save-status is-${saveStatus}`}
            title={saveStatus === 'error' ? 'La sauvegarde locale est indisponible' : 'Sauvegarde automatique sur cet appareil'}
          >
            {saveStatus === 'loading' || saveStatus === 'saving' ? (
              <LoaderCircle className="spin" size={14} />
            ) : saveStatus === 'saved' ? (
              <CheckCircle2 size={14} />
            ) : (
              <HardDrive size={14} />
            )}
            <span>
              {saveStatus === 'loading'
                ? 'Chargement…'
                : saveStatus === 'saving'
                  ? 'Sauvegarde…'
                  : saveStatus === 'saved'
                    ? 'Enregistré'
                    : 'Non sauvegardé'}
            </span>
          </span>
          <button
            type="button"
            className="button export-button"
            aria-label="Créer le PDF"
            disabled={isPreparingPrint || isGeneratingPdf || !hasPrintableContent}
            onClick={() => void preparePrint()}
          >
            <FileDown size={17} aria-hidden="true" />
            Créer le PDF
          </button>
        </div>
      </div>

      {printError ? <p className="print-error" role="alert">{printError}</p> : null}

      <div className={`studio-layout${activeWorkspace ? ' has-content-panel' : ''}`}>
        {activeWorkspace === null || activeWorkspace === 'couverture' ? (
          <CoverPanel
            title={settings.title}
            subtitle={settings.subtitle}
            hasPhoto={Boolean(activeCoverMediaName)}
            isOpen={activeWorkspace === 'couverture'}
            onTitleChange={(title) => updateSetting('title', title)}
            onSubtitleChange={(subtitle) => updateSetting('subtitle', subtitle)}
            onChoosePhoto={chooseCoverPhoto}
            onClose={() => setActiveWorkspace(null)}
          />
        ) : null}

        <div className="preview-column">
          <div className="selection-summary">
            <div><MessageSquareText size={15} /><strong>{filteredMessages.length.toLocaleString('fr-FR')}</strong><span>messages</span></div>
            <div><Image size={15} /><strong>{selectedPhotos.toLocaleString('fr-FR')}</strong><span>photos</span></div>
            <div><Users size={15} /><strong>{settings.includedParticipants.length}</strong><span>participants</span></div>
            <div><BookOpen size={15} /><strong>{physicalPageCount.toLocaleString('fr-FR')}</strong><span>pages estimées</span></div>
          </div>
          <BookPreview
            archive={archive}
            settings={deferredSettings}
            messages={filteredMessages}
            pages={pages}
            pageIndex={pageIndex}
            onPageChange={(page) => {
              setPageIndex(page)
              setSelectedPhotoId(null)
              setSelectedCoverMediaName(null)
              setSelectedBackCoverMediaName(null)
              setSelectedStructureId(null)
            }}
            selectedPhotoId={selectedPhotoId}
            onSelectPhoto={inspectPhoto}
            selectedStructureId={selectedStructureId}
            onSelectStructure={inspectStructure}
            selectedCoverMediaName={selectedCoverMediaName}
            onSelectCoverPhoto={inspectCoverPhoto}
            selectedBackCoverMediaName={selectedBackCoverMediaName}
            onSelectBackCoverPhoto={inspectBackCoverPhoto}
            onSetPageBookmark={setPageBookmark}
          />
        </div>

        {activeWorkspace === 'souvenirs' ? (
          <ContentManager
            archive={archive}
            messages={applyCaptionOverrides(editorialMessages, settings)}
            excludedMessageIds={settings.excludedMessageIds}
            coverMediaName={settings.coverMediaName}
            backCoverMediaName={settings.backCover.mediaName}
            view={contentInitialView}
            query={contentQuery}
            scrollPosition={contentScrollPosition}
            filtersOpen={contentFiltersOpen}
            onFiltersOpenChange={setContentFiltersOpen}
            onViewChange={(view) => {
              contentScrollPosition.current = 0
              setContentInitialView(view)
            }}
            onQueryChange={(query) => {
              contentScrollPosition.current = 0
              setContentQuery(query)
            }}
            photoOverrides={settings.photoOverrides}
            captionOverrides={settings.captionOverrides}
            videoAssociations={settings.videoAssociations ?? []}
            missingVideoMessageIds={missingVideoMessageIds}
            connectedVideoIds={(settings.videoAssociations ?? []).filter((association) => manualVideoFiles.has(association.attachmentId)).map((association) => association.messageId)}
            videoAssociationError={videoAssociationError}
            videoAssociationNotice={videoAssociationNotice}
            onChooseVideo={chooseManualVideo}
            participantProfiles={settings.participantProfiles}
            dateFrom={settings.dateFrom}
            dateTo={settings.dateTo}
            participants={archive.chat.participants}
            includedParticipants={settings.includedParticipants}
            showSystem={settings.showSystem}
            showMissingMedia={settings.showMissingMedia}
            showDeleted={settings.showDeleted}
            onClose={() => setActiveWorkspace(null)}
            onPreview={previewMessage}
            onSetCover={setCoverMedia}
            onSetBackCover={setBackCoverMedia}
            onSetExcluded={setExcludedMessages}
            onEditPhoto={inspectPhoto}
            onSetDateFrom={(value) => updateSetting('dateFrom', value)}
            onSetDateTo={(value) => updateSetting('dateTo', value)}
            onSetIncludedParticipants={(participants) => updateSetting('includedParticipants', participants)}
            onToggleParticipant={toggleParticipant}
            onSetShowSystem={(checked) => updateSetting('showSystem', checked)}
            onSetShowMissingMedia={(checked) => updateSetting('showMissingMedia', checked)}
            onSetShowDeleted={(checked) => updateSetting('showDeleted', checked)}
          />
        ) : null}

        {activeWorkspace === 'organiser' ? (
          <EditorialPanel
            messages={applyCaptionOverrides(selectableMessages, deferredSettings)}
            participants={settings.includedParticipants}
            allParticipants={archive.chat.participants}
            participantProfiles={settings.participantProfiles}
            editorialPages={settings.editorialPages}
            showTableOfContents={settings.showTableOfContents}
            bookmarks={settings.bookmarks}
            chapters={settings.chapters}
            pageBreakBeforeIds={settings.pageBreakBeforeIds}
            visibleMessageIds={editorialVisibleMessages.map((message) => message.id)}
            initialPageAnchorId={editorialPageAnchorId}
            onClose={() => setActiveWorkspace(null)}
            onSetTableOfContents={(enabled) => updateSetting('showTableOfContents', enabled)}
            onSavePage={saveEditorialPage}
            onDeletePage={deleteEditorialPage}
            onPreviewPage={previewEditorialPage}
            onSetParticipantProfile={setParticipantProfile}
            onResetParticipantProfile={resetParticipantProfile}
            onSetBookmark={setBookmark}
            onSetChapter={setChapter}
            onSetPageBreak={setPageBreak}
            onPreviewMessage={previewMessage}
            onInitialPageHandled={() => setEditorialPageAnchorId(null)}
          />
        ) : null}

        {activeWorkspace === 'apparence' ? (
          <StylePanel
            settings={settings}
            artDirection={settings.artDirection}
            accent={settings.accent}
            onClose={() => setActiveWorkspace(null)}
            onApplyPreset={applyVisualPreset}
            onChange={updateArtDirection}
            onAccentChange={(accent) => updateSetting('accent', accent)}
            onChooseBackCoverPhoto={() => {
              setContentInitialView('photos')
              setContentQuery('')
              contentScrollPosition.current = 0
              setActiveWorkspace('souvenirs')
            }}
            onSettingChange={updateSetting}
          />
        ) : null}
      </div>

      {selectedPhotoMessage && selectedPhotoOverride ? (
        <PhotoInspector
          message={selectedPhotoMessage}
          archive={archive}
          displayMediaName={settings.videoAssociations?.find((association) => association.messageId === selectedPhotoMessage.id)?.fileName}
          videoAssociationError={videoAssociationError}
          manualVideoConnected={settings.videoAssociations?.some((association) => association.messageId === selectedPhotoMessage.id && manualVideoFiles.has(association.attachmentId))}
          onChooseVideo={settings.videoAssociations?.some((association) => association.messageId === selectedPhotoMessage.id) ? () => chooseManualVideo(selectedPhotoMessage.id) : undefined}
          onRemoveVideo={settings.videoAssociations?.some((association) => association.messageId === selectedPhotoMessage.id) ? () => removeManualVideo(selectedPhotoMessage.id) : undefined}
          override={selectedPhotoOverride}
          caption={selectedCaptionOverride?.text ?? selectedPhotoMessage.body}
          captionEdited={Boolean(selectedCaptionOverride)}
          onChange={(changes, historyKey) => updatePhotoOverride(
            selectedPhotoMessage.id,
            changes,
            historyKey,
          )}
          onClose={closeInspector}
          onReset={() => resetPhotoOverride(selectedPhotoMessage.id)}
          onCaptionChange={(caption) => updateCaptionOverride(
            selectedPhotoMessage.id,
            caption,
          )}
        />
      ) : null}

      {selectedCoverPhotoMessage && selectedCoverPhotoOverride ? (
        <PhotoInspector
          context="cover"
          message={selectedCoverPhotoMessage}
          override={selectedCoverPhotoOverride}
          onChange={(changes, historyKey) => updateCoverPhotoOverride(
            selectedCoverPhotoMessage.mediaName!,
            changes,
            historyKey,
          )}
          onClose={closeInspector}
          onReset={() => resetCoverPhotoOverride(selectedCoverPhotoMessage.mediaName!)}
        />
      ) : null}

      {selectedBackCoverPhotoMessage && selectedBackCoverPhotoOverride ? (
        <PhotoInspector
          context="back-cover"
          message={selectedBackCoverPhotoMessage}
          override={selectedBackCoverPhotoOverride}
          onChange={(changes, historyKey) => updateBackCoverPhotoOverride(
            selectedBackCoverPhotoMessage.mediaName!,
            changes,
            historyKey,
          )}
          onClose={closeInspector}
          onReset={() => resetBackCoverPhotoOverride(selectedBackCoverPhotoMessage.mediaName!)}
        />
      ) : null}

      {selectedStructureMessage ? (
        <StructureInspector
          key={selectedStructureMessage.id}
          message={selectedStructureMessage}
          chapterTitle={selectedChapter?.title ?? null}
          hasPageBreak={selectedHasPageBreak}
          bookmarkLabel={selectedBookmark?.label ?? null}
          onSetChapter={(title) => setChapter(selectedStructureMessage.id, title)}
          onSetPageBreak={(enabled) => setPageBreak(selectedStructureMessage.id, enabled)}
          onSetBookmark={(label) => setBookmark(selectedStructureMessage.id, label)}
          onAddEditorialPage={() => addEditorialPageBefore(selectedStructureMessage.id)}
          onReset={() => resetStructure(selectedStructureMessage.id)}
          onClose={closeInspector}
        />
      ) : null}

      {isPreparingPrint || isGeneratingPdf ? (
        <div className="print-progress-backdrop">
          <div className="print-progress-dialog" role="dialog" aria-modal="true" aria-labelledby="print-progress-title">
            <FileDown size={24} aria-hidden="true" />
            <h2 id="print-progress-title">
              {isGeneratingPdf
                ? 'Création du PDF direct'
                : `Préparation de ${physicalPageCount.toLocaleString('fr-FR')} pages`}
            </h2>
            <progress max="100" value={printProgress} />
            <span>{printProgress} %</span>
            {isPreparingPrint || isGeneratingPdf ? (
              <button
                type="button"
                className="button secondary-button"
                onClick={() => {
                  cancelPrint.current = true
                  pdfAbortController.current?.abort()
                }}
              >
                Annuler
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {preflightReport ? (
        <PreflightDialog
          report={preflightReport}
          mediaNames={Object.fromEntries((settings.videoAssociations ?? []).map((association) => [manualVideoMediaName(association.messageId), association.fileName]))}
          onCancel={closePreflight}
          onDownload={() => void downloadPreparedPdf()}
          onPrint={printPreparedDocument}
          onViewPage={viewPreflightPage}
        />
      ) : null}

      {preparedPdf ? (
        <div className="print-progress-backdrop">
          <section
            className="print-progress-dialog pdf-ready-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-ready-title"
          >
            <CheckCircle2 size={26} aria-hidden="true" />
            <h2 id="pdf-ready-title">PDF prêt</h2>
            <p>
              {(preparedPdf.size / (1024 * 1024)).toLocaleString('fr-FR', {
                maximumFractionDigits: 1,
              })} Mo · texte et navigation inclus
            </p>
            <div className="pdf-ready-actions">
              <button
                type="button"
                className="button secondary-button"
                onClick={() => setPreparedPdf(null)}
              >
                Retour au livre
              </button>
              <a
                className="button primary-button"
                href={preparedPdf.url}
                download={preparedPdf.fileName}
              >
                <Download size={16} aria-hidden="true" />
                Télécharger le PDF
              </a>
            </div>
          </section>
        </div>
      ) : null}

      {printSnapshot ? (
        <PrintDocument
          archive={archive}
          settings={printSnapshot.settings}
          messages={printSnapshot.messages}
          pages={printSnapshot.pages}
        />
      ) : null}
    </main>
  )
}