import type {
  ChatMessage,
  DateOrder,
  MessageKind,
  ParsedChat,
  ParseOptions,
} from './chat-types'

const DIRECTIONAL_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g
const DATE_PART = '(\\d{1,4}[./-]\\d{1,2}[./-]\\d{1,4})'
const TIME_PART = '(\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[ap]\\.?m\\.?)?)'
const IOS_HEADER = new RegExp(`^\\[${DATE_PART}\\s+${TIME_PART}\\]\\s*(.*)$`, 'i')
const ANDROID_HEADER = new RegExp(`^${DATE_PART},?\\s+${TIME_PART}\\s+-\\s+(.*)$`, 'i')
const SENDER_AND_BODY = /^(.{1,120}?):(?:\s|$)([\s\S]*)$/
const MEDIA_EXTENSIONS =
  'jpe?g|png|webp|heic|gif|mp4|mov|m4v|avi|opus|ogg|m4a|mp3|wav|pdf'
const ANGLE_ATTACHMENT = new RegExp(
  `<\\s*[^:>]+:\\s*([^>]+\\.(?:${MEDIA_EXTENSIONS}))\\s*>`,
  'i',
)
const PAREN_ATTACHMENT = new RegExp(
  `([^\\n<>]+?\\.(?:${MEDIA_EXTENSIONS}))\\s+\\((?:file attached|fichier joint)\\)`,
  'i',
)
const GENERIC_MEDIA_NAME = new RegExp(
  `((?:IMG|VID|AUD|PTT|STK|DOC|PHOTO|[0-9]{6,})[-\\w .@()+']*\\.(?:${MEDIA_EXTENSIONS}))`,
  'i',
)

interface MessageHeader {
  timestamp: number
  sender: string | null
  body: string
}

interface MessageDraft extends MessageHeader {
  sourceLine: number
}

function cleanDirectionalMarks(value: string): string {
  return value.replace(DIRECTIONAL_MARKS, '')
}

function normalizeYear(value: number): number {
  if (value >= 100) return value
  return value >= 70 ? value + 1900 : value + 2000
}

function parseTimestamp(
  datePart: string,
  timePart: string,
  dateOrder: DateOrder,
): number | null {
  const parts = datePart.split(/[./-]/).map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null

  let year: number
  let month: number
  let day: number

  if (datePart.split(/[./-]/)[0].length === 4) {
    ;[year, month, day] = parts
  } else {
    const resolvedOrder =
      dateOrder === 'auto'
        ? parts[0] > 12
          ? 'dmy'
          : parts[1] > 12
            ? 'mdy'
            : 'dmy'
        : dateOrder

    if (resolvedOrder === 'mdy') {
      ;[month, day, year] = parts
    } else {
      ;[day, month, year] = parts
    }
  }

  year = normalizeYear(year)
  const timeMatch = timePart
    .toLowerCase()
    .replaceAll('.', '')
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?$/)
  if (!timeMatch) return null

  let hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  const second = Number(timeMatch[3] ?? 0)
  const meridiem = timeMatch[4]

  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0

  const date = new Date(year, month - 1, day, hour, minute, second)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null
  }

  return date.getTime()
}

function parseHeader(line: string, dateOrder: DateOrder): MessageHeader | null {
  const cleanedLine = cleanDirectionalMarks(line)
  const match = cleanedLine.match(IOS_HEADER) ?? cleanedLine.match(ANDROID_HEADER)
  if (!match) return null

  const timestamp = parseTimestamp(match[1], match[2], dateOrder)
  if (timestamp === null) return null

  const remainder = match[3]
  const messageMatch = remainder.match(SENDER_AND_BODY)
  if (!messageMatch) {
    return { timestamp, sender: null, body: remainder.trim() }
  }

  return {
    timestamp,
    sender: messageMatch[1].trim(),
    body: messageMatch[2],
  }
}

function extractMedia(body: string): { body: string; mediaName: string | null } {
  const attachmentMatch =
    body.match(ANGLE_ATTACHMENT) ??
    body.match(PAREN_ATTACHMENT) ??
    body.match(GENERIC_MEDIA_NAME)

  if (!attachmentMatch) return { body: body.trim(), mediaName: null }

  const mediaName = attachmentMatch[1].trim()
  const cleanedBody = body.replace(attachmentMatch[0], '').trim()
  return { body: cleanedBody, mediaName }
}

function classifyMessage(body: string, mediaName: string | null): MessageKind {
  if (mediaName) return 'media'

  const normalized = body.toLocaleLowerCase()
  if (
    /ce message a été supprimé|this message was deleted|you deleted this message/.test(
      normalized,
    )
  ) {
    return 'deleted'
  }

  if (
    /<media omitted>|(?:image|photo|vid[eé]o|audio|sticker|m[eé]dia).*(?:omitted|absent|manquant|non inclus)/.test(
      normalized,
    )
  ) {
    return 'missing-media'
  }

  if (
    /chiffr[eé]s? de bout en bout|end-to-end encrypted|a cr[eé][eé] ce groupe|created (?:this|the) group|vous a ajout[eé]|vous avez ajout[eé]|you added|a ajout[eé]| added |est parti| left$|vous êtes désormais admin|vous avez chang[eé]|you changed|changed (?:the )?(?:group|settings)|a chang[eé] les param[eè]tres/.test(
      normalized,
    )
  ) {
    return 'system'
  }

  return 'message'
}

export function parseWhatsAppChat(
  source: string,
  options: ParseOptions = {},
): ParsedChat {
  const dateOrder = options.dateOrder ?? 'auto'
  const lines = source.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')
  const messages: ChatMessage[] = []
  const participants: string[] = []
  const seenParticipants = new Set<string>()
  const warnings: string[] = []
  let draft: MessageDraft | null = null

  const commitDraft = () => {
    if (!draft) return

    const extracted = extractMedia(cleanDirectionalMarks(draft.body))
    const kind = classifyMessage(extracted.body, extracted.mediaName)
    const message: ChatMessage = {
      id: `message-${messages.length + 1}`,
      timestamp: draft.timestamp,
      sender: draft.sender,
      body: extracted.body,
      mediaName: extracted.mediaName,
      kind,
    }
    messages.push(message)

    if (
      message.sender &&
      kind !== 'system' &&
      !seenParticipants.has(message.sender)
    ) {
      seenParticipants.add(message.sender)
      participants.push(message.sender)
    }
  }

  lines.forEach((line, index) => {
    const header = parseHeader(line, dateOrder)
    if (header) {
      commitDraft()
      draft = { ...header, sourceLine: index + 1 }
      return
    }

    if (draft) {
      draft.body += `\n${line}`
    } else if (line.trim()) {
      warnings.push(`Ligne ${index + 1} ignorée avant le premier message.`)
    }
  })
  commitDraft()

  return {
    messages,
    participants,
    startTimestamp: messages.at(0)?.timestamp ?? null,
    endTimestamp: messages.at(-1)?.timestamp ?? null,
    mediaReferences: messages.filter((message) => message.mediaName).length,
    warnings,
  }
}