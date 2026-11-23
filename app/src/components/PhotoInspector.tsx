import {
  Columns2,
  Eye,
  EyeOff,
  Focus,
  Frame,
  Film,
  Maximize2,
  PanelTop,
  RotateCcw,
  Scan,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChatArchive } from '../lib/archive-reader'
import { DEFAULT_VIDEO_TIME, isVideoMedia } from '../lib/video-frame'
import type {
  PhotoFit,
  PhotoLayout,
  PhotoOverride,
  PhotoRotation,
  PhotoTransform,
} from '../lib/book-model'
import type { ChatMessage } from '../lib/chat-types'

interface PhotoInspectorValue extends PhotoTransform {
  layout?: PhotoLayout
  showCaption?: boolean
  videoTime?: number
  videoTextOnly?: boolean
}

interface PhotoInspectorProps {
  message: ChatMessage
  archive?: ChatArchive
  displayMediaName?: string
  manualVideoConnected?: boolean
  videoAssociationError?: string | null
  onChooseVideo?(): void
  onRemoveVideo?(): void
  override: PhotoInspectorValue
  context?: 'content' | 'cover' | 'back-cover'
  caption?: string
  captionEdited?: boolean
  onChange(
    changes: Partial<Omit<PhotoOverride, 'messageId'>>,
    historyKey?: string,
  ): void
  onClose(): void
  onReset(): void
  onCaptionChange?(caption: string): void
}

const LAYOUTS: Array<{
  value: PhotoLayout
  label: string
  icon: typeof WandSparkles
}> = [
  { value: 'auto', label: 'Auto', icon: WandSparkles },
  { value: 'wide', label: 'Large', icon: PanelTop },
  { value: 'half', label: 'Demi', icon: Columns2 },
  { value: 'full-page', label: 'Page', icon: Maximize2 },
]

const ROTATIONS: PhotoRotation[] = [0, 90, 180, 270]

export function PhotoInspector({
  message,
  archive,
  displayMediaName,
  manualVideoConnected,
  videoAssociationError,
  onChooseVideo,
  onRemoveVideo,
  override,
  context = 'content',
  caption,
  captionEdited = false,
  onChange,
  onClose,
  onReset,
  onCaptionChange,
}: PhotoInspectorProps) {
  const isCover = context !== 'content'
  const isBackCover = context === 'back-cover'
  const historyScope = isBackCover ? 'back-cover-photo' : isCover ? 'cover-photo' : 'photo'
  const isVideo = !isCover && isVideoMedia(message.mediaName)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoSource, setVideoSource] = useState<string | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    let active = true
    let temporaryUrl: string | null = null
    setVideoSource(null)
    setVideoFailed(false)
    if (isVideo && archive && message.mediaName) {
      void archive.getMediaBlob(message.mediaName).then((blob) => {
        if (!active) return
        const url = blob ? URL.createObjectURL(blob) : null
        temporaryUrl = url
        setVideoSource(url)
        if (!url) setVideoFailed(true)
      })
    }
    return () => {
      active = false
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl)
    }
  }, [archive, isVideo, message.mediaName])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <aside
      className="photo-inspector"
      aria-labelledby="photo-inspector-title"
    >
      <header className="photo-inspector-header">
        <div>
          <span className="eyebrow">
            {isBackCover ? 'Réglage de quatrième' : isCover ? 'Réglage de couverture' : 'Réglage individuel'}
          </span>
          <h2 id="photo-inspector-title">
            {isBackCover ? 'Photo de quatrième de couverture' : isCover ? 'Photo de couverture' : isVideo ? 'Vidéo' : 'Photo'}
          </h2>
          <p title={displayMediaName ?? message.mediaName ?? ''}>{displayMediaName ?? message.mediaName}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={isBackCover
            ? 'Fermer les réglages de quatrième de couverture'
            : isCover ? 'Fermer les réglages de couverture' : 'Fermer les réglages photo'}
          title="Fermer"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>

      <div className="photo-inspector-content">
        {isVideo ? <section className="video-inspector-section">
          <h3>Vidéo</h3>
          {onChooseVideo ? <div className="video-association-controls">
            <button type="button" className="video-frame-select" onClick={onChooseVideo}>
              <Film size={15} /> {manualVideoConnected ? 'Remplacer la vidéo' : 'Reconnecter la vidéo'}
            </button>
            {onRemoveVideo ? <button type="button" className="video-frame-select" onClick={onRemoveVideo}><Trash2 size={15} /> Retirer</button> : null}
          </div> : null}
          {videoAssociationError ? <p className="video-association-error" role="alert">{videoAssociationError}</p> : null}
          <div className="photo-fit-control" role="group" aria-label="Présentation de la vidéo">
            <button type="button" className={!override.videoTextOnly ? 'is-active' : ''} aria-pressed={!override.videoTextOnly} onClick={() => onChange({ videoTextOnly: false })}>
              <Film size={16} /> Image et texte
            </button>
            <button type="button" className={override.videoTextOnly ? 'is-active' : ''} aria-pressed={Boolean(override.videoTextOnly)} onClick={() => onChange({ videoTextOnly: true })}>
              <EyeOff size={16} /> Texte seul
            </button>
          </div>
          {videoSource ? <>
            <video
              ref={videoRef}
              src={videoSource}
              controls
              preload="metadata"
              onError={() => setVideoFailed(true)}
              onLoadedMetadata={(event) => {
                const video = event.currentTarget
                if (Number.isFinite(video.duration)) video.currentTime = Math.min(override.videoTime ?? DEFAULT_VIDEO_TIME, Math.max(0, video.duration - 0.05))
              }}
            />
            <button type="button" className="video-frame-select" disabled={videoFailed || Boolean(override.videoTextOnly)} onClick={() => {
              const time = videoRef.current?.currentTime
              if (time !== undefined && Number.isFinite(time)) onChange({ videoTime: Math.round(time * 10) / 10 })
            }}>
              <Frame size={15} /> Utiliser cette image
            </button>
            <span className="video-frame-time">Image choisie : {(override.videoTime ?? DEFAULT_VIDEO_TIME).toFixed(1)} s</span>
          </> : null}
          {videoFailed ? <p className="video-unavailable">Vidéo indisponible ou illisible. Le message reste imprimé.</p> : null}
        </section> : null}
        {!isCover ? <section>
          <h3>Disposition</h3>
          <div className="photo-layout-control" role="group" aria-label="Disposition de la photo">
            {LAYOUTS.map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                className={override.layout === value ? 'is-active' : ''}
                aria-pressed={override.layout === value}
                key={value}
                onClick={() => onChange({ layout: value })}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </section> : null}

        <section>
          <h3>Cadrage</h3>
          <div className="photo-fit-control" role="group" aria-label="Cadrage de la photo">
            {([
              { value: 'contain' as PhotoFit, label: 'Ajuster', icon: Frame },
              { value: 'cover' as PhotoFit, label: 'Remplir', icon: Scan },
            ]).map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                className={override.fit === value ? 'is-active' : ''}
                aria-pressed={override.fit === value}
                key={value}
                onClick={() => onChange({ fit: value })}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {override.fit === 'cover' ? (
            <div className="photo-focus-controls">
              <div className="photo-focus-heading">
                <Focus size={14} aria-hidden="true" />
                <span>Point focal</span>
              </div>
              <label>
                <span>Horizontal <output>{Math.round(override.focalX)} %</output></span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={override.focalX}
                  onChange={(event) => onChange(
                    { focalX: Number(event.target.value) },
                    `${historyScope}:${message.id}:focal-x`,
                  )}
                />
              </label>
              <label>
                <span>Vertical <output>{Math.round(override.focalY)} %</output></span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={override.focalY}
                  onChange={(event) => onChange(
                    { focalY: Number(event.target.value) },
                    `${historyScope}:${message.id}:focal-y`,
                  )}
                />
              </label>
            </div>
          ) : null}
        </section>

        <section>
          <h3>Rotation</h3>
          <div className="photo-rotation-control" role="group" aria-label="Rotation de la photo">
            {ROTATIONS.map((rotation) => (
              <button
                type="button"
                className={override.rotation === rotation ? 'is-active' : ''}
                aria-label={`Rotation ${rotation} degrés`}
                title={`${rotation}°`}
                aria-pressed={override.rotation === rotation}
                key={rotation}
                onClick={() => onChange({ rotation })}
              >
                <span>{rotation}°</span>
              </button>
            ))}
          </div>
        </section>

        {!isCover ? <section>
          <h3>Légende</h3>
          {!isVideo ? <label className="photo-caption-toggle">
            <span>
              {override.showCaption ? <Eye size={15} /> : <EyeOff size={15} />}
              Afficher la légende
            </span>
            <input
              type="checkbox"
              checked={Boolean(override.showCaption)}
              onChange={(event) => onChange({ showCaption: event.target.checked })}
            />
            <span className="toggle-track" aria-hidden="true"><span /></span>
          </label> : null}
          {onCaptionChange ? (
            <label className="photo-caption-editor">
              <span>
                Texte imprimé
                {captionEdited ? <em>Modifiée</em> : null}
              </span>
              <textarea
                value={caption ?? message.body}
                maxLength={2_000}
                rows={4}
                onChange={(event) => onCaptionChange(event.target.value)}
              />
            </label>
          ) : null}
        </section> : null}
      </div>

      <footer className="photo-inspector-footer">
        <button type="button" onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" />
          {isBackCover
            ? 'Réinitialiser la quatrième'
            : isCover ? 'Réinitialiser la couverture' : isVideo ? 'Réinitialiser la vidéo' : 'Réinitialiser la photo'}
        </button>
      </footer>
    </aside>
  )
}