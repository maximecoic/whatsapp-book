import { describe, expect, it } from 'vitest'
import { directPdfFileName } from './direct-pdf-export'

describe('direct PDF export', () => {
  it('creates a portable ASCII PDF filename', () => {
    expect(directPdfFileName('Été à São Paulo')).toBe('ete-a-sao-paulo.pdf')
  })

  it('falls back to a stable book filename', () => {
    expect(directPdfFileName('---')).toBe('livre-chatbound.pdf')
  })
})