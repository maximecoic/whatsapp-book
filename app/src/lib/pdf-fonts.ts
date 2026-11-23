import { Font } from '@react-pdf/renderer'
import robotoBoldUrl from 'roboto-fontface/fonts/roboto/Roboto-Bold.woff?url'
import robotoMediumUrl from 'roboto-fontface/fonts/roboto/Roboto-Medium.woff?url'
import robotoRegularUrl from 'roboto-fontface/fonts/roboto/Roboto-Regular.woff?url'
import robotoSlabBoldUrl from 'roboto-fontface/fonts/roboto-slab/Roboto-Slab-Bold.woff?url'
import robotoSlabRegularUrl from 'roboto-fontface/fonts/roboto-slab/Roboto-Slab-Regular.woff?url'
import notoEmojiUrl from '@fontsource/noto-emoji/files/noto-emoji-emoji-400-normal.woff?url'
import notoSymbolsUrl from '@fontsource/noto-sans-symbols/files/noto-sans-symbols-symbols-400-normal.woff?url'
import notoSymbols2Url from '@fontsource/noto-sans-symbols-2/files/noto-sans-symbols-2-symbols-400-normal.woff?url'
import notoArabicUrl from '@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff?url'
import notoHebrewUrl from '@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff?url'
import notoJapaneseUrl from '@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff?url'
import type { BookFontPair } from './book-style'

Font.register({
  family: 'Chatbound Sans',
  fonts: [
    { src: robotoRegularUrl, fontWeight: 400 },
    { src: robotoMediumUrl, fontWeight: 500 },
    { src: robotoBoldUrl, fontWeight: 700 },
  ],
})
Font.register({
  family: 'Chatbound Serif',
  fonts: [
    { src: robotoSlabRegularUrl, fontWeight: 400 },
    { src: robotoSlabBoldUrl, fontWeight: 700 },
  ],
})

Font.register({ family: 'Chatbound Symbols', src: notoSymbolsUrl })
Font.register({ family: 'Chatbound Symbols 2', src: notoSymbols2Url })
Font.register({ family: 'Chatbound Emoji', src: notoEmojiUrl })
Font.register({ family: 'Chatbound Arabic', src: notoArabicUrl })
Font.register({ family: 'Chatbound Hebrew', src: notoHebrewUrl })
Font.register({ family: 'Chatbound Japanese', src: notoJapaneseUrl })

export async function preparePdfFonts(): Promise<void> {
  const descriptor = { fontFamily: 'Chatbound Symbols' }
  await Font.load(descriptor)
  const font = Font.getFont(descriptor).data
  if (!font) throw new Error('La police PDF des symboles ne peut pas être chargée.')
  const hasGlyph = font.hasGlyphForCodePoint.bind(font)
  font.hasGlyphForCodePoint = (codePoint: number) => codePoint === 0x0a || hasGlyph(codePoint)
}

export function pdfFontFamily(primary: string): string[] {
  return [primary, 'Chatbound Symbols', 'Chatbound Emoji', 'Chatbound Symbols 2', 'Chatbound Arabic', 'Chatbound Hebrew', 'Chatbound Japanese']
}

export function getPdfFontFamilies(fontPair: BookFontPair) {
  switch (fontPair) {
    case 'literary':
      return { heading: pdfFontFamily('Chatbound Serif'), body: pdfFontFamily('Chatbound Serif') }
    case 'modern':
      return { heading: pdfFontFamily('Chatbound Sans'), body: pdfFontFamily('Chatbound Sans') }
    case 'correspondence':
      return { heading: pdfFontFamily('Chatbound Sans'), body: pdfFontFamily('Chatbound Serif') }
    default:
      return { heading: pdfFontFamily('Chatbound Serif'), body: pdfFontFamily('Chatbound Sans') }
  }
}