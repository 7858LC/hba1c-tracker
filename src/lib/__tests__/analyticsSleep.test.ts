import { describe, expect, it } from 'vitest'
import type { GlucoseReading, SleepEntry } from '../../types'
import {
  computeGlucoseByWakeRegularity,
  computeGlucoseByWaso,
  computeGlucoseBySleepDuration,
  computeGlucoseBySleepQuality,
  computeSleepDisruptionFlags,
  computeSleepDurationFastingCorrelation,
  MIN_SLEEP_DURATION_BUCKET_READINGS,
  MIN_WAKE_REGULARITY_BUCKET_READINGS,
  MIN_WASO_BUCKET_READINGS,
} from '../analyticsSleep'

function fastingReading(value: number, timestamp: number): GlucoseReading {
  return { value, timestamp, context: 'fasting', source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

function sleepNight(date: string, durationMinutes: number, sleepQuality?: 1 | 2 | 3 | 4 | 5): SleepEntry {
  return { date, durationMinutes, wasoMinutes: 10, sleepQuality, createdAt: 0, updatedAt: 0 }
}

function sleepNightWithWaso(date: string, wasoMinutes: number): SleepEntry {
  return { date, durationMinutes: 420, wasoMinutes, createdAt: 0, updatedAt: 0 }
}

function sleepNightWithWake(date: string, wakeTimestamp: number): SleepEntry {
  return { date, durationMinutes: 420, wasoMinutes: 10, wakeTimestamp, createdAt: 0, updatedAt: 0 }
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

describe('computeGlucoseByWaso', () => {
  it('groups next-morning fasting glucose by the preceding night WASO bucket', () => {
    const night = '2025-09-20'
    const morning = Date.parse('2025-09-21T07:00:00')
    const sleepEntries = [sleepNightWithWaso(night, 10)] // 0-15m bucket
    const readings = [fastingReading(95, morning)]
    const result = computeGlucoseByWaso(readings, sleepEntries)
    expect(result.find((b) => b.label === '0-15m')!.readingCount).toBe(1)
    expect(result.find((b) => b.label === '0-15m')!.mean).toBe(95)
  })

  it('marks a bucket eligible once it meets the minimum', () => {
    const sleepEntries: SleepEntry[] = []
    const readings: GlucoseReading[] = []
    for (let i = 0; i < MIN_WASO_BUCKET_READINGS; i++) {
      const night = `2025-09-${20 + i}`
      const morning = Date.parse(`2025-09-${21 + i}T07:00:00`)
      sleepEntries.push(sleepNightWithWaso(night, 20)) // 15-30m bucket
      readings.push(fastingReading(95 + i, morning))
    }
    const result = computeGlucoseByWaso(readings, sleepEntries)
    expect(result.find((b) => b.label === '15-30m')!.eligible).toBe(true)
  })
})

describe('computeGlucoseByWakeRegularity', () => {
  it('skips a night with fewer than the minimum baseline nights to compare against', () => {
    const sleepEntries = [
      sleepNightWithWake('2025-09-20', Date.parse('2025-09-20T07:00:00')),
      sleepNightWithWake('2025-09-21', Date.parse('2025-09-21T07:05:00')),
    ]
    const readings = [fastingReading(100, Date.parse('2025-09-22T07:00:00'))]
    const result = computeGlucoseByWakeRegularity(readings, sleepEntries)
    expect(result.every((b) => b.readingCount === 0)).toBe(true)
  })

  it('buckets a night close to its own recent baseline as low deviation', () => {
    const sleepEntries = [
      sleepNightWithWake('2025-09-10', Date.parse('2025-09-10T07:00:00')),
      sleepNightWithWake('2025-09-11', Date.parse('2025-09-11T07:00:00')),
      sleepNightWithWake('2025-09-12', Date.parse('2025-09-12T07:00:00')),
      sleepNightWithWake('2025-09-13', Date.parse('2025-09-13T07:05:00')), // 5min from baseline
    ]
    const readings = [fastingReading(100, Date.parse('2025-09-14T07:10:00'))]
    const result = computeGlucoseByWakeRegularity(readings, sleepEntries)
    expect(result.find((b) => b.label === '<30m')!.readingCount).toBe(1)
    expect(result.find((b) => b.label === '<30m')!.mean).toBe(100)
  })

  it('buckets a night far from its own recent baseline as high deviation', () => {
    const sleepEntries = [
      sleepNightWithWake('2025-09-10', Date.parse('2025-09-10T07:00:00')),
      sleepNightWithWake('2025-09-11', Date.parse('2025-09-11T07:00:00')),
      sleepNightWithWake('2025-09-12', Date.parse('2025-09-12T07:00:00')),
      sleepNightWithWake('2025-09-13', Date.parse('2025-09-13T10:00:00')), // 3h from baseline
    ]
    const readings = [fastingReading(110, Date.parse('2025-09-14T10:10:00'))]
    const result = computeGlucoseByWakeRegularity(readings, sleepEntries)
    expect(result.find((b) => b.label === '120m+')!.readingCount).toBe(1)
  })

  it('ignores a baseline night outside the lookback window', () => {
    const sleepEntries = [
      sleepNightWithWake('2025-08-01', Date.parse('2025-08-01T07:00:00')), // >14 days before — excluded
      sleepNightWithWake('2025-09-10', Date.parse('2025-09-10T07:00:00')),
      sleepNightWithWake('2025-09-11', Date.parse('2025-09-11T07:00:00')),
      sleepNightWithWake('2025-09-12', Date.parse('2025-09-12T07:00:00')),
    ]
    const readings = [fastingReading(100, Date.parse('2025-09-13T07:00:00'))]
    // Only 2 nights (9/10, 9/11... ) fall strictly before 9/12 within 14 days — below minimum.
    const result = computeGlucoseByWakeRegularity(readings, sleepEntries)
    expect(result.every((b) => b.readingCount === 0)).toBe(true)
  })

  it('marks a bucket eligible once it meets the minimum', () => {
    const months = ['01', '03', '05', '07', '09']
    expect(months.length).toBe(MIN_WAKE_REGULARITY_BUCKET_READINGS)
    const sleepEntries: SleepEntry[] = []
    const readings: GlucoseReading[] = []
    months.forEach((m, i) => {
      sleepEntries.push(sleepNightWithWake(`2025-${m}-10`, Date.parse(`2025-${m}-10T07:00:00`)))
      sleepEntries.push(sleepNightWithWake(`2025-${m}-11`, Date.parse(`2025-${m}-11T07:00:00`)))
      sleepEntries.push(sleepNightWithWake(`2025-${m}-12`, Date.parse(`2025-${m}-12T07:00:00`)))
      sleepEntries.push(sleepNightWithWake(`2025-${m}-13`, Date.parse(`2025-${m}-13T07:05:00`)))
      readings.push(fastingReading(95 + i, Date.parse(`2025-${m}-14T07:10:00`)))
    })
    const result = computeGlucoseByWakeRegularity(readings, sleepEntries)
    expect(result.find((b) => b.label === '<30m')!.eligible).toBe(true)
  })
})

describe('computeSleepDisruptionFlags', () => {
  it('flags a short-duration night when the next morning is above target', () => {
    const sleepEntries = [sleepNight('2025-09-20', 5 * 60)] // 5h — short
    const readings = [fastingReading(110, Date.parse('2025-09-21T07:00:00'))]
    const result = computeSleepDisruptionFlags(readings, sleepEntries, 99)
    expect(result).toHaveLength(1)
    expect(result[0].shortDuration).toBe(true)
    expect(result[0].highWaso).toBe(false)
    expect(result[0].exceedBy).toBeCloseTo(11)
  })

  it('does not flag an undisrupted night even when above target', () => {
    const sleepEntries = [{ date: '2025-09-20', durationMinutes: 8 * 60, wasoMinutes: 5, createdAt: 0, updatedAt: 0 }]
    const readings = [fastingReading(110, Date.parse('2025-09-21T07:00:00'))]
    const result = computeSleepDisruptionFlags(readings, sleepEntries, 99)
    expect(result).toHaveLength(0)
  })

  it('does not flag a disrupted night when fasting is at or below target', () => {
    const sleepEntries = [sleepNight('2025-09-20', 5 * 60)] // short, but...
    const readings = [fastingReading(90, Date.parse('2025-09-21T07:00:00'))] // below target
    const result = computeSleepDisruptionFlags(readings, sleepEntries, 99)
    expect(result).toHaveLength(0)
  })

  it('flags a high-WASO night independent of duration', () => {
    const sleepEntries = [sleepNightWithWaso('2025-09-20', 45)] // 7h duration (not short), WASO 45 — fragmented
    const readings = [fastingReading(105, Date.parse('2025-09-21T07:00:00'))]
    const result = computeSleepDisruptionFlags(readings, sleepEntries, 99)
    expect(result).toHaveLength(1)
    expect(result[0].highWaso).toBe(true)
    expect(result[0].shortDuration).toBe(false)
  })

  it('flags a wake-irregular night once a baseline exists', () => {
    const sleepEntries = [
      sleepNightWithWake('2025-09-10', Date.parse('2025-09-10T07:00:00')),
      sleepNightWithWake('2025-09-11', Date.parse('2025-09-11T07:00:00')),
      sleepNightWithWake('2025-09-12', Date.parse('2025-09-12T07:00:00')),
      sleepNightWithWake('2025-09-13', Date.parse('2025-09-13T10:00:00')), // 3h deviation
    ]
    const readings = [fastingReading(105, Date.parse('2025-09-14T10:10:00'))]
    const result = computeSleepDisruptionFlags(readings, sleepEntries, 99)
    expect(result).toHaveLength(1)
    expect(result[0].wakeIrregular).toBe(true)
    expect(result[0].shortDuration).toBe(false)
    expect(result[0].highWaso).toBe(false)
    expect(result[0].wakeDeviationMinutes).toBeCloseTo(180)
  })

  it('sorts flags most-recent night first', () => {
    const sleepEntries = [sleepNight('2025-09-10', 5 * 60), sleepNight('2025-09-12', 5 * 60)]
    const readings = [
      fastingReading(110, Date.parse('2025-09-11T07:00:00')),
      fastingReading(115, Date.parse('2025-09-13T07:00:00')),
    ]
    const result = computeSleepDisruptionFlags(readings, sleepEntries, 99)
    expect(result.map((f) => f.date)).toEqual(['2025-09-12', '2025-09-10'])
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
