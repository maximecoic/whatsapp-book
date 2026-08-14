import {
  Bookmark,
  BookMarked,
  BookOpenText,
  Check,
  FilePenLine,
  FilePlus2,
  ListTree,
  LocateFixed,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRoundPen,
  X,
} from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import type {
  BookBookmark,
  BookChapter,
  EditorialPage,
  EditorialPageKind,
  ParticipantProfile,
} from '../lib/book-model'
import type { ChatMessage } from '../lib/chat-types'
import { ChapterBreakControls } from './StructureInspector'
import { useResponsiveWorkspacePanel } from './useResponsiveWorkspacePanel'

interface EditorialPanelProps {
  messages: ChatMessage[]
  participants: string[]
  allParticipants: string[]
  participantProfiles: ParticipantProfile[]
  editorialPages: EditorialPage[]
  showTableOfContents: boolean
  bookmarks: BookBookmark[]
  chapters: BookChapter[]
  pageBreakBeforeIds: string[]
  visibleMessageIds: string[]
  initialPageAnchorId?: string | null
  onClose(): void
  onSetTableOfContents(enabled: boolean): void
  onSavePage(page: EditorialPage): void
  onDeletePage(pageId: string): void
  onPreviewPage(pageId: string): void
  onSetParticipantProfile(participant: string, displayName: string, color: string): void
  onResetParticipantProfile(participant: string): void
  onSetBookmark(messageId: string, label: string | null, continuationPart?: number): void
  onSetChapter(messageId: string, title: string | null): void
  onSetPageBreak(messageId: string, enabled: boolean): void
  onPreviewMessage(messageId: string, continuationPart?: number): void
  onInitialPageHandled?(): void
}

const PROFILE_COLORS = ['#176b67', '#315fa7', '#9d4561', '#d0912f', '#6f5c99']

const PAGE_KIND_META: Record<EditorialPageKind, { label: string; defaultTitle: string }> = {
  dedication: { label: 'Dédicace', defaultTitle: 'À celles et ceux qui partagent cette histoire' },
  introduction: { label: 'Introduction', defaultTitle: 'Avant-propos' },
  text: { label: 'Texte libre', defaultTitle: 'Interlude' },
  epilogue: { label: 'Épilogue', defaultTitle: 'Et après…' },
  blank: { label: 'Page blanche', defaultTitle: '' },
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function createPageId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createPage(kind: EditorialPageKind): EditorialPage {
  return {
    id: createPageId(),
    kind,
    title: PAGE_KIND_META[kind].defaultTitle,
    body: '',
    anchorMessageId: null,
  }
}

function messageLabel(message: ChatMessage): string {
  const excerpt = message.body.replaceAll('\n', ' ').trim().slice(0, 54)
  return `${dateFormatter.format(message.timestamp)} · ${message.sender ?? 'WhatsApp'}${excerpt ? ` · ${excerpt}` : ''}`
}

export function EditorialPanel({
  messages,
  participants,
  allParticipants,
  participantProfiles,
  editorialPages,
  showTableOfContents,
  bookmarks,
  chapters,
  pageBreakBeforeIds,
  visibleMessageIds,
  initialPageAnchorId,
  onClose,
  onSetTableOfContents,
  onSavePage,
  onDeletePage,
  onPreviewPage,
  onSetParticipantProfile,
  onResetParticipantProfile,
  onSetBookmark,
  onSetChapter,
  onSetPageBreak,
  onPreviewMessage,
  onInitialPageHandled,
}: EditorialPanelProps) {
  const { isDocked, panelRef } = useResponsiveWorkspacePanel(
    onClose,
    '.editorial-panel-button',
  )
  const [pageDraft, setPageDraft] = useState<EditorialPage | null>(null)
  const [structureQuery, setStructureQuery] = useState('')
  const [structureTargetId, setStructureTargetId] = useState<string | null>(null)
  const deferredStructureQuery = useDeferredValue(structureQuery)
  const visibleMessages = new Set(visibleMessageIds)
  const messagesById = new Map(messages.map((message) => [message.id, message]))
  const chaptersByMessage = new Map(
    chapters.map((chapter) => [chapter.messageId, chapter.title]),
  )
  const pageBreaks = new Set(pageBreakBeforeIds)
  const structureIds = Array.from(new Set([
    ...chapters.map((chapter) => chapter.messageId),
    ...pageBreakBeforeIds,
  ])).sort((firstId, secondId) => (
    (messagesById.get(firstId)?.timestamp ?? Number.POSITIVE_INFINITY) -
    (messagesById.get(secondId)?.timestamp ?? Number.POSITIVE_INFINITY)
  ))
  const normalizedStructureQuery = deferredStructureQuery.trim().toLocaleLowerCase('fr-FR')
  const structureRows = normalizedStructureQuery
    ? messages.filter((message) => (
      `${message.sender ?? 'WhatsApp'} ${message.body} ${dateFormatter.format(message.timestamp)}`
        .toLocaleLowerCase('fr-FR')
        .includes(normalizedStructureQuery)
    )).slice(0, 40).map((message) => message.id)
    : structureIds
  const structureTarget = structureTargetId
    ? messagesById.get(structureTargetId) ?? null
    : null
  const visibleProfileCount = participantProfiles.filter((profile) => (
    participants.includes(profile.participant)
  )).length

  useEffect(() => {
    if (!initialPageAnchorId) return
    setPageDraft({
      ...createPage('text'),
      anchorMessageId: initialPageAnchorId,
    })
    onInitialPageHandled?.()
  }, [initialPageAnchorId, onInitialPageHandled])

  const savePage = () => {
    if (!pageDraft) return
    const title = pageDraft.title.trim().slice(0, 100)
    const body = pageDraft.body.slice(0, 12_000)
    if (pageDraft.kind !== 'blank' && !title && !body.trim()) return
    onSavePage({
      ...pageDraft,
      title: pageDraft.kind === 'blank' ? '' : title,
      body: pageDraft.kind === 'blank' ? '' : body,
      anchorMessageId: pageDraft.kind === 'text' || pageDraft.kind === 'blank'
        ? pageDraft.anchorMessageId
        : null,
    })
    setPageDraft(null)
  }

  return (
    <>
      {!isDocked ? (
        <button
          className="content-drawer-backdrop"
          type="button"
          aria-label="Fermer l’édition du livre"
          tabIndex={-1}
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={panelRef}
        className={`content-drawer editorial-drawer${isDocked ? ' is-docked' : ''}`}
        role={isDocked ? 'complementary' : 'dialog'}
        aria-modal={isDocked ? undefined : true}
        aria-labelledby="editorial-drawer-title"
      >
        <header className="content-drawer-header">
          <div>
            <span className="eyebrow">Organisation du livre</span>
            <h2 id="editorial-drawer-title">Organiser</h2>
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

        <div className="editorial-panel-content">
          <section className="editorial-section">
            <div className="editorial-section-heading">
              <ListTree size={16} aria-hidden="true" />
              <div><h3>Sommaire</h3><p>Chapitres, textes et pages signalées.</p></div>
            </div>
            <label className="photo-caption-toggle editorial-toggle">
              <span>Générer automatiquement</span>
              <input
                type="checkbox"
                checked={showTableOfContents}
                onChange={(event) => onSetTableOfContents(event.target.checked)}
              />
              <span className="toggle-track" aria-hidden="true"><span /></span>
            </label>
          </section>

          <section className="editorial-section editorial-structure-section">
            <div className="editorial-section-heading">
              <BookMarked size={16} aria-hidden="true" />
              <div>
                <h3>Chapitres et nouvelles pages</h3>
                <p>Choisissez le message qui ouvrira la section.</p>
              </div>
            </div>

            <label className="content-search editorial-structure-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={structureQuery}
                placeholder="Rechercher un message…"
                aria-label="Rechercher un message à organiser"
                onChange={(event) => setStructureQuery(event.target.value)}
              />
              {structureQuery ? (
                <button
                  type="button"
                  aria-label="Effacer la recherche de structure"
                  title="Effacer"
                  onClick={() => setStructureQuery('')}
                >
                  <X size={13} />
                </button>
              ) : null}
            </label>

            {structureTargetId ? (
              <div className="editorial-structure-editor">
                <div className="editorial-structure-target">
                  <span>
                    <small>{structureTarget ? messageLabel(structureTarget) : 'Message hors sélection'}</small>
                    <strong>{chaptersByMessage.get(structureTargetId) ?? 'Point de structure'}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={!structureTarget || !visibleMessages.has(structureTargetId)}
                    aria-label="Voir ce message dans le livre"
                    title={visibleMessages.has(structureTargetId) ? 'Voir dans le livre' : 'Message hors sélection'}
                    onClick={() => onPreviewMessage(structureTargetId)}
                  >
                    <LocateFixed size={14} />
                  </button>
                </div>
                <ChapterBreakControls
                  messageId={structureTargetId}
                  chapterTitle={chaptersByMessage.get(structureTargetId) ?? null}
                  hasPageBreak={pageBreaks.has(structureTargetId)}
                  onSetChapter={(title) => onSetChapter(structureTargetId, title)}
                  onSetPageBreak={(enabled) => onSetPageBreak(structureTargetId, enabled)}
                />
              </div>
            ) : null}

            <div className="editorial-structure-list">
              {structureRows.map((messageId) => {
                const message = messagesById.get(messageId)
                const chapterTitle = chaptersByMessage.get(messageId)
                const hasPageBreak = pageBreaks.has(messageId)
                return (
                  <button
                    type="button"
                    className={structureTargetId === messageId ? 'is-active' : ''}
                    aria-pressed={structureTargetId === messageId}
                    key={messageId}
                    onClick={() => setStructureTargetId(messageId)}
                  >
                    <span className="editorial-structure-kind" aria-hidden="true">
                      {chapterTitle ? <BookMarked size={14} /> : <FilePlus2 size={14} />}
                    </span>
                    <span>
                      <strong>{chapterTitle ?? (hasPageBreak ? 'Nouvelle page' : message?.sender ?? 'WhatsApp')}</strong>
                      <small>{message ? messageLabel(message) : 'Message hors sélection'}</small>
                    </span>
                  </button>
                )
              })}
            </div>
            {!normalizedStructureQuery && structureRows.length === 0 ? (
              <p className="editorial-empty">Recherchez un message pour créer le premier chapitre ou saut de page.</p>
            ) : null}
            {normalizedStructureQuery && structureRows.length === 0 ? (
              <p className="editorial-empty">Aucun message trouvé.</p>
            ) : null}
            {normalizedStructureQuery && structureRows.length === 40 ? (
              <p className="editorial-structure-limit">40 résultats affichés · précisez la recherche si nécessaire.</p>
            ) : null}
          </section>

          <section className="editorial-section">
            <div className="editorial-section-heading">
              <BookOpenText size={16} aria-hidden="true" />
              <div><h3>Pages personnelles</h3><p>Dédicace, introduction, interludes, pages blanches et épilogue.</p></div>
            </div>

            {pageDraft ? (
              <form
                className="editorial-page-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  savePage()
                }}
              >
                <label>
                  Type de page
                  <select
                    value={pageDraft.kind}
                    onChange={(event) => setPageDraft({
                      ...pageDraft,
                      kind: event.target.value as EditorialPageKind,
                      anchorMessageId: event.target.value === 'text' || event.target.value === 'blank'
                        ? pageDraft.anchorMessageId
                        : null,
                    })}
                  >
                    {(Object.keys(PAGE_KIND_META) as EditorialPageKind[]).map((kind) => (
                      <option value={kind} key={kind}>{PAGE_KIND_META[kind].label}</option>
                    ))}
                  </select>
                </label>
                {pageDraft.kind !== 'blank' ? (
                  <>
                    <label>
                      Titre
                      <input
                        autoFocus
                        type="text"
                        maxLength={100}
                        value={pageDraft.title}
                        onChange={(event) => setPageDraft({ ...pageDraft, title: event.target.value })}
                      />
                    </label>
                    <label>
                      Texte
                      <textarea
                        rows={8}
                        maxLength={12_000}
                        value={pageDraft.body}
                        onChange={(event) => setPageDraft({ ...pageDraft, body: event.target.value })}
                      />
                    </label>
                  </>
                ) : null}
                {pageDraft.kind === 'text' || pageDraft.kind === 'blank' ? (
                  <label>
                    Placement
                    <select
                      value={pageDraft.anchorMessageId ?? ''}
                      onChange={(event) => setPageDraft({
                        ...pageDraft,
                        anchorMessageId: event.target.value || null,
                      })}
                    >
                      <option value="">À la fin du livre</option>
                      {messages.map((message) => (
                        <option value={message.id} key={message.id}>{messageLabel(message)}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="editorial-form-actions">
                  <button
                    type="submit"
                    className="editorial-primary-action"
                    disabled={pageDraft.kind !== 'blank' && !pageDraft.title.trim() && !pageDraft.body.trim()}
                  >
                    <Check size={14} /> Enregistrer
                  </button>
                  <button type="button" onClick={() => setPageDraft(null)}>Annuler</button>
                </div>
              </form>
            ) : (
              <div className="editorial-add-actions">
                {(Object.keys(PAGE_KIND_META) as EditorialPageKind[]).map((kind) => (
                  <button type="button" key={kind} onClick={() => setPageDraft(createPage(kind))}>
                    <Plus size={13} /> {PAGE_KIND_META[kind].label}
                  </button>
                ))}
              </div>
            )}

            {editorialPages.length ? (
              <div className="editorial-page-list">
                {editorialPages.map((page) => (
                  <article key={page.id}>
                    <button type="button" className="editorial-page-main" onClick={() => onPreviewPage(page.id)}>
                      <FilePenLine size={15} />
                      <span>
                        <small>
                          {PAGE_KIND_META[page.kind].label}
                          {page.anchorMessageId && !visibleMessages.has(page.anchorMessageId)
                            ? ' · placé à la fin'
                            : ''}
                        </small>
                        <strong>{page.title || PAGE_KIND_META[page.kind].defaultTitle || PAGE_KIND_META[page.kind].label}</strong>
                      </span>
                    </button>
                    <button type="button" aria-label={`Modifier ${page.title || PAGE_KIND_META[page.kind].label}`} title="Modifier" onClick={() => setPageDraft({ ...page })}>
                      <FilePenLine size={14} />
                    </button>
                    <button type="button" aria-label={`Supprimer ${page.title || PAGE_KIND_META[page.kind].label}`} title="Supprimer" onClick={() => onDeletePage(page.id)}>
                      <Trash2 size={14} />
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className="editorial-section">
            <div className="editorial-section-heading">
              <UserRoundPen size={16} aria-hidden="true" />
              <div><h3>Identités</h3><p>Pseudonyme et couleur imprimée par participant.</p></div>
            </div>
            <div className="participant-profile-list">
              {participants.map((participant) => {
                const profile = participantProfiles.find((candidate) => (
                  candidate.participant === participant
                ))
                const participantIndex = Math.max(0, allParticipants.indexOf(participant))
                const color = profile?.color ?? PROFILE_COLORS[participantIndex % PROFILE_COLORS.length]
                return (
                  <div className="participant-profile" key={participant}>
                    <span title={participant}>{participant}</span>
                    <input
                      key={`${participant}:${profile?.displayName ?? participant}`}
                      type="text"
                      defaultValue={profile?.displayName ?? participant}
                      maxLength={60}
                      aria-label={`Nom affiché pour ${participant}`}
                      onBlur={(event) => {
                        if (event.target.value.trim() === (profile?.displayName ?? participant)) return
                        onSetParticipantProfile(participant, event.target.value, color)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        if (event.currentTarget.value.trim() !== (profile?.displayName ?? participant)) {
                          onSetParticipantProfile(participant, event.currentTarget.value, color)
                        }
                        event.currentTarget.blur()
                      }}
                    />
                    <input
                      type="color"
                      value={color}
                      aria-label={`Couleur de ${participant}`}
                      onChange={(event) => onSetParticipantProfile(
                        participant,
                        profile?.displayName ?? participant,
                        event.target.value,
                      )}
                    />
                    <button
                      type="button"
                      disabled={!profile}
                      aria-label={`Réinitialiser ${participant}`}
                      title="Réinitialiser"
                      onClick={() => onResetParticipantProfile(participant)}
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="editorial-section">
            <div className="editorial-section-heading">
              <Bookmark size={16} aria-hidden="true" />
              <div><h3>Pages signalées</h3><p>Repères disponibles dans la navigation et le sommaire.</p></div>
            </div>
            {bookmarks.length ? (
              <div className="editorial-bookmark-list">
                {bookmarks.map((bookmark) => (
                  <div key={`${bookmark.messageId}:${bookmark.continuationPart ?? 1}`}>
                    <button
                      type="button"
                      disabled={!visibleMessages.has(bookmark.messageId)}
                      title={visibleMessages.has(bookmark.messageId) ? 'Voir la page' : 'Message hors sélection'}
                      onClick={() => onPreviewMessage(
                        bookmark.messageId,
                        bookmark.continuationPart,
                      )}
                    >
                      <LocateFixed size={14} />
                    </button>
                    <input
                      type="text"
                      defaultValue={bookmark.label}
                      maxLength={80}
                      aria-label={`Nom du repère ${bookmark.label}`}
                      onBlur={(event) => onSetBookmark(
                        bookmark.messageId,
                        event.target.value,
                        bookmark.continuationPart,
                      )}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        onSetBookmark(
                          bookmark.messageId,
                          event.currentTarget.value,
                          bookmark.continuationPart,
                        )
                        event.currentTarget.blur()
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Supprimer le repère ${bookmark.label}`}
                      title="Supprimer"
                      onClick={() => onSetBookmark(
                        bookmark.messageId,
                        null,
                        bookmark.continuationPart,
                      )}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : <p className="editorial-empty">Signalez une page depuis les réglages de structure d’un message.</p>}
          </section>
        </div>

        <footer className="content-drawer-footer">
          <span>{editorialPages.length} page{editorialPages.length > 1 ? 's' : ''} · {visibleProfileCount} identité{visibleProfileCount > 1 ? 's' : ''} · {bookmarks.length} repère{bookmarks.length > 1 ? 's' : ''}</span>
        </footer>
      </aside>
    </>
  )
}