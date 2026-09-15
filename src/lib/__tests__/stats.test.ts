import { describe, expect, it } from 'vitest'
import { coefficientOfVariation, mean, standardDeviation, timeInRange } from '../stats'

describe('mean', () => {
  it('returns null for empty input', () => {
    expect(mean([])).toBeNull()
  })
  it('computes the arithmetic mean', () => {
    expect(mean([100, 200, 300])).toBe(200)
  })
})

describe('standardDeviation', () => {
  it('returns null with fewer than 2 values', () => {
    expect(standardDeviation([100])).toBeNull()
  })
  it('matches a known sample standard deviation', () => {
    // sample sd of [2,4,4,4,5,5,7,9] is 2.13809...
    const sd = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])
    expect(sd).toBeCloseTo(2.1381, 3)
  })
})

describe('coefficientOfVariation', () => {
  it('is sd/mean * 100', () => {
    const values = [100, 120, 80, 110, 90]
    const cv = coefficientOfVariation(values)
    expect(cv).toBeCloseTo((standardDeviation(values)! / mean(values)!) * 100, 6)
  })
})

describe('timeInRange', () => {
  it('buckets values into below/in/above range', () => {
    const result = timeInRange([60, 90, 100, 190, 200], 70, 180)
    expect(result).not.toBeNull()
    expect(result!.belowRangePct).toBeCloseTo(20)
    expect(result!.inRangePct).toBeCloseTo(40)
    expect(result!.aboveRangePct).toBeCloseTo(40)
  })
  it('returns null for empty input', () => {
    expect(timeInRange([], 70, 180)).toBeNull()
  })
})
