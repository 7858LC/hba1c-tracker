import { describe, expect, it } from 'vitest'
import type { GlucoseReading, MealEntry } from '../../types'
import { summarizeAwakeningRun, summarizeMealResponse } from '../protocolSummary'

function reading(
  value: number,
  timestamp: number,
  protocolRunId: number,
  protocolRole: string,
  overrides: Partial<GlucoseReading> = {},
): GlucoseReading {
  return {
    value,
    timestamp,
    context: 'waking',
    source: 'manual',
    protocolRunId,
    protocolRole,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

describe('summarizeAwakeningRun', () => {
  it('groups T0/T30/T60 by day and computes rises', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const readings = [
      reading(85, wake, 1, 'T0'),
      reading(95, wake + 30 * 60_000, 1, 'T30'),
      reading(102, wake + 60 * 60_000, 1, 'T60'),
    ]
    const result = summarizeAwakeningRun(readings, 1)
    expect(result).toHaveLength(1)
    expect(result[0].t0).toBe(85)
    expect(result[0].t30).toBe(95)
    expect(result[0].t60).toBe(102)
    expect(result[0].riseT0ToT30).toBe(10)
    expect(result[0].riseT0ToT60).toBe(17)
    expect(result[0].pctRiseT0ToT60).toBeCloseTo((17 / 85) * 100, 5)
  })

  it('leaves missing roles as null rather than 0', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const readings = [reading(85, wake, 1, 'T0')]
    const result = summarizeAwakeningRun(readings, 1)
    expect(result[0].t30).toBeNull()
    expect(result[0].riseT0ToT30).toBeNull()
  })

  it('ignores readings from a different protocol run', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const readings = [reading(85, wake, 2, 'T0')]
    expect(summarizeAwakeningRun(readings, 1)).toHaveLength(0)
  })

  it('produces one entry per distinct day, sorted chronologically', () => {
    const day1 = Date.parse('2025-09-20T06:30:00')
    const day2 = day1 + 24 * 3600_000
    const readings = [reading(85, day2, 1, 'T0'), reading(80, day1, 1, 'T0')]
    const result = summarizeAwakeningRun(readings, 1)
    expect(result).toHaveLength(2)
    expect(result[0].date < result[1].date).toBe(true)
  })
})

describe('summarizeMealResponse', () => {
  function meal(timestamp: number): MealEntry {
    return { id: 1, timestamp, carbsGrams: 60, mealType: 'dinner', createdAt: 0, updatedAt: 0 }
  }

  it('computes baseline, peak, excursion, and time to peak using ACTUAL elapsed minutes', () => {
    const t = Date.parse('2025-10-06T18:00:00')
    const m = meal(t)
    const readings = [
      reading(95, t, 1, 'pre', { mealId: 1 }),
      reading(130, t + 30 * 60_000, 1, '30min', { mealId: 1 }),
      reading(165, t + 65 * 60_000, 1, '60min', { mealId: 1 }), // logged a bit late
      reading(140, t + 90 * 60_000, 1, '90min', { mealId: 1 }),
      reading(110, t + 120 * 60_000, 1, '120min', { mealId: 1 }),
    ]
    const result = summarizeMealResponse(readings, 1, m)
    expect(result.baseline).toBe(95)
    expect(result.peak).toBe(165)
    expect(result.peakExcursion).toBe(70)
    expect(result.timeToPeakMinutes).toBe(65) // actual elapsed, not the "60min" label
    expect(result.points.map((p) => p.actualMinutes)).toEqual([30, 65, 90, 120])
  })

  it('uses baseline as the peak when nothing exceeds it', () => {
    const t = Date.now()
    const m = meal(t)
    const readings = [
      reading(100, t, 1, 'pre', { mealId: 1 }),
      reading(90, t + 60 * 60_000, 1, '60min', { mealId: 1 }),
    ]
    const result = summarizeMealResponse(readings, 1, m)
    expect(result.peak).toBe(100)
    expect(result.timeToPeakMinutes).toBe(0)
    expect(result.peakExcursion).toBe(0)
  })

  it('handles a missing baseline gracefully', () => {
    const t = Date.now()
    const m = meal(t)
    const readings = [reading(140, t + 30 * 60_000, 1, '30min', { mealId: 1 })]
    const result = summarizeMealResponse(readings, 1, m)
    expect(result.baseline).toBeNull()
    expect(result.peakExcursion).toBeNull()
    expect(result.peak).toBe(140)
  })

  it('ignores readings linked to a different meal', () => {
    const t = Date.now()
    const m = meal(t)
    const readings = [reading(140, t + 30 * 60_000, 1, '30min', { mealId: 2 })]
    const result = summarizeMealResponse(readings, 1, m)
    expect(result.points).toHaveLength(0)
  })
})
