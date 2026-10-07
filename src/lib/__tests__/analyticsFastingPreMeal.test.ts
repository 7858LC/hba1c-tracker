import { describe, expect, it } from 'vitest'
import type { GlucoseReading, SleepEntry } from '../../types'
import {
  computeFastingAnalytics,
  computeFastingByHydration,
  computePreMealAnalytics,
  computeTrend,
  MIN_FASTING_READINGS,
  MIN_HYDRATION_BUCKET_READINGS,
  MIN_PRE_MEAL_READINGS,
} from '../analyticsFastingPreMeal'

const DAY_MS = 24 * 3600_000

function reading(
  value: number,
  timestamp: number,
  context: GlucoseReading['context'] = 'fasting',
): GlucoseReading {
  return { value, timestamp, context, source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

describe('computeTrend', () => {
  it('returns null with fewer than 2 points', () => {
    expect(computeTrend([{ timestamp: Date.now(), value: 100 }])).toBeNull()
  })

  it('detects a rising trend', () => {
    const now = Date.now()
    const points = Array.from({ length: 10 }, (_, i) => ({ timestamp: now + i * DAY_MS, value: 90 + i * 2 }))
    const result = computeTrend(points)!
    expect(result.direction).toBe('rising')
    expect(result.slopePerDay).toBeGreaterThan(0)
  })

  it('detects a falling trend', () => {
    const now = Date.now()
    const points = Array.from({ length: 10 }, (_, i) => ({ timestamp: now + i * DAY_MS, value: 120 - i * 2 }))
    const result = computeTrend(points)!
    expect(result.direction).toBe('falling')
  })

  it('detects a flat trend for noise-only data', () => {
    const now = Date.now()
    const points = [100, 101, 99, 100, 100].map((v, i) => ({ timestamp: now + i * DAY_MS, value: v }))
    expect(computeTrend(points)!.direction).toBe('flat')
  })
})

describe('computeFastingAnalytics', () => {
  it('returns all-null when there is no fasting data', () => {
    const result = computeFastingAnalytics([reading(100, Date.now(), 'random')], [])
    expect(result.eligible).toBe(false)
    expect(result.mean).toBeNull()
  })

  it('is eligible once the minimum fasting count is met', () => {
    const now = Date.now()
    const readings = Array.from({ length: MIN_FASTING_READINGS }, (_, i) => reading(100, now + i * DAY_MS))
    expect(computeFastingAnalytics(readings, []).eligible).toBe(true)
  })

  it('computes mean/median/range/sd and threshold percentages', () => {
    const now = Date.now()
    const readings = [90, 100, 110, 120, 130].map((v, i) => reading(v, now + i * DAY_MS))
    const result = computeFastingAnalytics(readings, [])
    expect(result.mean).toBe(110)
    expect(result.median).toBe(110)
    expect(result.range).toEqual({ min: 90, max: 130 })
    expect(result.pctAtOrAbove100).toBe(80) // 4 of 5
    expect(result.pctAtOrAbove126).toBe(20) // 1 of 5
  })

  it('uses only the single earliest reading per day for earliestOfDayMean', () => {
    const day0 = Date.parse('2025-09-20T00:00:00')
    const readings = [
      reading(90, day0 + 6 * 3600_000), // 6am, earliest
      reading(110, day0 + 11 * 3600_000), // 11am, same day, later
      reading(100, day0 + DAY_MS + 7 * 3600_000), // next day
    ]
    const result = computeFastingAnalytics(readings, [])
    expect(result.earliestOfDayCount).toBe(2)
    expect(result.earliestOfDayMean).toBe((90 + 100) / 2)
  })

  it('computes avgMinutesAfterWaking only over readings with a resolvable wake time', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const sleepEntries: SleepEntry[] = [
      { date: '2025-09-20', durationMinutes: 420, wasoMinutes: 10, wakeTimestamp: wake, createdAt: 0, updatedAt: 0 },
    ]
    const readings = [
      reading(90, wake + 10 * 60_000), // 10 min after waking
      reading(95, Date.parse('2020-01-01T00:00:00')), // no relevant wake time -> excluded
    ]
    const result = computeFastingAnalytics(readings, sleepEntries)
    expect(result.minutesAfterWakingCount).toBe(1)
    expect(result.avgMinutesAfterWaking).toBe(10)
  })
})

describe('computeFastingByHydration', () => {
  function hydratedReading(value: number, timestamp: number, hydrationStatus: 'low' | 'normal' | 'high'): GlucoseReading {
    return { ...reading(value, timestamp, 'fasting'), hydrationStatus }
  }

  it('returns all 3 statuses even with no data', () => {
    const result = computeFastingByHydration([])
    expect(result.map((b) => b.status)).toEqual(['low', 'normal', 'high'])
  })

  it('ignores fasting readings with no hydration status recorded', () => {
    const readings = [reading(100, Date.now(), 'fasting')] // no hydrationStatus
    const result = computeFastingByHydration(readings)
    expect(result.every((b) => b.readingCount === 0)).toBe(true)
  })

  it('ignores non-fasting readings even if tagged with hydration status', () => {
    const now = Date.now()
    const readings = [{ ...hydratedReading(100, now, 'low'), context: 'pre_meal' as const }]
    const result = computeFastingByHydration(readings)
    expect(result.every((b) => b.readingCount === 0)).toBe(true)
  })

  it('groups fasting readings by their own hydration status', () => {
    const now = Date.now()
    const readings = [
      hydratedReading(110, now, 'low'),
      hydratedReading(100, now + DAY_MS, 'normal'),
      hydratedReading(95, now + 2 * DAY_MS, 'high'),
    ]
    const result = computeFastingByHydration(readings)
    expect(result.find((b) => b.status === 'low')!.mean).toBe(110)
    expect(result.find((b) => b.status === 'normal')!.mean).toBe(100)
    expect(result.find((b) => b.status === 'high')!.mean).toBe(95)
  })

  it('marks a bucket eligible once it meets the minimum', () => {
    const now = Date.now()
    const readings = Array.from({ length: MIN_HYDRATION_BUCKET_READINGS }, (_, i) =>
      hydratedReading(100 + i, now + i * DAY_MS, 'low'),
    )
    const result = computeFastingByHydration(readings)
    expect(result.find((b) => b.status === 'low')!.eligible).toBe(true)
  })
})

describe('computePreMealAnalytics', () => {
  it('is ineligible with no pre-meal data', () => {
    expect(computePreMealAnalytics([]).eligible).toBe(false)
  })

  it('is eligible once the minimum is met', () => {
    const now = Date.now()
    const readings = Array.from({ length: MIN_PRE_MEAL_READINGS }, (_, i) =>
      reading(90, now + i * DAY_MS, 'pre_meal'),
    )
    expect(computePreMealAnalytics(readings).eligible).toBe(true)
  })

  it('ignores non-pre_meal readings', () => {
    const now = Date.now()
    const readings = [reading(100, now, 'fasting'), reading(90, now + DAY_MS, 'post_meal_1h')]
    const result = computePreMealAnalytics(readings)
    expect(result.readingCount).toBe(0)
  })
})
