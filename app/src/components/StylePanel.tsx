import {
  BookOpen,
  Check,
  Contrast,
  Frame,
  Image,
  LayoutTemplate,
  MessageSquareText,
  Palette,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  SlidersHorizontal,
  Type,
  X,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type {
  BackCoverLayout,
  BookSettings,
  BookTheme,
} from '../lib/book-model'
import {
  BOOK_STYLE_PRESETS,
  COVER_OVERLAY_MAX,
  COVER_OVERLAY_MIN,
  FONT_PAIR_META,
  bestContrastText,
  contrastRatio,
  ensureReadableColor,
  type BookArtDirection,
  type BookDateStyle,
  type BookDensity,
  type BookFontPair,
  type BookVisualPreset,
  type ChapterStyle,
  type CoverLayout,
  type CoverTitlePosition,
  type DateHeadingStyle,
  type PageNumberStyle,
  type ParticipantPalette,
  type PhotoFrameStyle,
} from '../lib/book-style'
import { useResponsiveWorkspacePanel } from './useResponsiveWorkspacePanel'

type CoreStyleSettings = Pick<
  BookSettings,
  'theme' | 'format' | 'orientation' | 'fontScale' | 'maxPhotosPerPage' | 'backCover'
>

interface StylePanelProps {
  settings: CoreStyleSettings
  artDirection: BookArtDirection
  accent: string
  onClose(): void
  onApplyPreset(preset: BookVisualPreset): void
  onChange(changes: Partial<Omit<BookArtDirection, 'preset'>>): void
  onAccentChange(accent: string): void
  onChooseBackCoverPhoto(): void
  onSettingChange<Key extends keyof CoreStyleSettings>(
    key: Key,
    value: CoreStyleSettings[Key],
  ): void
}

const ACCENTS = ['#e6503f', '#176b67', '#d0912f', '#315fa7', '#9d4561']
const THEMES: Array<{
  value: BookTheme
  label: string
  icon: typeof BookOpen
}> = [
  { value: 'journal', label: 'Carnet', icon: BookOpen },
  { value: 'conversation', label: 'Messages', icon: MessageSquareText },
  { value: 'album', label: 'Album', icon: Image },
]

function photoDensityLabel(maxPhotosPerPage: number): string {
  if (maxPhotosPerPage === 1) return 'Pleine page'
  if (maxPhotosPerPage === 2) return 'Très grandes'
  if (maxPhotosPerPage <= 4) return 'Équilibrées'
  return 'Compactes'
}

function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Value
  options: Array<{ value: Value; label: string }>
  onChange(value: Value): void
}) {
  return (
    <div className="style-field-group">
      <span>{label}</span>
      <div
        className={`style-segmented has-${options.length}-options`}
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            type="button"
            className={option.value === value ? 'is-active' : ''}
            aria-pressed={option.value === value}
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function StylePanel({
  settings,
  artDirection,
  accent,
  onClose,
  onApplyPreset,
  onChange,
  onAccentChange,
  onChooseBackCoverPhoto,
  onSettingChange,
}: StylePanelProps) {
  const { isDocked, panelRef } = useResponsiveWorkspacePanel(
    onClose,
    '.style-panel-button',
  )
  const preset = BOOK_STYLE_PRESETS[artDirection.preset]
  const textContrast = contrastRatio(artDirection.inkColor, artDirection.paperColor)
  const readableAccent = ensureReadableColor(accent, artDirection.paperColor)
  const accentContrast = contrastRatio(readableAccent, artDirection.paperColor)
  const accentSurfaceText = bestContrastText(accent)
  const accentSurfaceContrast = contrastRatio(accentSurfaceText, accent)
  const customized = accent.toLowerCase() !== preset.accent ||
    JSON.stringify(artDirection) !== JSON.stringify(preset.artDirection)

  return (
    <>
      {!isDocked ? (
        <button
          className="content-drawer-backdrop"
          type="button"
          aria-label="Fermer les réglages de style"
          tabIndex={-1}
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={panelRef}
        className={`content-drawer style-drawer${isDocked ? ' is-docked' : ''}`}
        role={isDocked ? 'complementary' : 'dialog'}
        aria-modal={isDocked ? undefined : true}
        aria-labelledby="style-drawer-title"
      >
        <header className="content-drawer-header">
          <div>
            <span className="eyebrow">Apparence du livre</span>
            <h2 id="style-drawer-title">Apparence</h2>
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

        <div className="style-panel-content">
          <section className="style-section style-layout-section">
            <div className="style-section-heading">
              <LayoutTemplate size={16} aria-hidden="true" />
              <h3>Mise en page</h3>
            </div>

            <div className="style-field-group">
              <span>Mode de composition</span>
              <div className="theme-selector" role="group" aria-label="Mode de composition">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={settings.theme === value ? 'is-active' : ''}
                    aria-pressed={settings.theme === value}
                    onClick={() => onSettingChange('theme', value)}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="inline-fields style-page-fields">
              <label className="field-label">
                Format
                <select
                  value={settings.format}
                  onChange={(event) => onSettingChange(
                    'format',
                    event.target.value as CoreStyleSettings['format'],
                  )}
                >
                  <option value="a5">A5 · 148 × 210</option>
                  <option value="a4">A4 · 210 × 297</option>
                  <option value="letter">Letter · 216 × 279</option>
                  <option value="square">Carré · 210 × 210</option>
                </select>
              </label>
              <div className="orientation-control" role="group" aria-label="Orientation">
                <button
                  type="button"
                  className={settings.orientation === 'portrait' ? 'is-active' : ''}
                  aria-label="Portrait"
                  title="Portrait"
                  aria-pressed={settings.orientation === 'portrait'}
                  onClick={() => onSettingChange('orientation', 'portrait')}
                >
                  <RectangleVertical size={17} />
                </button>
                <button
                  type="button"
                  className={settings.orientation === 'landscape' ? 'is-active' : ''}
                  aria-label="Paysage"
                  title="Paysage"
                  aria-pressed={settings.orientation === 'landscape'}
                  onClick={() => onSettingChange('orientation', 'landscape')}
                >
                  <RectangleHorizontal size={19} />
                </button>
              </div>
            </div>

            <label className="range-label">
              <span>Taille du texte <output>{Math.round(settings.fontScale * 100)} %</output></span>
              <input
                type="range"
                min="0.85"
                max="1.2"
                step="0.05"
                value={settings.fontScale}
                onChange={(event) => onSettingChange('fontScale', Number(event.target.value))}
              />
            </label>

            <div className="photo-settings-section style-photo-density">
              <div className="section-heading-row">
                <h3>Photos par page</h3>
                <span>{photoDensityLabel(settings.maxPhotosPerPage)}</span>
              </div>
              <label className="range-label photo-density-control">
                <span>Maximum <output>{settings.maxPhotosPerPage}</output></span>
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="1"
                  value={settings.maxPhotosPerPage}
                  aria-label="Maximum de photos par page"
                  onChange={(event) => onSettingChange(
                    'maxPhotosPerPage',
                    Number(event.target.value),
                  )}
                />
              </label>
              <div
                className="photo-density-preview"
                style={{
                  '--photo-density-columns': settings.maxPhotosPerPage === 1
                    ? 1
                    : settings.maxPhotosPerPage <= 4
                      ? 2
                      : 3,
                } as CSSProperties}
                aria-hidden="true"
              >
                {Array.from({ length: settings.maxPhotosPerPage }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            </div>
          </section>

          <section className="style-section">
            <div className="style-section-heading">
              <Palette size={16} aria-hidden="true" />
              <h3>Univers</h3>
            </div>
            <div className="style-preset-list">
              {(Object.keys(BOOK_STYLE_PRESETS) as BookVisualPreset[]).map((value) => {
                const definition = BOOK_STYLE_PRESETS[value]
                return (
                  <button
                    type="button"
                    className={artDirection.preset === value ? 'is-active' : ''}
                    aria-pressed={artDirection.preset === value}
                    key={value}
                    onClick={() => onApplyPreset(value)}
                  >
                    <span className="style-preset-colors" aria-hidden="true">
                      <i style={{ background: definition.artDirection.paperColor }} />
                      <i style={{ background: definition.accent }} />
                      <i style={{ background: definition.artDirection.inkColor }} />
                    </span>
                    <span>
                      <strong>{definition.label}</strong>
                      <small>{definition.description}</small>
                    </span>
                    {artDirection.preset === value ? <Check size={14} /> : null}
                  </button>
                )
              })}
            </div>
          </section>

          <details className="style-advanced">
            <summary>
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span>
                <strong>Personnalisation avancée</strong>
                <small>Typographie, couleurs et détails du livre</small>
              </span>
            </summary>
            <div className="style-advanced-content">
          <section className="style-section">
            <div className="style-section-heading">
              <Type size={16} aria-hidden="true" />
              <h3>Typographie</h3>
            </div>
            <label className="style-select-field">
              Paire de polices
              <select
                value={artDirection.fontPair}
                onChange={(event) => onChange({
                  fontPair: event.target.value as BookFontPair,
                })}
              >
                {(Object.keys(FONT_PAIR_META) as BookFontPair[]).map((value) => (
                  <option value={value} key={value}>{FONT_PAIR_META[value].label}</option>
                ))}
              </select>
            </label>
            <label className="style-range-field">
              <span>Interlignage <output>{artDirection.lineHeight.toFixed(2)}</output></span>
              <input
                type="range"
                aria-label="Interlignage"
                min="1.2"
                max="1.8"
                step="0.05"
                value={artDirection.lineHeight}
                onChange={(event) => onChange({ lineHeight: Number(event.target.value) })}
              />
            </label>
          </section>

          <section className="style-section">
            <div className="style-section-heading">
              <Contrast size={16} aria-hidden="true" />
              <h3>Couleurs</h3>
            </div>
            <div className="style-color-grid">
              <label>
                Papier
                <input
                  type="color"
                  value={artDirection.paperColor}
                  onChange={(event) => onChange({ paperColor: event.target.value })}
                />
              </label>
              <label>
                Texte
                <input
                  type="color"
                  value={artDirection.inkColor}
                  onChange={(event) => onChange({ inkColor: event.target.value })}
                />
              </label>
              <label>
                Accent
                <input
                  type="color"
                  value={accent}
                  onChange={(event) => onAccentChange(event.target.value)}
                />
              </label>
            </div>
            <div className="style-accent-swatches" role="group" aria-label="Couleur d’accent">
              {ACCENTS.map((color) => (
                <button
                  type="button"
                  className={accent.toLowerCase() === color ? 'is-active' : ''}
                  style={{ background: color }}
                  aria-label={`Accent ${color}`}
                  aria-pressed={accent.toLowerCase() === color}
                  key={color}
                  onClick={() => onAccentChange(color)}
                >
                  {accent.toLowerCase() === color ? <Check size={12} /> : null}
                </button>
              ))}
            </div>
            <div className={`style-contrast is-${textContrast >= 7 ? 'excellent' : textContrast >= 4.5 ? 'good' : 'low'}`}>
              <div><span>Texte / papier</span><strong>{textContrast.toFixed(2)}:1</strong></div>
              <div><span>Accent imprimé</span><strong>{accentContrast.toFixed(2)}:1</strong></div>
              <div><span>Texte / fond accent</span><strong>{accentSurfaceContrast.toFixed(2)}:1</strong></div>
              <small>
                {textContrast < 4.5
                  ? 'Le PDF sera bloqué : augmentez le contraste texte/papier.'
                  : readableAccent !== accent.toLowerCase()
                    ? `Accent ajusté à ${readableAccent} pour les petits textes.`
                    : `Texte ${accentSurfaceText === '#000000' ? 'noir' : 'blanc'} choisi automatiquement sur les fonds d’accent.`}
              </small>
            </div>
          </section>

          <section className="style-section">
            <div className="style-section-heading">
              <LayoutTemplate size={16} aria-hidden="true" />
              <h3>Page</h3>
            </div>
            <SegmentedControl<BookDensity>
              label="Densité"
              value={artDirection.density}
              options={[
                { value: 'airy', label: 'Aérée' },
                { value: 'balanced', label: 'Équilibrée' },
                { value: 'compact', label: 'Compacte' },
              ]}
              onChange={(density) => onChange({ density })}
            />
            <SegmentedControl<PageNumberStyle>
              label="Numéros"
              value={artDirection.pageNumbers}
              options={[
                { value: 'outer', label: 'Extérieur' },
                { value: 'center', label: 'Centré' },
                { value: 'hidden', label: 'Masqué' },
              ]}
              onChange={(pageNumbers) => onChange({ pageNumbers })}
            />
            <SegmentedControl<BookDateStyle>
              label="Format des dates"
              value={artDirection.dateStyle}
              options={[
                { value: 'full', label: 'Complète' },
                { value: 'compact', label: 'Courte' },
                { value: 'minimal', label: 'Chiffrée' },
              ]}
              onChange={(dateStyle) => onChange({ dateStyle })}
            />
            <SegmentedControl<DateHeadingStyle>
              label="Style des dates"
              value={artDirection.dateHeadingStyle}
              options={[
                { value: 'classic', label: 'Classique' },
                { value: 'label', label: 'Cartouche' },
                { value: 'minimal', label: 'Minimal' },
              ]}
              onChange={(dateHeadingStyle) => onChange({ dateHeadingStyle })}
            />
          </section>

          <section className="style-section">
            <div className="style-section-heading">
              <Frame size={16} aria-hidden="true" />
              <h3>Éléments</h3>
            </div>
            <SegmentedControl<PhotoFrameStyle>
              label="Photos"
              value={artDirection.photoFrame}
              options={[
                { value: 'square', label: 'Nettes' },
                { value: 'soft', label: 'Douces' },
                { value: 'bordered', label: 'Encadrées' },
              ]}
              onChange={(photoFrame) => onChange({ photoFrame })}
            />
            <SegmentedControl<ChapterStyle>
              label="Chapitres"
              value={artDirection.chapterStyle}
              options={[
                { value: 'classic', label: 'Classique' },
                { value: 'band', label: 'Bandeau' },
                { value: 'minimal', label: 'Minimal' },
              ]}
              onChange={(chapterStyle) => onChange({ chapterStyle })}
            />
            <SegmentedControl<ParticipantPalette>
              label="Participants"
              value={artDirection.participantPalette}
              options={[
                { value: 'custom', label: 'Personnalisés' },
                { value: 'accent', label: 'Accent' },
                { value: 'neutral', label: 'Neutres' },
              ]}
              onChange={(participantPalette) => onChange({ participantPalette })}
            />
          </section>

          <section className="style-section">
            <div className="style-section-heading">
              <BookOpen size={16} aria-hidden="true" />
              <h3>Couverture</h3>
            </div>
            <SegmentedControl<CoverLayout>
              label="Composition"
              value={artDirection.coverLayout}
              options={[
                { value: 'split', label: 'Divisée' },
                { value: 'full-image', label: 'Pleine image' },
                { value: 'typographic', label: 'Typographique' },
              ]}
              onChange={(coverLayout) => onChange({ coverLayout })}
            />
            <SegmentedControl<CoverTitlePosition>
              label="Position du titre"
              value={artDirection.coverTitlePosition}
              options={[
                { value: 'bottom-left', label: 'Bas gauche' },
                { value: 'center', label: 'Centré' },
              ]}
              onChange={(coverTitlePosition) => onChange({ coverTitlePosition })}
            />
            {artDirection.coverLayout === 'full-image' ? (
              <label className="style-range-field">
                <span>Voile <output>{artDirection.coverOverlay} %</output></span>
                <input
                  type="range"
                  aria-label="Voile de couverture"
                  min={COVER_OVERLAY_MIN}
                  max={COVER_OVERLAY_MAX}
                  step="1"
                  value={artDirection.coverOverlay}
                  onChange={(event) => onChange({ coverOverlay: Number(event.target.value) })}
                />
              </label>
            ) : null}

            <div className="style-back-cover">
              <label className="photo-caption-toggle">
                <span>Ajouter une quatrième de couverture</span>
                <input
                  type="checkbox"
                  checked={settings.backCover.enabled}
                  onChange={(event) => onSettingChange('backCover', {
                    ...settings.backCover,
                    enabled: event.target.checked,
                  })}
                />
                <span className="toggle-track" aria-hidden="true"><span /></span>
              </label>

              {settings.backCover.enabled ? (
                <div className="style-back-cover-controls">
                  <SegmentedControl<BackCoverLayout>
                    label="Composition du dos"
                    value={settings.backCover.layout}
                    options={[
                      { value: 'photo', label: 'Photo' },
                      { value: 'text', label: 'Texte seul' },
                    ]}
                    onChange={(layout) => onSettingChange('backCover', {
                      ...settings.backCover,
                      layout,
                    })}
                  />
                  {settings.backCover.layout === 'photo' ? (
                    <div className="style-back-cover-photo">
                      <span title={settings.backCover.mediaName ?? ''}>
                        {settings.backCover.mediaName ?? 'Photo automatique'}
                      </span>
                      <button type="button" onClick={onChooseBackCoverPhoto}>
                        Choisir une photo
                      </button>
                    </div>
                  ) : null}
                  <label className="style-textarea-field">
                    Texte du dos
                    <textarea
                      rows={5}
                      maxLength={2_000}
                      value={settings.backCover.text}
                      placeholder="Un mot de conclusion, une citation…"
                      onChange={(event) => onSettingChange('backCover', {
                        ...settings.backCover,
                        text: event.target.value,
                      })}
                    />
                  </label>
                  <SegmentedControl<CoverTitlePosition>
                    label="Position du texte"
                    value={settings.backCover.textPosition}
                    options={[
                      { value: 'bottom-left', label: 'Bas gauche' },
                      { value: 'center', label: 'Centré' },
                    ]}
                    onChange={(textPosition) => onSettingChange('backCover', {
                      ...settings.backCover,
                      textPosition,
                    })}
                  />
                  {settings.backCover.layout === 'photo' ? (
                    <label className="style-range-field">
                      <span>Voile du dos <output>{settings.backCover.overlay} %</output></span>
                      <input
                        type="range"
                        aria-label="Voile de la quatrième de couverture"
                        min={COVER_OVERLAY_MIN}
                        max={COVER_OVERLAY_MAX}
                        step="1"
                        value={settings.backCover.overlay}
                        onChange={(event) => onSettingChange('backCover', {
                          ...settings.backCover,
                          overlay: Number(event.target.value),
                        })}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
            </div>
          </details>
        </div>

        <footer className="content-drawer-footer style-drawer-footer">
          <span>{preset.label}{customized ? ' · Personnalisé' : ''}</span>
          <button type="button" disabled={!customized} onClick={() => onApplyPreset(artDirection.preset)}>
            <RotateCcw size={13} /> Réinitialiser
          </button>
        </footer>
      </aside>
    </>
  )
}
