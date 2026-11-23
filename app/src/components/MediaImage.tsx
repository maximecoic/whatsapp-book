import { ImageOff } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import type { ChatArchive } from '../lib/archive-reader'
import { recordPhotoAspectRatio } from './usePhotoAspectRatios'
import { DEFAULT_VIDEO_TIME, getVideoFrame, isVideoMedia } from '../lib/video-frame'

interface MediaImageProps {
  archive: ChatArchive
  name: string
  alt: string
  className?: string
  style?: CSSProperties
  videoTime?: number
}

export function MediaImage({
  archive,
  name,
  alt,
  className = '',
  style,
  videoTime = DEFAULT_VIDEO_TIME,
}: MediaImageProps) {
  const [source, setSource] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let temporaryUrl: string | null = null
    setSource(null)
    setFailed(false)

    const load = isVideoMedia(name)
      ? getVideoFrame(archive, name, videoTime).then((blob) => {
        if (!blob || !active) return null
        temporaryUrl = URL.createObjectURL(blob)
        return temporaryUrl
      })
      : archive.getMediaUrl(name)
    void load.then((url) => {
      if (!active) return
      if (url) setSource(url)
      else setFailed(true)
    })

    return () => {
      active = false
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl)
    }
  }, [archive, name, videoTime])

  if (failed) {
    return (
      <div className={`media-fallback ${className}`} role="img" aria-label={alt}>
        <ImageOff size={22} aria-hidden="true" />
        <span>{isVideoMedia(name) ? 'Vidéo indisponible' : 'Photo indisponible'}</span>
      </div>
    )
  }

  if (!source) {
    return <div className={`media-loading ${className}`} aria-label={isVideoMedia(name) ? 'Chargement de la vidéo' : 'Chargement de la photo'} />
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