import { afterEach, describe, expect, it, vi } from 'vitest'
import { Document, Font, Page, Text, pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib'
import { directPdfFileName, inspectPdfFonts, pdfImageScale, renderPdfInWorker, type DirectPdfWorkerRequest } from './direct-pdf-export'
import { getPdfFontFamilies, pdfFontFamily, preparePdfFonts } from './pdf-fonts'
import { getPdfCoverImageBox } from './pdf-image-layout'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('direct PDF export', () => {
  it('renders multiline Unicode text with embedded fallback fonts', async () => {
    const sources = pdfFontFamily('Chatbound Sans').flatMap((family) => Font.getRegisteredFonts()[family].sources)
    const originalUrls = sources.map((source) => source.src)
    try {
      sources.forEach((source) => {
        const packagePath = source.src.match(/(?:@fontsource|roboto-fontface)\/.+?\.woff/)?.[0]
        if (!packagePath) throw new Error(`Police de test introuvable : ${source.src}`)
        source.src = decodeURIComponent(new URL(`../../node_modules/${packagePath}`, import.meta.url).pathname)
      })
      await preparePdfFonts()
      const body = 'Bonjour à bientôt ! → ★ ✓ ①\n😀 ❤️ 🥰 ☀️ 🇫🇷\nשלום مرحبا 東京'
      const document = createElement(Document, null,
        createElement(Page, { size: 'A4' },
          createElement(Text, { style: { fontFamily: pdfFontFamily('Chatbound Sans') } }, body),
        ),
      )
      const blob = await pdf(document).toBlob()
      const result = await inspectPdfFonts(blob)
      expect(result.missing).toEqual([])
      for (const name of ['Roboto', 'NotoEmoji', 'NotoSansSymbols', 'NotoSansArabic', 'NotoSansHebrew', 'NotoSansJP']) {
        expect(result.embedded.some((font) => font.includes(name))).toBe(true)
      }
      const unsupportedDocument = createElement(Document, null,
        createElement(Page, { size: 'A4' },
          createElement(Text, { style: { fontFamily: pdfFontFamily('Chatbound Sans') } }, '\u2d30'),
        ),
      )
      const unsupported = await inspectPdfFonts(await pdf(unsupportedDocument).toBlob())
      expect(unsupported.missing).toContain('Helvetica')
    } finally {
      sources.forEach((source, index) => { source.src = originalUrls[index] })
    }
  })

  it('uses registered embeddable Unicode fonts before the built-in Helvetica fallback', () => {
    const fallbacks = pdfFontFamily('Chatbound Sans').slice(1)
    expect(fallbacks).toEqual(['Chatbound Symbols', 'Chatbound Emoji', 'Chatbound Symbols 2', 'Chatbound Arabic', 'Chatbound Hebrew', 'Chatbound Japanese'])
    fallbacks.forEach((family) => {
      const font = Font.getRegisteredFonts()[family]
      expect(font.sources.length).toBeGreaterThan(0)
      expect(font.sources.every((source) => source.src !== 'Helvetica')).toBe(true)
    })
  })

  it('terminates the worker when the user cancels', async () => {
    const terminate = vi.fn()
    vi.stubGlobal('Worker', class { terminate = terminate; postMessage() {} })
    const controller = new AbortController()
    const promise = renderPdfInWorker({} as DirectPdfWorkerRequest, controller.signal)
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(terminate).toHaveBeenCalledOnce()
  })

  it('fails explicitly instead of leaving a stalled export running forever', async () => {
    vi.useFakeTimers()
    const terminate = vi.fn()
    vi.stubGlobal('Worker', class { terminate = terminate; postMessage() {} })
    const promise = renderPdfInWorker({} as DirectPdfWorkerRequest)
    const failure = expect(promise).rejects.toThrow('10 minutes')
    await vi.advanceTimersByTimeAsync(600_000)
    await failure
    expect(terminate).toHaveBeenCalledOnce()
  })

  it('retains a print-resolution margin and never enlarges low-resolution photos', () => {
    expect(pdfImageScale(6000, 4000, 660, 3508)).toBeCloseTo(0.5)
    expect(pdfImageScale(1000, 800, 200, 3508)).toBe(1)
    expect(pdfImageScale(6000, 4000, null, 3000)).toBe(0.5)
  })

  it('detects every embedded and non-embedded font in compressed PDF resources', async () => {
    const document = await PDFDocument.create()
    const page = document.addPage()
    const standard = await document.embedFont(StandardFonts.Helvetica)
    page.drawText('Non intégrée', { font: standard })
    const fontProgram = document.context.register(document.context.flateStream(new Uint8Array([0, 1, 2])))
    const descriptor = document.context.register(document.context.obj({ Type: 'FontDescriptor', FontFile2: fontProgram }))
    const font = document.context.register(document.context.obj({ Type: 'Font', Subtype: 'TrueType', BaseFont: 'EmbeddedTest', FontDescriptor: descriptor }))
    page.node.setFontDictionary(PDFName.of('FEmbedded'), font)
    const bytes = await document.save()
    const result = await inspectPdfFonts(new Blob([bytes.slice().buffer as ArrayBuffer]))
    expect(result.embedded).toContain('EmbeddedTest')
    expect(result.missing).toContain('Helvetica')
  })

  it('rejects a completed worker PDF when a referenced font is not embedded', async () => {
    const document = await PDFDocument.create()
    const page = document.addPage()
    page.drawText('Sans police incorporée', { font: await document.embedFont(StandardFonts.Helvetica) })
    const bytes = await document.save()
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' })
    const terminate = vi.fn()
    vi.stubGlobal('Worker', class {
      onmessage?: (event: { data: { type: 'complete'; blob: Blob } }) => void
      terminate = terminate
      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: { type: 'complete', blob } }))
      }
    })
    await expect(renderPdfInWorker({} as DirectPdfWorkerRequest))
      .rejects.toThrow('Polices non incorporées : Helvetica')
    expect(terminate).toHaveBeenCalledOnce()
  })

  it('maps every visual font pair to registered embeddable PDF families', () => {
    expect(getPdfFontFamilies('editorial')).toEqual({ heading: pdfFontFamily('Chatbound Serif'), body: pdfFontFamily('Chatbound Sans') })
    expect(getPdfFontFamilies('literary')).toEqual({ heading: pdfFontFamily('Chatbound Serif'), body: pdfFontFamily('Chatbound Serif') })
    expect(getPdfFontFamilies('modern')).toEqual({ heading: pdfFontFamily('Chatbound Sans'), body: pdfFontFamily('Chatbound Sans') })
    expect(getPdfFontFamilies('correspondence')).toEqual({ heading: pdfFontFamily('Chatbound Sans'), body: pdfFontFamily('Chatbound Serif') })
  })

  it('swaps and centers the cover image box for quarter-turn rotations', () => {
    expect(getPdfCoverImageBox(148, 210, 0)).toMatchObject({ width: 148, height: 210, left: 0, top: 0 })
    expect(getPdfCoverImageBox(148, 210, 90)).toMatchObject({ width: 210, height: 148, left: -31, top: 31 })
    expect(getPdfCoverImageBox(210, 148, 270)).toMatchObject({ width: 148, height: 210, left: 31, top: -31 })
  })

  it('creates a portable ASCII PDF filename', () => {
    expect(directPdfFileName('Été à São Paulo')).toBe('ete-a-sao-paulo.pdf')
  })

  it('falls back to a stable book filename', () => {
    expect(directPdfFileName('---')).toBe('livre-chatbound.pdf')
  })
})