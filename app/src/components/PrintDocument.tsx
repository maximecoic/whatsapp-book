import type { CSSProperties } from 'react'
import type { ChatArchive } from '../lib/archive-reader'
import { getPageDimensions, type BookSettings } from '../lib/book-model'
import type { ChatMessage } from '../lib/chat-types'
import {
  getBookStyleClassName,
  getBookStyleVariables,
} from '../lib/book-style'
import { BookBackCover, BookContentPage, BookCover } from './BookPreview'

interface PrintDocumentProps {
  archive: ChatArchive
  settings: BookSettings
  messages: ChatMessage[]
  pages: ChatMessage[][]
}

export function PrintDocument({
  archive,
  settings,
  messages,
  pages,
}: PrintDocumentProps) {
  const dimensions = getPageDimensions(settings.format, settings.orientation)
  const pageStyle = {
    '--book-accent': settings.accent,
    '--book-font-scale': settings.fontScale,
    ...getBookStyleVariables(settings.artDirection, settings.accent),
    width: `${dimensions.widthMm}mm`,
    height: `${dimensions.heightMm}mm`,
  } as CSSProperties
  const pageClass = `preview-page print-page theme-${settings.theme} orientation-${settings.orientation} ${getBookStyleClassName(settings.artDirection)}`

  return (
    <div className="print-document is-validating">
      <style>{`@media print { @page { size: ${dimensions.widthMm}mm ${dimensions.heightMm}mm; margin: 0; } }`}</style>
      <section className={`${pageClass} is-cover`} style={pageStyle}>
        <BookCover archive={archive} settings={settings} messages={messages} />
      </section>
      {pages.map((page, index) => (
        <section
          className={`${pageClass}${(index + 1) % 2 === 0 ? ' is-even-page' : ''}`}
          style={pageStyle}
          key={page[0]?.id ?? `page-${index + 1}`}
        >
          <BookContentPage
            archive={archive}
            messages={page}
            settings={settings}
          />
          {page[0]?.editorial?.kind !== 'blank' ? (
            <span className="book-page-number">{index + 1}</span>
          ) : null}
        </section>
      ))}
      {settings.backCover.enabled ? (
        <section className={`${pageClass} is-back-cover`} style={pageStyle}>
          <BookBackCover archive={archive} settings={settings} messages={messages} />
        </section>
      ) : null}
    </div>
  )
}