import { Image, SlidersHorizontal, X } from 'lucide-react'
import { useResponsiveWorkspacePanel } from './useResponsiveWorkspacePanel'

interface CoverPanelProps {
  title: string
  subtitle: string
  hasPhoto: boolean
  isOpen: boolean
  onTitleChange(title: string): void
  onSubtitleChange(subtitle: string): void
  onChoosePhoto(): void
  onClose(): void
}

export function CoverPanel({
  title,
  subtitle,
  hasPhoto,
  isOpen,
  onTitleChange,
  onSubtitleChange,
  onChoosePhoto,
  onClose,
}: CoverPanelProps) {
  const { isDocked, panelRef } = useResponsiveWorkspacePanel(
    onClose,
    '.cover-panel-button',
    isOpen,
  )
  const isModal = isOpen && !isDocked

  return (
    <>
      {isModal ? (
        <button
          className="content-drawer-backdrop"
          type="button"
          aria-label="Fermer la couverture"
          tabIndex={-1}
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={panelRef}
        className={isOpen
          ? `content-drawer${isDocked ? ' is-docked' : ''}`
          : 'settings-panel'}
        role={isModal ? 'dialog' : 'complementary'}
        aria-modal={isModal ? true : undefined}
        aria-labelledby="cover-panel-title"
      >
        <header className={isOpen ? 'content-drawer-header' : 'panel-title'}>
          <SlidersHorizontal size={17} aria-hidden="true" />
          <h2 id="cover-panel-title">Couverture</h2>
          {isOpen ? (
            <button
              type="button"
              className="icon-button"
              aria-label="Fermer la couverture"
              title="Fermer la couverture"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          ) : null}
        </header>
        <section className="setting-section">
          <h3>Votre livre</h3>
          <label className="field-label">
            Titre
            <input
              type="text"
              value={title}
              maxLength={72}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </label>
          <label className="field-label">
            Sous-titre
            <input
              type="text"
              value={subtitle}
              maxLength={100}
              onChange={(event) => onSubtitleChange(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="button secondary-button cover-photo-button"
            onClick={onChoosePhoto}
          >
            <Image size={16} aria-hidden="true" />
            {hasPhoto ? 'Changer la photo' : 'Choisir une photo'}
          </button>
        </section>
      </aside>
    </>
  )
}