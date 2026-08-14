import { describe, expect, it } from 'vitest'
import {
  calculateEffectiveDpi,
  classifyPhotoQuality,
} from './photo-preflight'

describe('photo preflight', () => {
  it('calculates effective DPI for a contained landscape image', () => {
    const result = calculateEffectiveDpi({
      naturalWidth: 3000,
      naturalHeight: 2000,
      boxWidth: 480,
      boxHeight: 480,
      objectFit: 'contain',
    })

    expect(result).toEqual({
      dpi: 600,
      printWidthMm: 127,
      printHeightMm: 84.7,
    })
  })

  it('uses the cover scale when an image is intentionally cropped', () => {
    const contained = calculateEffectiveDpi({
      naturalWidth: 2400,
      naturalHeight: 1600,
      boxWidth: 400,
      boxHeight: 400,
      objectFit: 'contain',
    })
    const covered = calculateEffectiveDpi({
      naturalWidth: 2400,
      naturalHeight: 1600,
      boxWidth: 400,
      boxHeight: 400,
      objectFit: 'cover',
    })

    expect(covered!.dpi).toBeLessThan(contained!.dpi)
    expect(covered).toMatchObject({
      printWidthMm: 105.8,
      printHeightMm: 105.8,
    })
  })

  it('classifies standard print quality thresholds', () => {
    expect(classifyPhotoQuality(300)).toBe('excellent')
    expect(classifyPhotoQuality(299)).toBe('acceptable')
    expect(classifyPhotoQuality(180)).toBe('acceptable')
    expect(classifyPhotoQuality(179)).toBe('insufficient')
    expect(classifyPhotoQuality(null)).toBe('unavailable')
  })

  it('rejects incomplete dimensions', () => {
    expect(calculateEffectiveDpi({
      naturalWidth: 0,
      naturalHeight: 1200,
      boxWidth: 400,
      boxHeight: 300,
      objectFit: 'contain',
    })).toBeNull()
  })

})