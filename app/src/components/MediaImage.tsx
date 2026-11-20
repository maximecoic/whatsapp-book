import { ImageOff } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import type { ChatArchive } from '../lib/archive-reader'
import { recordPhotoAspectRatio } from './usePhotoAspectRatios'

interface MediaImageProps {
  archive: ChatArchive
  name: string
  alt: string
  className?: string
  style?: CSSProperties
}

export function MediaImage({
  archive,
  name,
  alt,
  className = '',
  style,
}: MediaImageProps) {
  const [source, setSource] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setSource(null)
    setFailed(false)

    void archive.getMediaUrl(name).then((url) => {
      if (!active) return
      if (url) setSource(url)
      else setFailed(true)
    })

    return () => {
      active = false
    }
  }, [archive, name])

  if (failed) {
    return (
      <div className={`media-fallback ${className}`} role="img" aria-label={alt}>
        <ImageOff size={22} aria-hidden="true" />
        <span>Photo indisponible</span>
      </div>
    )
  }

  if (!source) {
    return <div className={`media-loading ${className}`} aria-label="Chargement de la photo" />
  }

  return (
    <img
      className={className}
      src={source}
      alt={alt}
      style={style}
      onLoad={(event) => recordPhotoAspectRatio(
        archive,
        name,
        event.currentTarget.naturalWidth,
        event.currentTarget.naturalHeight,
      )}
      onError={() => {
        setSource(null)
        setFailed(true)
      }}
    />
  )
}