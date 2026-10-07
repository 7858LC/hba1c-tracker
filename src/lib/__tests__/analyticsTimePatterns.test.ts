import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import {
  computeDayOfWeekAnalytics,
  computeHourlyAnalytics,
  computeTimeOfDayAnalytics,
  MIN_BAND_READINGS,
  MIN_DOW_READINGS,
} from '../analyticsTimePatterns'

function readingAt(value: number, year: number, month: number, day: number, hour: number, minute = 0): GlucoseReading {
  const d = new Date(year, month - 1, day, hour, minute)
  return { value, timestamp: d.getTime(), context: 'random', source: 'manual', createdAt: d.getTime(), updatedAt: d.getTime() }
}

describe('computeTimeOfDayAnalytics', () => {
  it('buckets readings into the correct 7 bands', () => {
    const readings = [
      readingAt(80, 2025, 9, 20, 2), // 12am-6am
      readingAt(90, 2025, 9, 20, 7), // 6am-9am
      readingAt(100, 2025, 9, 20, 10), // 9am-12pm
      readingAt(110, 2025, 9, 20, 13), // 12pm-3pm
      readingAt(120, 2025, 9, 20, 16), // 3pm-6pm
      readingAt(130, 2025, 9, 20, 19), // 6pm-9pm
      readingAt(140, 2025, 9, 20, 22), // 9pm-12am
    ]
    const result = computeTimeOfDayAnalytics(readings)
    expect(result.every((b) => b.readingCount === 1)).toBe(true)
  })

  it('marks a band ineligible below the minimum sample size', () => {
    const readings = [readingAt(90, 2025, 9, 20, 7)]
    const result = computeTimeOfDayAnalytics(readings)
    expect(result.find((b) => b.label === '6AM-9AM')!.eligible).toBe(false)
  })

  it('marks a band eligible once it meets the minimum', () => {
    const readings = Array.from({ length: MIN_BAND_READINGS }, (_, i) => readingAt(90 + i, 2025, 9, 20 + i, 7))
    const result = computeTimeOfDayAnalytics(readings)
    expect(result.find((b) => b.label === '6AM-9AM')!.eligible).toBe(true)
  })

  it('hour boundaries are handled correctly (9:00 goes to the 9am-12pm band, not 6-9am)', () => {
    const readings = [readingAt(100, 2025, 9, 20, 9, 0)]
    const result = computeTimeOfDayAnalytics(readings)
    expect(result.find((b) => b.label === '9AM-12PM')!.readingCount).toBe(1)
    expect(result.find((b) => b.label === '6AM-9AM')!.readingCount).toBe(0)
  })
})

describe('computeHourlyAnalytics', () => {
  it('returns 24 hourly entries', () => {
    expect(computeHourlyAnalytics([])).toHaveLength(24)
  })

  it('groups by exact hour', () => {
    const readings = [readingAt(100, 2025, 9, 20, 7, 15), readingAt(110, 2025, 9, 20, 7, 45)]
    const result = computeHourlyAnalytics(readings)
    expect(result.find((h) => h.hour === 7)!.readingCount).toBe(2)
    expect(result.find((h) => h.hour === 7)!.mean).toBe(105)
  })
})

describe('computeDayOfWeekAnalytics', () => {
  it('returns 7 days with correct labels', () => {
    const result = computeDayOfWeekAnalytics([])
    expect(result.map((d) => d.day)).toEqual([
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ])
  })

  it('suppresses a day with an inadequate sample', () => {
    const readings = [readingAt(100, 2025, 9, 22, 8)] // a Monday
    const result = computeDayOfWeekAnalytics(readings)
    const monday = result.find((d) => d.day === 'Monday')!
    expect(monday.readingCount).toBe(1)
    expect(monday.eligible).toBe(false)
  })

  it('marks a day eligible once enough readings fall on it', () => {
    const readings = Array.from({ length: MIN_DOW_READINGS }, (_, i) => readingAt(100 + i, 2025, 9, 22 + i * 7, 8))
    const result = computeDayOfWeekAnalytics(readings)
    expect(result.find((d) => d.day === 'Monday')!.eligible).toBe(true)
  })
})
