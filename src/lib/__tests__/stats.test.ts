import { describe, expect, it } from 'vitest'
import {
  bandDistribution,
  coefficientOfVariation,
  mean,
  median,
  range,
  standardDeviation,
  thresholdPercentages,
  timeInRange,
} from '../stats'

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

describe('median', () => {
  it('returns null for empty input', () => {
    expect(median([])).toBeNull()
  })
  it('is the middle value for odd-length input', () => {
    expect(median([5, 1, 3])).toBe(3)
  })
  it('averages the two middle values for even-length input', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('does not mutate the input array', () => {
    const values = [3, 1, 2]
    median(values)
    expect(values).toEqual([3, 1, 2])
  })
})

describe('range', () => {
  it('returns null for empty input', () => {
    expect(range([])).toBeNull()
  })
  it('returns min and max', () => {
    expect(range([5, 1, 9, 3])).toEqual({ min: 1, max: 9 })
  })
})

describe('bandDistribution', () => {
  const bands = [
    { label: 'low', min: 0, max: 69 },
    { label: 'normal', min: 70, max: 99 },
    { label: 'elevated', min: 100, max: 125 },
    { label: 'high', min: 126, max: null },
  ]

  it('partitions values so every value falls in exactly one band', () => {
    const values = [65, 85, 110, 140, 70, 99, 100, 125, 126]
    const result = bandDistribution(values, bands)!
    const totalCount = result.reduce((s, b) => s + b.count, 0)
    expect(totalCount).toBe(values.length)
  })

  it('computes correct percentages', () => {
    const values = [65, 85, 85, 140]
    const result = bandDistribution(values, bands)!
    expect(result.find((b) => b.label === 'low')!.pct).toBe(25)
    expect(result.find((b) => b.label === 'normal')!.pct).toBe(50)
    expect(result.find((b) => b.label === 'high')!.pct).toBe(25)
  })

  it('returns null for empty input', () => {
    expect(bandDistribution([], bands)).toBeNull()
  })
})

describe('thresholdPercentages', () => {
  it('computes cumulative % at or above each threshold', () => {
    const values = [90, 100, 110, 120, 130]
    const result = thresholdPercentages(values, [100, 110, 126])!
    expect(result.find((t) => t.threshold === 100)!.pct).toBe(80) // 4 of 5 >= 100
    expect(result.find((t) => t.threshold === 110)!.pct).toBe(60) // 3 of 5
    expect(result.find((t) => t.threshold === 126)!.pct).toBe(20) // 1 of 5 (130)
  })

  it('returns null for empty input', () => {
    expect(thresholdPercentages([], [100])).toBeNull()
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
