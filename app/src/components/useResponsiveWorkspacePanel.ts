import { useEffect, useRef, useState } from 'react'

const DOCKED_QUERY = '(min-width: 761px)'

export function useResponsiveWorkspacePanel(
  onClose: () => void,
  triggerSelector: string,
) {
  const [isDocked, setIsDocked] = useState(() => (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia(DOCKED_QUERY).matches
  ))
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const media = globalThis.matchMedia(DOCKED_QUERY)
    const updateMode = () => setIsDocked(media.matches)
    updateMode()
    media.addEventListener('change', updateMode)
    return () => media.removeEventListener('change', updateMode)
  }, [])

  useEffect(() => {
    if (isDocked) return
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    const backgroundElements = [
      document.querySelector<HTMLElement>('.app-header'),
      document.querySelector<HTMLElement>('.studio-toolbar'),
      ...Array.from(document.querySelectorAll<HTMLElement>(
        '.studio-layout > :not(.content-drawer):not(.content-drawer-backdrop)',
      )),
    ].filter((element): element is HTMLElement => Boolean(element))

    document.body.style.overflow = 'hidden'
    backgroundElements.forEach((element) => {
      element.inert = true
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    panelRef.current
      ?.querySelector<HTMLElement>('button, input, select, textarea, summary')
      ?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      backgroundElements.forEach((element) => {
        element.inert = false
      })
      document.removeEventListener('keydown', handleKeyDown)
      const restoreTarget = previousFocus?.matches(triggerSelector)
        ? previousFocus
        : document.querySelector<HTMLElement>(triggerSelector)
      restoreTarget?.focus()
    }
  }, [isDocked, triggerSelector])

  return { isDocked, panelRef }
}