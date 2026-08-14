import type { BookSettings } from './book-model'

const PORTABLE_FORMAT = 'chatbound-project'
const PORTABLE_VERSION = 1
export const MAX_PORTABLE_PROJECT_BYTES = 1_000_000

export type PortableProjectErrorCode =
  | 'too-large'
  | 'invalid-json'
  | 'invalid-format'
  | 'unsupported-version'
  | 'invalid-project'

export class PortableProjectError extends Error {
  readonly code: PortableProjectErrorCode

  constructor(
    code: PortableProjectErrorCode,
    message: string,
  ) {
    super(message)
    this.code = code
    this.name = 'PortableProjectError'
  }
}

export interface PortableBookProject {
  format: typeof PORTABLE_FORMAT
  version: typeof PORTABLE_VERSION
  projectId: string
  archiveName: string
  exportedAt: string
  settings: BookSettings
}

export interface PortableProjectSource {
  projectId: string
  archiveName: string
  settings: BookSettings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validProjectId(value: unknown): value is string {
  return typeof value === 'string' && /^chat-[a-z0-9-]{8,120}$/i.test(value)
}

function validArchiveName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    Array.from(value).every((character) => character.codePointAt(0)! >= 32)
  )
}

export function createPortableProject(
  source: PortableProjectSource,
  exportedAt = new Date().toISOString(),
): PortableBookProject {
  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    projectId: source.projectId,
    archiveName: source.archiveName,
    exportedAt,
    settings: structuredClone(source.settings),
  }
}

export function serializePortableProject(
  source: PortableProjectSource,
  exportedAt?: string,
): string {
  const serialized = `${JSON.stringify(createPortableProject(source, exportedAt), null, 2)}\n`
  if (new TextEncoder().encode(serialized).byteLength > MAX_PORTABLE_PROJECT_BYTES) {
    throw new PortableProjectError(
      'too-large',
      'Ce projet dépasse la limite de 1 Mo. Réduisez le nombre ou la longueur des pages personnelles.',
    )
  }
  return serialized
}

export function parsePortableProject(source: string): PortableBookProject {
  if (new TextEncoder().encode(source).byteLength > MAX_PORTABLE_PROJECT_BYTES) {
    throw new PortableProjectError(
      'too-large',
      'Ce fichier projet dépasse la limite de 1 Mo.',
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new PortableProjectError(
      'invalid-json',
      'Ce fichier ne contient pas un projet Chatbound valide.',
    )
  }

  if (!isRecord(parsed) || parsed.format !== PORTABLE_FORMAT) {
    throw new PortableProjectError(
      'invalid-format',
      'Ce fichier n’est pas un projet Chatbound.',
    )
  }
  if (parsed.version !== PORTABLE_VERSION) {
    throw new PortableProjectError(
      'unsupported-version',
      'Cette version de projet n’est pas encore prise en charge.',
    )
  }
  if (
    !validProjectId(parsed.projectId) ||
    !validArchiveName(parsed.archiveName) ||
    typeof parsed.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(parsed.exportedAt)) ||
    !isRecord(parsed.settings) ||
    typeof parsed.settings.title !== 'string'
  ) {
    throw new PortableProjectError(
      'invalid-project',
      'Le projet Chatbound est incomplet ou endommagé.',
    )
  }

  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    projectId: parsed.projectId,
    archiveName: parsed.archiveName,
    exportedAt: parsed.exportedAt,
    settings: parsed.settings as unknown as BookSettings,
  }
}

export function portableProjectFileName(title: string): string {
  const safeName = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${safeName || 'projet-chatbound'}.chatbound`
}