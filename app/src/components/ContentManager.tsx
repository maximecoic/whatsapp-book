import {
  BookCopy,
  BookImage,
  Check,
  Eye,
  EyeOff,
  Film,
  Image,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  Video,
  X,
} from 'lucide-react'
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ChatArchive } from '../lib/archive-reader'
import type {
  CaptionOverride,
  ParticipantProfile,
  PhotoOverride,
} from '../lib/book-model'
import {
  selectContentMessages,
  type ContentView,
} from '../lib/content-selection'
import type { ChatMessage } from '../lib/chat-types'
import { getVideoFrame, isVideoMedia } from '../lib/video-frame'
import type { ManualVideoAssociation } from '../lib/manual-video'
import { useResponsiveWorkspacePanel } from './useResponsiveWorkspacePanel'

interface ContentManagerProps {
  archive: ChatArchive
  messages: ChatMessage[]
  excludedMessageIds: string[]
  coverMediaName: string | null
  backCoverMediaName: string | null
  photoOverrides: PhotoOverride[]
  captionOverrides: CaptionOverride[]
  videoAssociations: ManualVideoAssociation[]
  missingVideoMessageIds: string[]
  connectedVideoIds: string[]
  videoAssociationError: string | null
  videoAssociationNotice: string | null
  participantProfiles: ParticipantProfile[]
  dateFrom: string
  dateTo: string
  participants: string[]
  includedParticipants: string[]
  showSystem: boolean
  showMissingMedia: boolean
  showDeleted: boolean
  view: ContentView
  query: string
  scrollPosition: { current: number }
  filtersOpen: boolean
  onFiltersOpenChange(open: boolean): void
  onViewChange(view: ContentView): void
  onQueryChange(query: string): void
  onClose(): void
  onPreview(messageId: string): void
  onSetCover(mediaName: string | null): void
  onSetBackCover(mediaName: string | null): void
  onSetExcluded(messageIds: string[], excluded: boolean): void
  onEditPhoto(messageId: string): void
  onChooseVideo(messageId: string): void
  onSetDateFrom(value: string): void
  onSetDateTo(value: string): void
  onSetIncludedParticipants(participants: string[]): void
  onToggleParticipant(participant: string): void
  onSetShowSystem(checked: boolean): void
  onSetShowMissingMedia(checked: boolean): void
  onSetShowDeleted(checked: boolean): void
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
})

function monthKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}`
}

function SelectionToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange(checked: boolean): void
}) {
  return (
    <label className="toggle-row memory-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true"><span /></span>
    </label>
  )
}

function LazyThumbnail({
  archive,
  mediaName,
}: {
  archive: ChatArchive
  mediaName: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [source, setSource] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let active = true
    let temporaryUrl: string | null = null

    const load = () => {
      const source = isVideoMedia(mediaName)
        ? getVideoFrame(archive, mediaName).then((blob) => {
          if (!blob || !active) return null
          temporaryUrl = URL.createObjectURL(blob)
          return temporaryUrl
        })
        : archive.getMediaUrl(mediaName)
      void source.then((url) => {
        if (!active) return
        if (url) setSource(url)
        else setFailed(true)
      })
    }

    if (!('IntersectionObserver' in globalThis)) {
      load()
      return () => {
        active = false
        if (temporaryUrl) URL.revokeObjectURL(temporaryUrl)
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      load()
    }, { rootMargin: '240px' })
    observer.observe(container)
    return () => {
      active = false
      observer.disconnect()
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl)
    }
  }, [archive, mediaName])

  return (
    <div className="content-thumbnail" ref={containerRef}>
      {source ? <img src={source} alt="" /> : null}
      {isVideoMedia(mediaName) ? <span className="content-video-badge"><Film size={12} /></span> : null}
      {!source ? (
        <span className={failed ? 'has-failed' : ''}>
          <Image size={18} aria-hidden="true" />
        </span>
      ) : null}
    </div>
  )
}

export function ContentManager({
  archive,
  messages,
  excludedMessageIds,
  coverMediaName,
  backCoverMediaName,
  photoOverrides,
  captionOverrides,
  videoAssociations,
  missingVideoMessageIds,
  connectedVideoIds,
  videoAssociationError,
  videoAssociationNotice,
  participantProfiles,
  dateFrom,
  dateTo,
  participants,
  includedParticipants,
  showSystem,
  showMissingMedia,
  showDeleted,
  view,
  query,
  scrollPosition,
  filtersOpen,
  onFiltersOpenChange,
  onViewChange,
  onQueryChange,
  onClose,
  onPreview,
  onSetCover,
  onSetBackCover,
  onSetExcluded,
  onEditPhoto,
  onChooseVideo,
  onSetDateFrom,
  onSetDateTo,
  onSetIncludedParticipants,
  onToggleParticipant,
  onSetShowSystem,
  onSetShowMissingMedia,
  onSetShowDeleted,
}: ContentManagerProps) {
  const { isDocked, panelRef } = useResponsiveWorkspacePanel(
    onClose,
    '.content-manager-button',
  )
  const timelineRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (timelineRef.current) timelineRef.current.scrollTop = scrollPosition.current
  }, [scrollPosition, query, view])
  const deferredQuery = useDeferredValue(query)
  const excluded = new Set(excludedMessageIds)
  const adjustedPhotos = new Set(
    photoOverrides.map((override) => override.messageId),
  )
  const adjustedCaptions = new Set(
    captionOverrides.map((override) => override.messageId),
  )
  const videoByMessage = new Map(videoAssociations.map((association) => [association.messageId, association]))
  const connectedVideos = new Set(connectedVideoIds)
  const participantNames = new Map(
    participantProfiles.map((profile) => [profile.participant, profile.displayName]),
  )
  const visibleMessages = selectContentMessages(messages, {
    query: deferredQuery,
    view,
    excludedMessageIds,
    missingMessageIds: missingVideoMessageIds,
  })
  let previousMonth = ''

  return (
    <>
      {!isDocked ? (
        <button
          className="content-drawer-backdrop"
          type="button"
          aria-label="Fermer la sélection de contenu"
          tabIndex={-1}
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={panelRef}
        className={`content-drawer${isDocked ? ' is-docked' : ''}`}
        role={isDocked ? 'complementary' : 'dialog'}
        aria-modal={isDocked ? undefined : true}
        aria-labelledby="content-drawer-title"
      >
        <header className="content-drawer-header">
          <div>
            <span className="eyebrow">Souvenirs</span>
            <h2 id="content-drawer-title">Choisir les souvenirs</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer"
            title="Fermer"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="content-drawer-controls">
          <details
            className="memory-scope"
            open={filtersOpen}
            onToggle={(event) => onFiltersOpenChange(event.currentTarget.open)}
          >
            <summary>
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>Période et participants</span>
              <small>{includedParticipants.length}/{participants.length} personnes</small>
            </summary>
            <div className="memory-scope-content">
              <div className="memory-date-fields">
                <label>
                  Du
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(event) => onSetDateFrom(event.target.value)}
                  />
                </label>
                <label>
                  Au
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    onChange={(event) => onSetDateTo(event.target.value)}
                  />
                </label>
              </div>

              <div className="memory-participants-heading">
                <span>Participants</span>
                <div>
                  <button type="button" onClick={() => onSetIncludedParticipants(participants)}>Tous</button>
                  <button type="button" onClick={() => onSetIncludedParticipants([])}>Aucun</button>
                </div>
              </div>
              <div className="memory-participants">
                {participants.map((participant) => (
                  <label key={participant}>
                    <input
                      type="checkbox"
                      checked={includedParticipants.includes(participant)}
                      onChange={() => onToggleParticipant(participant)}
                    />
                    <span className="custom-check" aria-hidden="true"><Check size={10} /></span>
                    <span title={participant}>{participant}</span>
                  </label>
                ))}
              </div>

              <div className="memory-content-toggles">
                <SelectionToggle checked={showSystem} label="Système" onChange={onSetShowSystem} />
                <SelectionToggle checked={showMissingMedia} label="Médias absents" onChange={onSetShowMissingMedia} />
                <SelectionToggle checked={showDeleted} label="Supprimés" onChange={onSetShowDeleted} />
              </div>
            </div>
          </details>

          <label className="content-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder="Rechercher un message, une personne…"
              aria-label="Rechercher dans la conversation"
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                aria-label="Effacer la recherche"
                title="Effacer la recherche"
                onClick={() => onQueryChange('')}
              >
                <X size={14} />
              </button>
            ) : null}
          </label>

          <div className="content-view-selector" role="group" aria-label="Type de contenu">
            <button
              type="button"
              className={view === 'all' ? 'is-active' : ''}
              aria-pressed={view === 'all'}
              onClick={() => onViewChange('all')}
            >
              <MessageSquareText size={14} /> Tout
            </button>
            <button
              type="button"
              className={view === 'photos' ? 'is-active' : ''}
              aria-pressed={view === 'photos'}
              onClick={() => onViewChange('photos')}
            >
              <Image size={14} /> Photos
            </button>
            <button
              type="button"
              className={view === 'missing' ? 'is-active' : ''}
              aria-pressed={view === 'missing'}
              onClick={() => onViewChange('missing')}
            >
              <Video size={14} /> Manquants
            </button>
            <button
              type="button"
              className={view === 'hidden' ? 'is-active' : ''}
              aria-pressed={view === 'hidden'}
              onClick={() => onViewChange('hidden')}
            >
              <EyeOff size={14} /> Masqués
            </button>
          </div>

          {videoAssociationError ? <p className="video-association-error" role="alert">{videoAssociationError}</p> : null}
          {videoAssociationNotice ? <p className="video-association-notice" role="status">{videoAssociationNotice}</p> : null}

          <div className="content-bulk-actions">
            <span>{visibleMessages.length.toLocaleString('fr-FR')} résultat{visibleMessages.length > 1 ? 's' : ''}</span>
            <div>
              <button
                type="button"
                disabled={visibleMessages.length === 0}
                onClick={() => onSetExcluded(visibleMessages.map(({ id }) => id), false)}
              >
                <Eye size={13} /> Tout inclure
              </button>
              <button
                type="button"
                disabled={visibleMessages.length === 0}
                onClick={() => onSetExcluded(visibleMessages.map(({ id }) => id), true)}
              >
                <EyeOff size={13} /> Tout masquer
              </button>
            </div>
          </div>
        </div>

        <div
          className="content-timeline"
          ref={timelineRef}
          onScroll={(event) => { scrollPosition.current = event.currentTarget.scrollTop }}
        >
          {visibleMessages.length === 0 ? (
            <div className="content-empty">
              <Search size={22} aria-hidden="true" />
              <strong>Aucun souvenir trouvé</strong>
              <span>Modifiez la recherche ou le filtre.</span>
            </div>
          ) : null}
          {visibleMessages.map((message) => {
            const currentMonth = monthKey(message.timestamp)
            const showMonth = currentMonth !== previousMonth
            previousMonth = currentMonth
            const isExcluded = excluded.has(message.id)
            const isCover = Boolean(
              message.mediaName && message.mediaName === coverMediaName,
            )
            const isBackCover = Boolean(
              message.mediaName && message.mediaName === backCoverMediaName,
            )
            const hasPhotoOverride = adjustedPhotos.has(message.id)
            const hasCaptionOverride = adjustedCaptions.has(message.id)
            const hasPhotoAdjustment = hasPhotoOverride || hasCaptionOverride
            const association = videoByMessage.get(message.id)
            const videoConnected = connectedVideos.has(message.id)
            const videoFileName = association?.fileName ?? (
              isVideoMedia(message.mediaName) ? message.mediaName : null
            )
            const canAssociateVideo = ['message', 'media', 'missing-media'].includes(message.kind) &&
              (!message.mediaName || isVideoMedia(message.mediaName))
            const displaySender = message.sender
              ? participantNames.get(message.sender)?.trim() || message.sender
              : 'WhatsApp'

            return (
              <div className="content-timeline-entry" key={message.id}>
                {showMonth ? (
                  <h3>{monthFormatter.format(message.timestamp)}</h3>
                ) : null}
                <article className={`content-item${isExcluded ? ' is-excluded' : ''}`}>
                  <label className="content-include-toggle" title={isExcluded ? 'Inclure dans le livre' : 'Masquer du livre'}>
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      aria-label={`${isExcluded ? 'Inclure' : 'Masquer'} le message de ${displaySender}`}
                      onChange={() => onSetExcluded([message.id], !isExcluded)}
                    />
                    <span aria-hidden="true"><Check size={12} /></span>
                  </label>

                  <button
                    className="content-item-main"
                    type="button"
                    disabled={isExcluded || (message.kind === 'missing-media' && !showMissingMedia)}
                    onClick={() => onPreview(message.id)}
                  >
                    {message.mediaName ? (
                      <LazyThumbnail archive={archive} mediaName={message.mediaName} />
                    ) : null}
                    <span className="content-item-copy">
                      <span className="content-item-meta">
                        <strong>{displaySender}</strong>
                        <time>{dateFormatter.format(message.timestamp)}</time>
                        {hasPhotoOverride ? <em>{isVideoMedia(message.mediaName) ? 'Vidéo réglée' : 'Photo réglée'}</em> : null}
                        {hasCaptionOverride ? <em>Légende modifiée</em> : null}
                        {association ? <em>{videoConnected ? 'Vidéo associée' : 'Vidéo à reconnecter'}</em> : null}
                      </span>
                      <span className="content-item-body">
                        {message.body || (message.mediaName ? isVideoMedia(message.mediaName) ? 'Vidéo sans message' : 'Photo sans légende' : 'Message vide')}
                      </span>
                      {videoFileName ? (
                        <span className="video-association-filename" title={videoFileName}>{videoFileName}</span>
                      ) : view === 'missing' && message.kind === 'missing-media' ? (
                        <span className="video-association-filename">Nom du fichier non fourni par WhatsApp</span>
                      ) : null}
                    </span>
                  </button>

                  <div className="content-item-actions">
                    {canAssociateVideo && !videoConnected ? <button
                      type="button"
                      aria-label={`${association ? videoConnected ? 'Remplacer' : 'Reconnecter' : 'Associer'} une vidéo au message de ${displaySender}`}
                      title={association ? videoConnected ? 'Remplacer la vidéo associée' : 'Reconnecter la vidéo' : 'Associer une vidéo'}
                      onClick={() => onChooseVideo(message.id)}
                    ><Video size={16} /></button> : null}
                    {message.mediaName ? (
                      <>
                        <button
                          type="button"
                          className={hasPhotoAdjustment ? 'is-active' : ''}
                          disabled={isExcluded}
                          aria-label={isVideoMedia(message.mediaName) ? 'Régler la vidéo' : 'Régler la photo'}
                          title={isVideoMedia(message.mediaName) ? 'Régler la vidéo' : 'Régler la photo'}
                          aria-pressed={hasPhotoAdjustment}
                          onClick={() => onEditPhoto(message.id)}
                        >
                          <SlidersHorizontal size={16} />
                        </button>
                        <button
                          type="button"
                          className={isCover ? 'is-active' : ''}
                          aria-label={isCover ? 'Photo de couverture actuelle' : 'Utiliser comme couverture'}
                          title={isCover ? 'Photo de couverture actuelle' : 'Utiliser comme couverture'}
                          aria-pressed={isCover}
                          onClick={() => onSetCover(isCover ? null : message.mediaName)}
                        >
                          <BookImage size={16} />
                        </button>
                        <button
                          type="button"
                          className={isBackCover ? 'is-active' : ''}
                          aria-label={isBackCover
                            ? 'Photo de quatrième de couverture actuelle'
                            : 'Utiliser comme quatrième de couverture'}
                          title={isBackCover
                            ? 'Photo de quatrième de couverture actuelle'
                            : 'Utiliser comme quatrième de couverture'}
                          aria-pressed={isBackCover}
                          onClick={() => onSetBackCover(isBackCover ? null : message.mediaName)}
                        >
                          <BookCopy size={16} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              </div>
            )
          })}
        </div>

        <footer className="content-drawer-footer">
          <span>{excludedMessageIds.length.toLocaleString('fr-FR')} masqué{excludedMessageIds.length > 1 ? 's' : ''} · {photoOverrides.length} photo{photoOverrides.length > 1 ? 's' : ''} réglée{photoOverrides.length > 1 ? 's' : ''} · {captionOverrides.length} légende{captionOverrides.length > 1 ? 's' : ''} modifiée{captionOverrides.length > 1 ? 's' : ''}</span>
          {coverMediaName ? (
            <button type="button" onClick={() => onSetCover(null)}>
              Couverture automatique
            </button>
          ) : null}
          {backCoverMediaName ? (
            <button type="button" onClick={() => onSetBackCover(null)}>
              Quatrième automatique
            </button>
          ) : null}
        </footer>
      </aside>
    </>
  )
}