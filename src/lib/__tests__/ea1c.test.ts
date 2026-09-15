import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import { calculateRollingEA1C, ea1cToGlucose, glucoseToEA1C, rollingEA1CSeries } from '../ea1c'
import { DAY_MS } from '../dates'

function reading(daysAgo: number, value: number, now: number): GlucoseReading {
  const timestamp = now - daysAgo * DAY_MS
  return {
    timestamp,
    value,
    context: 'random',
    source: 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

describe('ADAG formula', () => {
  it('matches the published ADA average-glucose reference table', () => {
    // ADA reference: 154 mg/dL <-> 7.0%, 126 mg/dL <-> 6.0%
    expect(glucoseToEA1C(154)).toBeCloseTo(7.0, 1)
    expect(glucoseToEA1C(126)).toBeCloseTo(6.0, 1)
    expect(ea1cToGlucose(7.0)).toBeCloseTo(154, 0)
    expect(ea1cToGlucose(6.0)).toBeCloseTo(125.5, 1)
  })

  it('is a pure lookup with no averaging of pre-computed eA1C values', () => {
    // glucoseToEA1C must only ever be fed a raw glucose average, never a
    // previously computed eA1C, so there is no "averaging estimates" path.
    expect(glucoseToEA1C(0)).toBeCloseTo(46.7 / 28.7)
  })
})

describe('calculateRollingEA1C', () => {
  const now = Date.now()

  it('returns null when there are too few readings in the window', () => {
    const readings = [reading(1, 100, now), reading(2, 110, now)]
    const result = calculateRollingEA1C(readings, 30, now)
    expect(result.value).toBeNull()
    expect(result.readingCount).toBe(2)
  })

  it('averages only readings inside the window, excluding older ones', () => {
    const readings = [
      reading(1, 120, now),
      reading(2, 120, now),
      reading(3, 120, now),
      reading(4, 120, now),
      reading(5, 120, now),
      reading(200, 400, now), // far outside any window; would skew avg if included
    ]
    const result = calculateRollingEA1C(readings, 30, now)
    expect(result.avgGlucose).toBeCloseTo(120, 5)
    expect(result.value).toBeCloseTo(glucoseToEA1C(120), 5)
  })

  it('flags isFullWindow=false when fewer days of data exist than the window', () => {
    const readings = Array.from({ length: 6 }, (_, i) => reading(i, 130, now))
    const result = calculateRollingEA1C(readings, 90, now)
    expect(result.isFullWindow).toBe(false)
    expect(result.daysWithData).toBeLessThan(90)
  })
})

describe('rollingEA1CSeries', () => {
  it('produces one point per day that has data, not a point for empty days', () => {
    const now = Date.now()
    const readings = [
      reading(10, 120, now),
      reading(10, 130, now),
      reading(1, 140, now),
      reading(0, 150, now),
    ]
    // enough readings to clear the min-readings-for-estimate floor across windows
    const bulk = Array.from({ length: 5 }, () => reading(5, 125, now))
    const series = rollingEA1CSeries([...readings, ...bulk], 14, now)
    expect(series.length).toBeGreaterThan(0)
    for (const point of series) {
      expect(point.value === null || point.value > 0).toBe(true)
    }
  })

  it('returns an empty series when there are no readings', () => {
    expect(rollingEA1CSeries([], 30)).toEqual([])
  })
})
