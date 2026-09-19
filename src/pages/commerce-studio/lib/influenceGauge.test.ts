import { describe, expect, it } from 'vitest'
import { getInfluenceGauge } from './influenceGauge'

describe('INFL gauge', () => {
  it('awards three percent per vote through the first ten votes', () => {
    expect(getInfluenceGauge(0)).toBe(0)
    expect(getInfluenceGauge(1)).toBe(3)
    expect(getInfluenceGauge(5)).toBe(15)
    expect(getInfluenceGauge(10)).toBe(30)
  })

  it('slows down after ten votes and reaches 99 percent at one thousand', () => {
    expect(getInfluenceGauge(20)).toBe(40)
    expect(getInfluenceGauge(100)).toBe(65)
    expect(getInfluenceGauge(500)).toBe(89)
    expect(getInfluenceGauge(1000)).toBe(99)
    expect(getInfluenceGauge(5000)).toBe(99)
  })
})
