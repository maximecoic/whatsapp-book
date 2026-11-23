import { describe, expect, it } from 'vitest'
import { parseWhatsAppChat } from './chat-parser'

describe('parseWhatsAppChat', () => {
  it('parses a French iOS export with multiline text and media', () => {
    const source = [
      '[07/10/2018 13:31:35] Carnet de voyage: \u200eLes messages et les appels sont chiffrés de bout en bout.',
      '[07/10/2018 17:35:02] Lina: Premier paragraphe',
      'Deuxième ligne du même message.',
      '\u200e[15/10/2018 12:43:43] Sam: Une légende \u200e< pièce jointe : 00000014-PHOTO-2018-10-15-12-43-43.jpg >',
      '[16/10/2018 08:00:00] Lina: \u200evidéo absente',
    ].join('\n')

    const chat = parseWhatsAppChat(source)

    expect(chat.messages).toHaveLength(4)
    expect(chat.participants).toEqual(['Lina', 'Sam'])
    expect(chat.messages[0].kind).toBe('system')
    expect(chat.messages[1].body).toBe(
      'Premier paragraphe\nDeuxième ligne du même message.',
    )
    expect(chat.messages[2]).toMatchObject({
      sender: 'Sam',
      body: 'Une légende',
      mediaName: '00000014-PHOTO-2018-10-15-12-43-43.jpg',
      kind: 'media',
    })
    expect(chat.messages[3].kind).toBe('missing-media')
    expect(chat.mediaReferences).toBe(1)
  })

  it('parses an Android export with a 12-hour US timestamp', () => {
    const source = [
      '12/31/23, 9:04 PM - Alex: Happy new year',
      '12/31/23, 9:05 PM - Messages and calls are end-to-end encrypted.',
      '01/01/24, 12:01 AM - Jo: IMG-20240101-WA0001.jpg (file attached)',
    ].join('\n')

    const chat = parseWhatsAppChat(source, { dateOrder: 'mdy' })

    expect(chat.messages).toHaveLength(3)
    expect(chat.messages[0].sender).toBe('Alex')
    expect(new Date(chat.messages[0].timestamp).getHours()).toBe(21)
    expect(chat.messages[1]).toMatchObject({ sender: null, kind: 'system' })
    expect(chat.messages[2]).toMatchObject({
      sender: 'Jo',
      body: '',
      mediaName: 'IMG-20240101-WA0001.jpg',
      kind: 'media',
    })
  })

  it('preserves captions before and after Android video attachments', () => {
    const chat = parseWhatsAppChat([
      '01/01/2024, 10:00 - Lina: Voici notre souvenir VID-20240101-WA0001.mp4 (file attached)',
      '01/01/2024, 10:01 - Lina: VID-20240101-WA0002.mp4 (fichier joint)',
      'Une deuxième légende',
    ].join('\n'))

    expect(chat.messages[0]).toMatchObject({ body: 'Voici notre souvenir', mediaName: 'VID-20240101-WA0001.mp4', kind: 'media' })
    expect(chat.messages[1]).toMatchObject({ body: 'Une deuxième légende', mediaName: 'VID-20240101-WA0002.mp4', kind: 'media' })
  })

  it('keeps a message accompanying an omitted video visible by default', () => {
    const chat = parseWhatsAppChat([
      '[01/01/2024 10:00] Lina: <Média omis>',
      'Un souvenir à conserver',
      '[01/01/2024 10:01] Lina: vidéo absente',
    ].join('\n'))
    expect(chat.messages[0]).toMatchObject({ kind: 'message', body: '<Média omis>\nUn souvenir à conserver' })
    expect(chat.messages[1].kind).toBe('missing-media')
  })

  it('warns about content before the first valid message', () => {
    const chat = parseWhatsAppChat('Entête inconnue\n[01/01/2024 10:00] Alex: Bonjour')

    expect(chat.messages).toHaveLength(1)
    expect(chat.warnings).toHaveLength(1)
  })

  it('recognizes group administration events phrased with vous avez', () => {
    const chat = parseWhatsAppChat(
      '[01/01/2024 10:00] Carnet de voyage: Vous avez ajouté Alex et Sam',
    )

    expect(chat.messages[0].kind).toBe('system')
    expect(chat.participants).toEqual([])
  })
})