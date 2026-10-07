import { describe, expect, it } from 'vitest'
import type { GlucoseReading, SleepEntry } from '../../types'
import {
  computeGlucoseBySleepDuration,
  computeGlucoseBySleepQuality,
  computeSleepDurationFastingCorrelation,
  MIN_SLEEP_DURATION_BUCKET_READINGS,
} from '../analyticsSleep'

function fastingReading(value: number, timestamp: number): GlucoseReading {
  return { value, timestamp, context: 'fasting', source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

function sleepNight(date: string, durationMinutes: number, sleepQuality?: 1 | 2 | 3 | 4 | 5): SleepEntry {
  return { date, durationMinutes, wasoMinutes: 10, sleepQuality, createdAt: 0, updatedAt: 0 }
}

describe('computeGlucoseBySleepDuration', () => {
  it('groups next-morning fasting glucose by the preceding night duration bucket', () => {
    const night = '2025-09-20'
    const morning = Date.parse('2025-09-21T07:00:00')
    const sleepEntries = [sleepNight(night, 6.5 * 60)] // 6-7h bucket
    const readings = [fastingReading(95, morning)]
    const result = computeGlucoseBySleepDuration(readings, sleepEntries)
    expect(result.find((b) => b.label === '6-7h')!.readingCount).toBe(1)
    expect(result.find((b) => b.label === '6-7h')!.mean).toBe(95)
  })

  it('skips a night with no next-morning fasting reading', () => {
    const sleepEntries = [sleepNight('2025-09-20', 7 * 60)]
    const result = computeGlucoseBySleepDuration([], sleepEntries)
    expect(result.every((b) => b.readingCount === 0)).toBe(true)
  })

  it('marks a bucket eligible once it meets the minimum', () => {
    const sleepEntries: SleepEntry[] = []
    const readings: GlucoseReading[] = []
    for (let i = 0; i < MIN_SLEEP_DURATION_BUCKET_READINGS; i++) {
      const night = `2025-09-${20 + i}`
      const morning = Date.parse(`2025-09-${21 + i}T07:00:00`)
      sleepEntries.push(sleepNight(night, 7.5 * 60))
      readings.push(fastingReading(95 + i, morning))
    }
    const result = computeGlucoseBySleepDuration(readings, sleepEntries)
    expect(result.find((b) => b.label === '7-8h')!.eligible).toBe(true)
  })
})

describe('computeGlucoseBySleepQuality', () => {
  it('groups by preceding-night sleep quality 1-5', () => {
    const night = '2025-09-20'
    const morning = Date.parse('2025-09-21T07:00:00')
    const sleepEntries = [sleepNight(night, 420, 4)]
    const readings = [fastingReading(90, morning)]
    const result = computeGlucoseBySleepQuality(readings, sleepEntries)
    expect(result.find((b) => b.label === 'Quality 4')!.readingCount).toBe(1)
  })

  it('skips nights with no recorded sleep quality', () => {
    const sleepEntries = [sleepNight('2025-09-20', 420)] // no quality
    const readings = [fastingReading(90, Date.parse('2025-09-21T07:00:00'))]
    const result = computeGlucoseBySleepQuality(readings, sleepEntries)
    expect(result.every((b) => b.readingCount === 0)).toBe(true)
  })
})

describe('computeSleepDurationFastingCorrelation', () => {
  it('delegates to the existing tested correlation.ts implementation', () => {
    const sleepEntries = [sleepNight('2025-09-20', 450)]
    const readings = [fastingReading(100, Date.parse('2025-09-21T07:00:00'))]
    const result = computeSleepDurationFastingCorrelation(sleepEntries, readings)
    expect(result.n).toBe(1)
    expect(result.points[0].y).toBe(100)
  })
})
