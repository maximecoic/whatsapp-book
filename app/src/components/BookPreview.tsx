import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Bookmark,
  BookOpen,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  ListTree,
  MessageCircleMore,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import type { ChatArchive } from '../lib/archive-reader'
import {
  findBackCoverMedia,
  findCoverMedia,
  getAlbumDayLayout,
  getBackCoverPhotoOverride,
  getCoverPhotoOverride,
  getDayLayoutWeight,
  getBookNavigationEntries,
  getBookmarkPageIndex,
  getMediaLayoutWeight,
  getPageDimensions,
  getPhotoOverride,
  getParticipantProfile,
  type BookSettings,
} from '../lib/book-model'
import type { ChatMessage } from '../lib/chat-types'
import {
  getBookStyleClassName,
  getBookStyleVariables,
  ensureReadableColor,
  type BookDateStyle,
} from '../lib/book-style'
import { MediaImage } from './MediaImage'
import { isDesignedComposition, layoutCompositionPage } from '../lib/book-composition'

const CSS_PIXELS_PER_MM = 96 / 25.4
const SPREAD_GAP_PX = 12

interface BookPreviewProps {
  archive: ChatArchive
  settings: BookSettings
  messages: ChatMessage[]
  pages: ChatMessage[][]
  pageIndex: number
  onPageChange(page: number): void
  selectedPhotoId?: string | null
  onSelectPhoto?(messageId: string): void
  selectedStructureId?: string | null
  onSelectStructure?(messageId: string): void
  selectedCoverMediaName?: string | null
  onSelectCoverPhoto?(mediaName: string): void
  selectedBackCoverMediaName?: string | null
  onSelectBackCoverPhoto?(mediaName: string): void
  onSetPageBookmark?(
    messageId: string,
    label: string | null,
    continuationPart?: number,
  ): void
}

const fullDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const compactDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const minimalDate = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

function formatBookDate(timestamp: number, style: BookDateStyle): string {
  if (style === 'compact') return compactDate.format(timestamp)
  if (style === 'minimal') return minimalDate.format(timestamp)
  return fullDate.format(timestamp)
}

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const time = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

function dateKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function MessageEntry({
  archive,
  message,
  alternate,
  albumWide,
  settings,
  selectedPhotoId,
  onSelectPhoto,
  selectedStructureId,
  onSelectStructure,
  showDate = false,
}: {
  archive: ChatArchive
  message: ChatMessage
  alternate: boolean
  albumWide: boolean
  settings: BookSettings
  selectedPhotoId?: string | null
  onSelectPhoto?(messageId: string): void
  selectedStructureId?: string | null
  onSelectStructure?(messageId: string): void
  showDate?: boolean
}) {
  const mediaAlt = `Photo partagée par ${message.sender ?? 'un participant'}`
  const sourceMessageId = message.sourceMessageId ?? message.id
  const photoOverride = getPhotoOverride(settings, sourceMessageId)
  const participantProfile = getParticipantProfile(settings, message.sender)
  const participantColor = settings.artDirection.participantPalette === 'accent'
    ? ensureReadableColor(settings.accent, settings.artDirection.paperColor)
    : settings.artDirection.participantPalette === 'neutral'
      ? settings.artDirection.inkColor
      : participantProfile
        ? ensureReadableColor(participantProfile.color, settings.artDirection.paperColor)
        : undefined
  const isSelected = selectedPhotoId === sourceMessageId
  const isStructureSelected = selectedStructureId === sourceMessageId
  const photoStyle = {
    objectFit: photoOverride.fit,
    objectPosition: `${photoOverride.focalX}% ${photoOverride.focalY}%`,
  } as CSSProperties
  const messageStyle = {
    ...(message.mediaName ? {
      '--media-layout-weight': getMediaLayoutWeight(message, photoOverride),
    } : {}),
    ...(participantColor ? {
      '--participant-color': participantColor,
    } : {}),
  } as CSSProperties

  return (
    <article
      className={`book-message kind-${message.kind}${alternate ? ' is-alternate' : ''}${albumWide ? ' is-album-wide' : ''} is-layout-${photoOverride.layout}${isStructureSelected ? ' is-structure-selected' : ''}${participantColor ? ' has-participant-color' : ''}`}
      data-source-message-id={sourceMessageId}
      style={messageStyle}
    >
      <div className="message-meta">
        {showDate ? (
          <time className="composition-meta-date" dateTime={new Date(message.timestamp).toISOString()}>
            {formatBookDate(message.timestamp, settings.artDirection.dateStyle)}
          </time>
        ) : null}
        <strong>{participantProfile?.displayName.trim() || message.sender || 'WhatsApp'}</strong>
        <time dateTime={new Date(message.timestamp).toISOString()}>
          {time.format(message.timestamp)}
        </time>
        {message.continuation ? (
          <span>
            suite {message.continuation.part}/{message.continuation.total}
          </span>
        ) : null}
        {onSelectStructure ? (
          <button
            type="button"
            className="message-structure-button"
            aria-label={`Régler chapitre et nouvelle page avant le message de ${message.sender ?? 'WhatsApp'}`}
            title="Chapitre et nouvelle page"
            aria-pressed={isStructureSelected}
            onClick={() => onSelectStructure(sourceMessageId)}
          >
            <BookMarked size={12} />
          </button>
        ) : null}
      </div>
      {message.mediaName ? (
        <figure className="message-photo">
          <div
            className={`photo-frame is-fit-${photoOverride.fit} is-rotation-${photoOverride.rotation}${onSelectPhoto ? ' is-editable' : ''}${isSelected ? ' is-selected' : ''}`}
            data-media-name={message.mediaName}
            data-message-id={sourceMessageId}
            data-media-context="content"
            data-photo-fit={photoOverride.fit}
            data-photo-rotation={photoOverride.rotation}
            role={onSelectPhoto ? 'button' : undefined}
            tabIndex={onSelectPhoto ? 0 : undefined}
            aria-label={onSelectPhoto ? `Régler la photo de ${message.sender ?? 'WhatsApp'}` : undefined}
            onClick={onSelectPhoto ? () => onSelectPhoto(sourceMessageId) : undefined}
            onKeyDown={onSelectPhoto ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onSelectPhoto(sourceMessageId)
            } : undefined}
          >
            <MediaImage
              archive={archive}
              name={message.mediaName}
              alt={mediaAlt}
              className={`photo-image is-rotation-${photoOverride.rotation}`}
              style={photoStyle}
            />
            {onSelectPhoto ? (
              <span className="photo-edit-affordance" aria-hidden="true">
                <SlidersHorizontal size={14} />
              </span>
            ) : null}
          </div>
          {message.body && photoOverride.showCaption ? (
            <figcaption>{message.body}</figcaption>
          ) : null}
        </figure>
      ) : (
        <div className="message-copy">
          {message.kind === 'missing-media' ? <ImageOff size={13} aria-hidden="true" /> : null}
          {message.kind === 'deleted' ? <Trash2 size={13} aria-hidden="true" /> : null}
          {message.kind === 'system' ? <MessageCircleMore size={13} aria-hidden="true" /> : null}
          <p>{message.body}</p>
        </div>
      )}
    </article>
  )
}

export function BookContentPage({
  archive,
  messages,
  settings,
  selectedPhotoId,
  onSelectPhoto,
  selectedStructureId,
  onSelectStructure,
  onNavigateToPage,
}: {
  archive: ChatArchive
  messages: ChatMessage[]
  settings: BookSettings
  selectedPhotoId?: string | null
  onSelectPhoto?(messageId: string): void
  selectedStructureId?: string | null
  onSelectStructure?(messageId: string): void
  onNavigateToPage?(page: number): void
}) {
  const editorial = messages[0]?.editorial
  if (editorial) {
    if (editorial.kind === 'blank') {
      return <div className="book-editorial-page is-blank" aria-label="Page blanche" />
    }
    return (
      <div className={`book-editorial-page is-${editorial.kind}`}>
        {editorial.kind === 'table-of-contents' ? (
          <>
            <span className="book-editorial-kicker">Dans ce livre</span>
            <h2>{editorial.title}</h2>
            <ol className="book-table-of-contents">
              {editorial.entries?.map((entry) => (
                <li className={`is-${entry.type}`} key={entry.id}>
                  {onNavigateToPage ? (
                    <button type="button" onClick={() => onNavigateToPage(entry.page)}>
                      <span>{entry.label}</span>
                      <i aria-hidden="true" />
                      <strong>{entry.page}</strong>
                    </button>
                  ) : (
                    <div>
                      <span>{entry.label}</span>
                      <i aria-hidden="true" />
                      <strong>{entry.page}</strong>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <span className="book-editorial-kicker">
              {editorial.kind === 'dedication'
                ? 'Dédicace'
                : editorial.kind === 'introduction'
                  ? 'Avant-propos'
                  : editorial.kind === 'epilogue'
                    ? 'Épilogue'
                    : 'Interlude'}
            </span>
            <h2>{editorial.title}</h2>
            <div className="book-editorial-copy">
              <p>{messages[0].body}</p>
            </div>
            {messages[0].continuation ? (
              <span className="book-editorial-continuation">
                {messages[0].continuation.part}/{messages[0].continuation.total}
              </span>
            ) : null}
          </>
        )}
      </div>
    )
  }

  const participants = archive.chat.participants
  if (isDesignedComposition(settings.theme)) {
    const layout = layoutCompositionPage(messages, {
      theme: settings.theme,
      ...getPageDimensions(settings.format, settings.orientation),
      fontScale: settings.fontScale,
      lineHeight: settings.artDirection.lineHeight,
      photoOverrides: settings.photoOverrides,
      photoAspectRatios: settings.photoAspectRatios,
    })
    return (
      <div
        className={`composed-page composition-${settings.theme}${layout.fullPagePhoto ? ' has-full-page-photo' : ''}`}
        style={{
          '--composition-margin': `${layout.marginMm}mm`,
          '--composition-header': `${layout.headerMm}mm`,
          '--composition-header-gap': `${layout.headerGapMm}mm`,
          '--composition-font-size': `${layout.fontPt}pt`,
          '--composition-tile-padding': `${layout.tilePaddingMm}mm`,
        } as CSSProperties}
      >
        {layout.headerMm > 0 ? (
          <header className="composition-heading">
            <span>{messages[0]?.chapterTitle ? 'Chapitre' : settings.subtitle}</span>
            <h2>{messages[0]?.chapterTitle || settings.title}</h2>
          </header>
        ) : null}
        <div className="composition-body">
          {layout.items.map((item) => (
            <section
              key={item.message.id}
              className={`composition-item${item.message.mediaName ? ' has-photo' : ' is-note'}`}
              style={{
                left: `${item.xMm}mm`,
                top: `${item.yMm}mm`,
                width: `${item.widthMm}mm`,
                height: `${item.heightMm}mm`,
                '--composition-photo-height': `${item.photoHeightMm}mm`,
                transform: `rotate(${item.rotation}deg)`,
              } as CSSProperties}
            >
              {settings.theme === 'photo-story' && !layout.fullPagePhoto ? (
                <time className="composition-date-rail" dateTime={new Date(item.message.timestamp).toISOString()}>
                  <strong>{new Date(item.message.timestamp).getDate().toString().padStart(2, '0')}</strong>
                  <span>{new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(item.message.timestamp)}</span>
                </time>
              ) : null}
              {settings.theme !== 'collage' ? (
                <div className="composition-date">
                  {formatBookDate(item.message.timestamp, settings.artDirection.dateStyle)}
                </div>
              ) : null}
              <MessageEntry
                archive={archive}
                message={item.message}
                alternate={item.message.sender ? participants.indexOf(item.message.sender) % 2 === 1 : false}
                albumWide={false}
                settings={settings}
                selectedPhotoId={selectedPhotoId}
                onSelectPhoto={onSelectPhoto}
                selectedStructureId={selectedStructureId}
                onSelectStructure={onSelectStructure}
                showDate={settings.theme === 'collage'}
              />
            </section>
          ))}
        </div>
      </div>
    )
  }
  const isFullPagePhoto = Boolean(
    messages.length === 1 &&
    messages[0].mediaName &&
    getPhotoOverride(
      settings,
      messages[0].sourceMessageId ?? messages[0].id,
    ).layout === 'full-page',
  )
  const dayGroups = messages.reduce<Array<{
    key: string
    timestamp: number
    messages: ChatMessage[]
  }>>((groups, message) => {
    const key = dateKey(message.timestamp)
    const currentGroup = groups.at(-1)
    if (currentGroup?.key === key) {
      currentGroup.messages.push(message)
    } else {
      groups.push({ key, timestamp: message.timestamp, messages: [message] })
    }
    return groups
  }, [])

  return (
    <div className={`book-page-content${isFullPagePhoto ? ' is-full-page-photo' : ''}`}>
      {messages[0]?.chapterTitle ? (
        <header className="book-chapter">
          <span>Chapitre</span>
          <h2>{messages[0].chapterTitle}</h2>
        </header>
      ) : null}
      {messages.length === 0 ? (
        <div className="empty-book-page">
          <MessageCircleMore size={26} aria-hidden="true" />
          <strong>Aucun message dans cette sélection</strong>
        </div>
      ) : null}
      {dayGroups.map((group) => {
        const mediaCount = group.messages.filter((message) => message.mediaName).length
        const albumLayout = getAlbumDayLayout(
          group.messages,
          settings.photoOverrides,
        )
        const albumWideMessages = new Set(albumLayout.wideMessageIds)
        const hasManualHalf = group.messages.some((message) => (
          message.mediaName &&
          getPhotoOverride(
            settings,
            message.sourceMessageId ?? message.id,
          ).layout === 'half'
        ))
        const groupStyle = {
          '--album-row-template': albumLayout.rowTemplate,
          '--day-layout-weight': getDayLayoutWeight(
            group.messages,
            settings.theme,
            settings.photoOverrides,
          ),
        } as CSSProperties

        return (
          <section
            className={`book-day${mediaCount ? ' has-media' : ''}`}
            style={groupStyle}
            key={group.key}
          >
            <h3 className="book-date">
              {formatBookDate(group.timestamp, settings.artDirection.dateStyle)}
            </h3>
            <div
              className={`book-day-messages${mediaCount === 1 ? ' has-single-media' : ''}${hasManualHalf ? ' has-manual-photo-grid' : ''}`}
            >
              {group.messages.map((message) => {
                const alternate = message.sender
                  ? participants.indexOf(message.sender) % 2 === 1
                  : false
                return (
                  <MessageEntry
                    archive={archive}
                    message={message}
                    alternate={alternate}
                    albumWide={albumWideMessages.has(message.id)}
                    settings={settings}
                    selectedPhotoId={selectedPhotoId}
                    onSelectPhoto={onSelectPhoto}
                    selectedStructureId={selectedStructureId}
                    onSelectStructure={onSelectStructure}
                    key={message.id}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function BookCover({
  archive,
  settings,
  messages,
  selectedMediaName,
  onSelectPhoto,
}: {
  archive: ChatArchive
  settings: BookSettings
  messages: ChatMessage[]
  selectedMediaName?: string | null
  onSelectPhoto?(mediaName: string): void
}) {
  const coverMedia = findCoverMedia(messages, settings.coverMediaName)
  const showsCoverMedia = settings.artDirection.coverLayout !== 'typographic'
  const coverOverride = coverMedia
    ? getCoverPhotoOverride(settings, coverMedia)
    : null
  const coverMessageId = coverMedia
    ? archive.chat.messages.find((message) => message.mediaName === coverMedia)?.id
    : undefined
  const isSelected = Boolean(coverMedia && selectedMediaName === coverMedia)
  const coverStyle = coverOverride ? {
    objectFit: coverOverride.fit,
    objectPosition: `${coverOverride.focalX}% ${coverOverride.focalY}%`,
  } as CSSProperties : undefined
  const dateRange = messages.length
    ? `${shortDate.format(messages[0].timestamp)} — ${shortDate.format(messages.at(-1)!.timestamp)}`
    : 'Sélection vide'

  return (
    <div className="cover-layout">
      <div
        className={`cover-image${onSelectPhoto && coverMedia ? ' is-editable' : ''}${isSelected ? ' is-selected' : ''}`}
        data-media-name={showsCoverMedia ? coverMedia ?? undefined : undefined}
        data-media-context={showsCoverMedia && coverMedia ? 'cover' : undefined}
        data-message-id={showsCoverMedia ? coverMessageId : undefined}
        data-photo-fit={showsCoverMedia ? coverOverride?.fit : undefined}
        data-photo-rotation={showsCoverMedia ? coverOverride?.rotation : undefined}
        role={showsCoverMedia && onSelectPhoto && coverMedia ? 'button' : undefined}
        tabIndex={showsCoverMedia && onSelectPhoto && coverMedia ? 0 : undefined}
        aria-label={showsCoverMedia && onSelectPhoto && coverMedia ? 'Régler la photo de couverture' : undefined}
        aria-pressed={showsCoverMedia && onSelectPhoto && coverMedia ? isSelected : undefined}
        onClick={showsCoverMedia && onSelectPhoto && coverMedia ? () => onSelectPhoto(coverMedia) : undefined}
        onKeyDown={showsCoverMedia && onSelectPhoto && coverMedia ? (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onSelectPhoto(coverMedia)
        } : undefined}
      >
        {showsCoverMedia && coverMedia && coverOverride ? (
          <MediaImage
            archive={archive}
            name={coverMedia}
            alt="Photo de couverture"
            className={`cover-photo-image is-rotation-${coverOverride.rotation}`}
            style={coverStyle}
          />
        ) : (
          <div className="media-fallback"><ImageOff size={28} /></div>
        )}
        {showsCoverMedia && onSelectPhoto && coverMedia ? (
          <span className="photo-edit-affordance" aria-hidden="true">
            <SlidersHorizontal size={14} />
          </span>
        ) : null}
      </div>
      <div className="cover-copy">
        <span>Une histoire en messages</span>
        <h2>{settings.title || 'Sans titre'}</h2>
        <p>{settings.subtitle}</p>
        <time>{dateRange}</time>
      </div>
    </div>
  )
}

export function BookBackCover({
  archive,
  settings,
  messages,
  selectedMediaName,
  onSelectPhoto,
}: {
  archive: ChatArchive
  settings: BookSettings
  messages: ChatMessage[]
  selectedMediaName?: string | null
  onSelectPhoto?(mediaName: string): void
}) {
  const mediaName = findBackCoverMedia(messages, settings.backCover.mediaName)
  const showsPhoto = settings.backCover.layout === 'photo'
  const override = mediaName
    ? getBackCoverPhotoOverride(settings, mediaName)
    : null
  const messageId = mediaName
    ? archive.chat.messages.find((message) => message.mediaName === mediaName)?.id
    : undefined
  const isSelected = Boolean(mediaName && selectedMediaName === mediaName)
  const photoStyle = override ? {
    objectFit: override.fit,
    objectPosition: `${override.focalX}% ${override.focalY}%`,
  } as CSSProperties : undefined

  return (
    <div className={`back-cover-layout is-${settings.backCover.layout} back-cover-title-${settings.backCover.textPosition}`}>
      {showsPhoto ? (
        <div
          className={`cover-image back-cover-image${onSelectPhoto && mediaName ? ' is-editable' : ''}${isSelected ? ' is-selected' : ''}`}
          data-media-name={mediaName ?? undefined}
          data-media-context={mediaName ? 'back-cover' : undefined}
          data-message-id={messageId}
          data-photo-fit={override?.fit}
          data-photo-rotation={override?.rotation}
          role={onSelectPhoto && mediaName ? 'button' : undefined}
          tabIndex={onSelectPhoto && mediaName ? 0 : undefined}
          aria-label={onSelectPhoto && mediaName ? 'Régler la photo de quatrième de couverture' : undefined}
          aria-pressed={onSelectPhoto && mediaName ? isSelected : undefined}
          onClick={onSelectPhoto && mediaName ? () => onSelectPhoto(mediaName) : undefined}
          onKeyDown={onSelectPhoto && mediaName ? (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onSelectPhoto(mediaName)
          } : undefined}
        >
          {mediaName && override ? (
            <MediaImage
              archive={archive}
              name={mediaName}
              alt="Photo de quatrième de couverture"
              className={`cover-photo-image is-rotation-${override.rotation}`}
              style={photoStyle}
            />
          ) : (
            <div className="media-fallback"><ImageOff size={28} /></div>
          )}
          {onSelectPhoto && mediaName ? (
            <span className="photo-edit-affordance" aria-hidden="true">
              <SlidersHorizontal size={14} />
            </span>
          ) : null}
        </div>
      ) : null}
      {showsPhoto ? (
        <span
          className="back-cover-scrim"
          style={{ opacity: settings.backCover.overlay / 100 }}
          aria-hidden="true"
        />
      ) : null}
      <div className="back-cover-copy">
        {settings.backCover.text ? <p>{settings.backCover.text}</p> : null}
      </div>
    </div>
  )
}

function PageBookmarkControl({
  pages,
  settings,
  pageIndex,
  onSetPageBookmark,
  inToolbar = false,
}: {
  pages: ChatMessage[][]
  settings: BookSettings
  pageIndex: number
  onSetPageBookmark: NonNullable<BookPreviewProps['onSetPageBookmark']>
  inToolbar?: boolean
}) {
  const pageMessages = pages[pageIndex - 1] ?? []
  const bookmarkTarget = pageMessages.find((message) => (
    !message.editorial && (!message.continuation || message.continuation.part === 1)
  )) ?? pageMessages.find((message) => !message.editorial)
  if (!bookmarkTarget) return null
  const bookmarkTargetId = bookmarkTarget.sourceMessageId ?? bookmarkTarget.id
  const bookmarkTargetPart = (bookmarkTarget.continuation?.part ?? 1) > 1
    ? bookmarkTarget.continuation!.part
    : undefined
  const pageBookmark = settings.bookmarks.find((bookmark) => (
    getBookmarkPageIndex(pages, bookmark) === pageIndex - 1
  ))
  const bookmarkLabel = pageMessages[0]?.chapterTitle ||
    `Souvenir du ${shortDate.format(bookmarkTarget.timestamp)}`
  return (
    <button
      type="button"
      className={`page-bookmark-button${inToolbar ? ' is-in-toolbar' : ''}${pageBookmark ? ' is-active' : ''}`}
      data-bookmark-message-id={pageBookmark?.messageId ?? bookmarkTargetId}
      data-bookmark-continuation-part={pageBookmark?.continuationPart ?? bookmarkTargetPart}
      aria-label={pageBookmark ? `Retirer le signet de la page ${pageIndex}` : `Signaler la page ${pageIndex}`}
      title={pageBookmark ? `Retirer le signet de la page ${pageIndex}` : `Signaler la page ${pageIndex}`}
      aria-pressed={Boolean(pageBookmark)}
      onClick={() => onSetPageBookmark(
        pageBookmark?.messageId ?? bookmarkTargetId,
        pageBookmark ? null : bookmarkLabel,
        pageBookmark?.continuationPart ?? bookmarkTargetPart,
      )}
    >
      <Bookmark size={15} fill="currentColor" />
    </button>
  )
}

function PreviewPageView({
  archive,
  settings,
  messages,
  pages,
  pageIndex,
  pageStyle,
  pageShellStyle,
  selectedPhotoId,
  onSelectPhoto,
  selectedStructureId,
  onSelectStructure,
  selectedCoverMediaName,
  onSelectCoverPhoto,
  selectedBackCoverMediaName,
  onSelectBackCoverPhoto,
  onNavigateToPage,
  onSetPageBookmark,
}: BookPreviewProps & {
  pageStyle: CSSProperties
  pageShellStyle: CSSProperties
  onNavigateToPage(page: number): void
}) {
  const isBackCover = settings.backCover.enabled && pageIndex === pages.length + 1
  const pageMessages = pageIndex > 0 && pageIndex <= pages.length
    ? pages[pageIndex - 1] ?? []
    : []
  return (
    <div className="page-scale-shell" style={pageShellStyle}>
      <div
        className={`preview-page theme-${settings.theme} orientation-${settings.orientation} ${getBookStyleClassName(settings.artDirection)}${pageIndex === 0 ? ' is-cover' : ''}${isBackCover ? ' is-back-cover' : ''}${pageIndex > 0 && pageIndex % 2 === 0 ? ' is-even-page' : ''}`}
        data-preview-page-index={pageIndex}
        style={pageStyle}
      >
        {pageIndex === 0 ? (
          <BookCover
            archive={archive}
            settings={settings}
            messages={messages}
            selectedMediaName={selectedCoverMediaName}
            onSelectPhoto={onSelectCoverPhoto}
          />
        ) : isBackCover ? (
          <BookBackCover
            archive={archive}
            settings={settings}
            messages={messages}
            selectedMediaName={selectedBackCoverMediaName}
            onSelectPhoto={onSelectBackCoverPhoto}
          />
        ) : (
          <>
            <BookContentPage
              archive={archive}
              messages={pageMessages}
              settings={settings}
              selectedPhotoId={selectedPhotoId}
              onSelectPhoto={onSelectPhoto}
              selectedStructureId={selectedStructureId}
              onSelectStructure={onSelectStructure}
              onNavigateToPage={onNavigateToPage}
            />
            {pageMessages[0]?.editorial?.kind !== 'blank' ? (
              <span className="book-page-number">{pageIndex}</span>
            ) : null}
            {onSetPageBookmark && settings.theme !== 'collage' ? (
              <PageBookmarkControl
                pages={pages}
                settings={settings}
                pageIndex={pageIndex}
                onSetPageBookmark={onSetPageBookmark}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export function BookPreview({
  archive,
  settings,
  messages,
  pages,
  pageIndex,
  onPageChange,
  selectedPhotoId,
  onSelectPhoto,
  selectedStructureId,
  onSelectStructure,
  selectedCoverMediaName,
  onSelectCoverPhoto,
  selectedBackCoverMediaName,
  onSelectBackCoverPhoto,
  onSetPageBookmark,
}: BookPreviewProps) {
  const dimensions = getPageDimensions(settings.format, settings.orientation)
  const backCoverIndex = settings.backCover.enabled ? pages.length + 1 : null
  const pageCount = pages.length + 1 + (settings.backCover.enabled ? 1 : 0)
  const navigationEntries = getBookNavigationEntries(pages, settings)
  const stageRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const [spreadView, setSpreadView] = useState(false)
  const [stageSupportsSpread, setStageSupportsSpread] = useState(false)
  const pageWidthPx = dimensions.widthMm * CSS_PIXELS_PER_MM
  const pageHeightPx = dimensions.heightMm * CSS_PIXELS_PER_MM
  const activeSpread = spreadView && stageSupportsSpread && pageCount > 2
  const spreadStart = pageIndex <= 1
    ? pageIndex
    : pageIndex % 2 === 0
      ? pageIndex
      : pageIndex - 1
  const visiblePageSlots: Array<number | null> = !activeSpread || pageIndex === 0
    ? [pageIndex]
    : pageIndex === 1
      ? [null, 1]
      : [
          spreadStart,
          spreadStart + 1 < pageCount ? spreadStart + 1 : null,
        ]
  const visiblePageIndices = visiblePageSlots.filter((index): index is number => (
    index !== null
  ))
  const spreadTargets = [
    0,
    ...(pageCount > 1 ? [1] : []),
    ...Array.from(
      { length: Math.max(0, Math.ceil((pageCount - 2) / 2)) },
      (_, index) => index * 2 + 2,
    ),
  ]
  const activeSpreadTarget = pageIndex <= 1 ? pageIndex : spreadStart
  const sliderValue = activeSpread
    ? Math.max(0, spreadTargets.indexOf(activeSpreadTarget))
    : pageIndex
  const sliderMaximum = activeSpread
    ? Math.max(0, spreadTargets.length - 1)
    : Math.max(0, pageCount - 1)
  const previousTarget = activeSpread
    ? pageIndex === 0
      ? null
      : pageIndex === 1
        ? 0
        : spreadStart === 2
          ? 1
          : Math.max(1, spreadStart - 2)
    : pageIndex > 0
      ? pageIndex - 1
      : null
  const nextTarget = activeSpread
    ? pageIndex === 0
      ? pageCount > 1 ? 1 : null
      : pageIndex === 1
        ? pageCount > 2 ? 2 : null
        : spreadStart + 2 < pageCount ? spreadStart + 2 : null
    : pageIndex < pageCount - 1
      ? pageIndex + 1
      : null

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const updateScale = () => {
      const supportsSpread = stage.clientWidth >= 720
      setStageSupportsSpread(supportsSpread)
      const pageSlots = spreadView && supportsSpread && pageCount > 2 && pageIndex > 0
        ? 2
        : 1
      const availableWidth = Math.max(
        1,
        stage.clientWidth - (pageSlots - 1) * SPREAD_GAP_PX,
      )
      const nextScale = Math.min(
        availableWidth / (pageWidthPx * pageSlots),
        stage.clientHeight / pageHeightPx,
        1,
      )
      setPreviewScale(Math.max(0.1, nextScale))
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [pageCount, pageHeightPx, pageIndex, pageWidthPx, spreadView])

  const pageStyle = {
    '--book-accent': settings.accent,
    '--book-font-scale': settings.fontScale,
    '--preview-inverse-scale': 1 / previewScale,
    ...getBookStyleVariables(settings.artDirection, settings.accent, dimensions),
    width: `${dimensions.widthMm}mm`,
    height: `${dimensions.heightMm}mm`,
    transform: `scale(${previewScale})`,
  } as CSSProperties
  const pageShellStyle = {
    width: `${pageWidthPx * previewScale}px`,
    height: `${pageHeightPx * previewScale}px`,
  } as CSSProperties

  return (
    <section className={`preview-workspace${activeSpread ? ' is-spread-view' : ''}`} aria-label="Aperçu du livre">
      <div className="preview-meta">
        <span>
          {dimensions.label} · {settings.orientation === 'portrait' ? 'Portrait' : 'Paysage'}
        </span>
        <span>{dimensions.widthMm} × {dimensions.heightMm} mm</span>
        <button
          type="button"
          className="preview-spread-toggle"
          aria-label={activeSpread ? 'Afficher une page' : 'Afficher deux pages'}
          title={activeSpread ? 'Vue une page' : 'Vue livre ouvert'}
          aria-pressed={activeSpread}
          disabled={!stageSupportsSpread || pageCount <= 2}
          onClick={() => setSpreadView((current) => !current)}
        >
          <BookOpen size={15} aria-hidden="true" />
        </button>
        {settings.theme === 'collage' && onSetPageBookmark ? visiblePageIndices.map((visiblePageIndex) => (
          <PageBookmarkControl
            key={visiblePageIndex}
            pages={pages}
            settings={settings}
            pageIndex={visiblePageIndex}
            onSetPageBookmark={onSetPageBookmark}
            inToolbar
          />
        )) : null}
        {navigationEntries.length > 1 ? (
          <label className="book-navigation-select">
            <ListTree size={14} aria-hidden="true" />
            <span className="sr-only">Naviguer dans le livre</span>
            <select
              aria-label="Naviguer dans le livre"
              value={navigationEntries.some(({ pageIndex: entryPage }) => (
                entryPage === pageIndex
              )) ? pageIndex : ''}
              onChange={(event) => onPageChange(Number(event.target.value))}
            >
              <option value="" disabled>Aller à…</option>
              {navigationEntries.map((entry) => (
                <option value={entry.pageIndex} key={entry.id}>{entry.label}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="page-stage" ref={stageRef}>
        <div className={`page-spread${activeSpread ? ' is-active' : ''}`}>
          {visiblePageSlots.map((visiblePageIndex, slotIndex) => (
            visiblePageIndex === null ? (
              <div
                className="page-scale-shell is-blank-page"
                style={pageShellStyle}
                aria-hidden="true"
                key={`blank-${slotIndex}`}
              />
            ) : (
              <PreviewPageView
                archive={archive}
                settings={settings}
                messages={messages}
                pages={pages}
                pageIndex={visiblePageIndex}
                onPageChange={onPageChange}
                selectedPhotoId={selectedPhotoId}
                onSelectPhoto={onSelectPhoto}
                selectedStructureId={selectedStructureId}
                onSelectStructure={onSelectStructure}
                selectedCoverMediaName={selectedCoverMediaName}
                onSelectCoverPhoto={onSelectCoverPhoto}
                selectedBackCoverMediaName={selectedBackCoverMediaName}
                onSelectBackCoverPhoto={onSelectBackCoverPhoto}
                onSetPageBookmark={onSetPageBookmark}
                onNavigateToPage={onPageChange}
                pageStyle={pageStyle}
                pageShellStyle={pageShellStyle}
                key={visiblePageIndex}
              />
            )
          ))}
        </div>
      </div>

      <nav className="page-navigation" aria-label="Navigation entre les pages">
        <button
          type="button"
          className="icon-button"
          aria-label="Page précédente"
          title="Page précédente"
          disabled={previousTarget === null}
          onClick={() => previousTarget !== null && onPageChange(previousTarget)}
        >
          <ChevronLeft size={18} />
        </button>
        <label className="page-slider">
          <span className="sr-only">Parcourir les pages</span>
          <input
            type="range"
            min="0"
            max={sliderMaximum}
            step="1"
            value={sliderValue}
            aria-label="Parcourir les pages"
            aria-valuetext={pageIndex === 0
              ? 'Couverture'
              : pageIndex === backCoverIndex
                ? 'Quatrième de couverture'
              : visiblePageIndices.length > 1
                ? `Pages ${visiblePageIndices[0]} à ${visiblePageIndices.at(-1)!} sur ${pages.length}`
                : `Page ${visiblePageIndices[0]} sur ${pages.length}`}
            onChange={(event) => {
              const value = Number(event.target.value)
              onPageChange(activeSpread ? spreadTargets[value] : value)
            }}
          />
        </label>
        <span className="page-navigation-status">
          {pageIndex === 0 ? (
            <strong>Couverture</strong>
          ) : pageIndex === backCoverIndex ? (
            <strong>Quatrième de couverture</strong>
          ) : (
            <>
              {visiblePageIndices.length > 1 ? 'Pages' : 'Page'}{' '}
              <strong>{visiblePageIndices[0]}</strong>
              {visiblePageIndices.length > 1 ? (
                <>–<strong>{visiblePageIndices.at(-1)!}</strong></>
              ) : null}{' '}
              sur {pages.length.toLocaleString('fr-FR')}
            </>
          )}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Page suivante"
          title="Page suivante"
          disabled={nextTarget === null}
          onClick={() => nextTarget !== null && onPageChange(nextTarget)}
        >
          <ChevronRight size={18} />
        </button>
      </nav>
    </section>
  )
}