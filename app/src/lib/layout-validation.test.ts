import { describe, expect, it } from 'vitest'
import { isRectContained } from './layout-validation'

const page = { top: 0, right: 148, bottom: 210, left: 0 }

describe('isRectContained', () => {
  it('accepts a rectangle entirely inside a page', () => {
    expect(
      isRectContained({ top: 12, right: 136, bottom: 198, left: 12 }, page),
    ).toBe(true)
  })

  it('rejects a rectangle crossing any page edge', () => {
    expect(
      isRectContained({ top: 12, right: 149.1, bottom: 198, left: 12 }, page),
    ).toBe(false)
    expect(
      isRectContained({ top: -1.1, right: 136, bottom: 198, left: 12 }, page),
    ).toBe(false)
  })

  it('allows sub-pixel rounding within the default tolerance', () => {
    expect(
      isRectContained({ top: -0.5, right: 148.5, bottom: 210.5, left: -0.5 }, page),
    ).toBe(true)
  })
})