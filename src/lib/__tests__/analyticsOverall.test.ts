import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import { computeOverallAnalytics, MIN_OVERALL_READINGS } from '../analyticsOverall'

function reading(value: number, timestamp: number): GlucoseReading {
  return { value, timestamp, context: 'random', source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

describe('computeOverallAnalytics', () => {
  it('returns all-null with no readings', () => {
    const result = computeOverallAnalytics([])
    expect(result.eligible).toBe(false)
    expect(result.mean).toBeNull()
  })

  it('is ineligible below the minimum reading count, but still computes values', () => {
    const readings = Array.from({ length: MIN_OVERALL_READINGS - 1 }, (_, i) => reading(100, Date.now() + i))
    const result = computeOverallAnalytics(readings)
    expect(result.eligible).toBe(false)
    expect(result.mean).toBe(100)
  })

  it('is eligible once the minimum is met', () => {
    const readings = Array.from({ length: MIN_OVERALL_READINGS }, (_, i) => reading(100, Date.now() + i))
    expect(computeOverallAnalytics(readings).eligible).toBe(true)
  })

  it('computes mean/median/range/sd correctly', () => {
    const now = Date.now()
    const readings = [90, 100, 110, 120, 130].map((v, i) => reading(v, now + i * 1000))
    const result = computeOverallAnalytics(readings)
    expect(result.mean).toBe(110)
    expect(result.median).toBe(110)
    expect(result.range).toEqual({ min: 90, max: 130 })
    expect(result.sd).toBeCloseTo(15.81, 1)
  })

  it('computes GMI from the mean via the ADAG formula', () => {
    const now = Date.now()
    const readings = [100, 100].map((v, i) => reading(v, now + i))
    const result = computeOverallAnalytics(readings)
    expect(result.gmi).toBeCloseTo((100 + 46.7) / 28.7, 5)
  })

  it('reports date range from min/max timestamps', () => {
    const day0 = Date.parse('2025-09-01T12:00:00')
    const day5 = Date.parse('2025-09-06T12:00:00')
    const readings = [reading(100, day5), reading(100, day0)]
    const result = computeOverallAnalytics(readings)
    expect(result.dateRangeStart).toBe('2025-09-01')
    expect(result.dateRangeEnd).toBe('2025-09-06')
  })

  it('partitions the distribution into the 4 standard bands', () => {
    const now = Date.now()
    const readings = [60, 85, 110, 140].map((v, i) => reading(v, now + i))
    const result = computeOverallAnalytics(readings)
    const total = result.distribution!.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(4)
  })
})
