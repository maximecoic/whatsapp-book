import {
  Bookmark,
  BookMarked,
  Check,
  FilePlus2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChatMessage } from '../lib/chat-types'

interface StructureInspectorProps {
  message: ChatMessage
  chapterTitle: string | null
  hasPageBreak: boolean
  bookmarkLabel: string | null
  onSetChapter(title: string | null): void
  onSetPageBreak(enabled: boolean): void
  onSetBookmark(label: string | null): void
  onAddEditorialPage(): void
  onReset(): void
  onClose(): void
}

interface ChapterBreakControlsProps {
  messageId: string
  chapterTitle: string | null
  hasPageBreak: boolean
  onSetChapter(title: string | null): void
  onSetPageBreak(enabled: boolean): void
}

const timestampFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function ChapterBreakControls({
  messageId,
  chapterTitle,
  hasPageBreak,
  onSetChapter,
  onSetPageBreak,
}: ChapterBreakControlsProps) {
  const [editingChapter, setEditingChapter] = useState(Boolean(chapterTitle))
  const [chapterDraft, setChapterDraft] = useState(chapterTitle ?? '')

  useEffect(() => {
    setEditingChapter(Boolean(chapterTitle))
    setChapterDraft(chapterTitle ?? '')
  }, [chapterTitle, messageId])

  const saveChapter = () => {
    const title = chapterDraft.trim()
    if (!title) return
    onSetChapter(title)
  }

  return (
    <div className="chapter-break-controls">
      <div>
        <h4>Nouvelle page</h4>
        <label className="photo-caption-toggle structure-page-toggle">
          <span>
            <FilePlus2 size={15} />
            Commencer avant ce message
          </span>
          <input
            type="checkbox"
            checked={Boolean(chapterTitle) || hasPageBreak}
            disabled={Boolean(chapterTitle)}
            onChange={(event) => onSetPageBreak(event.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true"><span /></span>
        </label>
        {chapterTitle ? (
          <p className="structure-help">Le chapitre commence déjà sur une nouvelle page.</p>
        ) : null}
      </div>

      <div>
        <h4>Chapitre</h4>
        {editingChapter ? (
          <form
            className="structure-chapter-form"
            onSubmit={(event) => {
              event.preventDefault()
              saveChapter()
            }}
          >
            <label>
              Titre
              <input
                autoFocus={!chapterTitle}
                type="text"
                value={chapterDraft}
                maxLength={80}
                placeholder="Ex. Le grand départ"
                onChange={(event) => setChapterDraft(event.target.value)}
              />
            </label>
            <div>
              <button
                type="submit"
                className="structure-save-button"
                disabled={!chapterDraft.trim()}
              >
                <Check size={14} />
                {chapterTitle ? 'Mettre à jour' : 'Créer le chapitre'}
              </button>
              {chapterTitle ? (
                <button
                  type="button"
                  className="structure-delete-button"
                  onClick={() => {
                    onSetChapter(null)
                    setEditingChapter(false)
                    setChapterDraft('')
                  }}
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingChapter(false)}
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="structure-add-chapter"
            onClick={() => setEditingChapter(true)}
          >
            <BookMarked size={15} />
            Commencer un chapitre ici
          </button>
        )}
      </div>
    </div>
  )
}

export function StructureInspector({
  message,
  chapterTitle,
  hasPageBreak,
  bookmarkLabel,
  onSetChapter,
  onSetPageBreak,
  onSetBookmark,
  onAddEditorialPage,
  onReset,
  onClose,
}: StructureInspectorProps) {
  const [bookmarkDraft, setBookmarkDraft] = useState(bookmarkLabel ?? '')

  useEffect(() => {
    setBookmarkDraft(bookmarkLabel ?? '')
  }, [bookmarkLabel, message.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <aside
      className="photo-inspector structure-inspector"
      aria-labelledby="structure-inspector-title"
    >
      <header className="photo-inspector-header">
        <div>
          <span className="eyebrow">Structure du livre</span>
          <h2 id="structure-inspector-title">Chapitre et page</h2>
          <p>{message.sender ?? 'WhatsApp'} · {timestampFormatter.format(message.timestamp)}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fermer les réglages de structure"
          title="Fermer"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>

      <div className="photo-inspector-content structure-inspector-content">
        <section>
          <ChapterBreakControls
            messageId={message.id}
            chapterTitle={chapterTitle}
            hasPageBreak={hasPageBreak}
            onSetChapter={onSetChapter}
            onSetPageBreak={onSetPageBreak}
          />
        </section>

        <section>
          <h3>Navigation</h3>
          {bookmarkLabel !== null ? (
            <div className="structure-bookmark-editor">
              <label>
                Nom de la page signalée
                <input
                  type="text"
                  value={bookmarkDraft}
                  maxLength={80}
                  onChange={(event) => setBookmarkDraft(event.target.value)}
                  onBlur={() => {
                    const label = bookmarkDraft.trim()
                    if (label) onSetBookmark(label)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    const label = bookmarkDraft.trim()
                    if (label) onSetBookmark(label)
                  }}
                />
              </label>
              <button type="button" onClick={() => onSetBookmark(null)}>
                <Trash2 size={14} /> Retirer le repère
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="structure-add-chapter"
              onClick={() => onSetBookmark(
                `Souvenir du ${timestampFormatter.format(message.timestamp)}`,
              )}
            >
              <Bookmark size={15} /> Signaler cette page
            </button>
          )}
          <button
            type="button"
            className="structure-add-chapter structure-add-editorial"
            onClick={onAddEditorialPage}
          >
            <FilePlus2 size={15} /> Insérer une page personnelle ici
          </button>
        </section>

        <section className="structure-message-preview">
          <h3>Message repère</h3>
          <p>{message.body || (message.mediaName ? 'Photo sans légende' : 'Message vide')}</p>
        </section>
      </div>

      <footer className="photo-inspector-footer">
        <button type="button" onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" />
          Réinitialiser la structure
        </button>
      </footer>
    </aside>
  )
}