import { describe, expect, it } from 'vitest'
import type { GlucoseReading, SleepEntry } from '../../types'
import { computeAwakeningAnalytics, MIN_AWAKENING_DAYS } from '../analyticsAwakening'

function reading(value: number, timestamp: number): GlucoseReading {
  return { value, timestamp, context: 'waking', source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

function sleepNight(date: string, wakeTimestamp: number): SleepEntry {
  return { date, durationMinutes: 420, wasoMinutes: 10, wakeTimestamp, createdAt: 0, updatedAt: 0 }
}

describe('computeAwakeningAnalytics', () => {
  it('is ineligible with no data', () => {
    const result = computeAwakeningAnalytics([], [])
    expect(result.eligible).toBe(false)
    expect(result.t0Mean).toBeNull()
  })

  it('computes T0/T30/T60 means and rises once enough days have all three', () => {
    const sleepEntries: SleepEntry[] = []
    const readings: GlucoseReading[] = []
    for (let day = 0; day < MIN_AWAKENING_DAYS; day++) {
      const wake = Date.parse('2025-09-20T06:30:00') + day * 24 * 3600_000
      sleepEntries.push(sleepNight(`d${day}`, wake))
      readings.push(reading(85 + day, wake))
      readings.push(reading(95 + day, wake + 30 * 60_000))
      readings.push(reading(100 + day, wake + 60 * 60_000))
    }
    const result = computeAwakeningAnalytics(readings, sleepEntries)
    expect(result.eligible).toBe(true)
    expect(result.daysWithTriple).toBe(MIN_AWAKENING_DAYS)
    expect(result.t0Count).toBe(MIN_AWAKENING_DAYS)
    expect(result.meanRiseT0ToT30).toBeCloseTo(10, 5)
    expect(result.meanRiseT0ToT60).toBeCloseTo(15, 5)
  })

  it('computes a positive correlation when glucose rises steadily with minutes after waking', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const sleepEntries = [sleepNight('d0', wake)]
    const readings = Array.from({ length: 10 }, (_, i) => reading(80 + i * 2, wake + i * 10 * 60_000))
    const result = computeAwakeningAnalytics(readings, sleepEntries)
    expect(result.minutesVsGlucoseR).toBeGreaterThan(0.9)
  })

  it('excludes readings beyond the relationship window even if a wake time technically resolves', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const sleepEntries = [sleepNight('d0', wake)]
    const readings = [reading(90, wake + 300 * 60_000)] // 5h after waking
    const result = computeAwakeningAnalytics(readings, sleepEntries)
    expect(result.minutesVsGlucoseN).toBe(0)
  })

  it('does not count a day missing T60 toward eligibility', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const sleepEntries = [sleepNight('d0', wake)]
    const readings = [reading(85, wake), reading(95, wake + 30 * 60_000)]
    const result = computeAwakeningAnalytics(readings, sleepEntries)
    expect(result.daysWithTriple).toBe(0)
  })
})
