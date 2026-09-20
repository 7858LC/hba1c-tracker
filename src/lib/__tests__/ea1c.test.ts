import { describe, expect, it } from 'vitest'
import type { GlucoseContext, GlucoseReading } from '../../types'
import {
  calculateGatedEA1C,
  calculateRollingEA1C,
  checkEA1CEligibility,
  ea1cToGlucose,
  glucoseToEA1C,
  MIN_DENSITY_DAYS,
  rollingEA1CSeries,
} from '../ea1c'
import { DAY_MS } from '../dates'

function reading(
  daysAgo: number,
  value: number,
  now: number,
  context: GlucoseContext = 'random',
): GlucoseReading {
  const timestamp = now - daysAgo * DAY_MS
  return {
    timestamp,
    value,
    context,
    source: 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** A dataset that clears the density/diversity bar: 21 distinct days in
 * the last 30, including a fasting reading and a post-meal reading. */
function eligibleReadings(now: number, value = 120): GlucoseReading[] {
  const readings: GlucoseReading[] = []
  for (let d = 0; d < 21; d++) {
    readings.push(reading(d, value, now, d === 0 ? 'fasting' : 'random'))
  }
  readings.push(reading(2, value, now, 'post_meal_1h'))
  return readings
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

describe('checkEA1CEligibility', () => {
  const now = Date.now()

  it('is ineligible with too few days of data, even with both contexts present', () => {
    const readings = [reading(0, 100, now, 'fasting'), reading(1, 140, now, 'post_meal_1h')]
    const result = checkEA1CEligibility(readings, now)
    expect(result.eligible).toBe(false)
    expect(result.daysWithData).toBeLessThan(result.requiredDays)
  })

  it('is ineligible with enough days but no fasting reading', () => {
    const readings: GlucoseReading[] = []
    for (let d = 0; d < 25; d++) readings.push(reading(d, 120, now, 'post_meal_1h'))
    const result = checkEA1CEligibility(readings, now)
    expect(result.eligible).toBe(false)
    expect(result.hasFastingReading).toBe(false)
    expect(result.hasMealRelativeReading).toBe(true)
  })

  it('is ineligible with enough days and fasting but no pre/post-meal reading', () => {
    const readings: GlucoseReading[] = []
    for (let d = 0; d < 25; d++) readings.push(reading(d, 120, now, 'fasting'))
    const result = checkEA1CEligibility(readings, now)
    expect(result.eligible).toBe(false)
    expect(result.hasFastingReading).toBe(true)
    expect(result.hasMealRelativeReading).toBe(false)
  })

  it('is eligible once day coverage, a fasting reading, and a meal-relative reading are all present', () => {
    const result = checkEA1CEligibility(eligibleReadings(now), now)
    expect(result.eligible).toBe(true)
    expect(result.daysWithData).toBeGreaterThanOrEqual(MIN_DENSITY_DAYS)
  })

  it('only counts days within the fixed 30-day window, not the whole history', () => {
    const readings = eligibleReadings(now)
    for (let d = 40; d < 80; d++) readings.push(reading(d, 120, now, 'fasting'))
    const result = checkEA1CEligibility(readings, now)
    expect(result.daysWithData).toBeLessThanOrEqual(30)
  })
})

describe('calculateRollingEA1C (ungated — trend chart / projection building block)', () => {
  const now = Date.now()

  it('returns null when there are too few readings in the window', () => {
    const readings = [reading(1, 100, now), reading(2, 110, now)]
    const result = calculateRollingEA1C(readings, 30, now)
    expect(result.value).toBeNull()
    expect(result.readingCount).toBe(2)
    // avgGlucose is still reported even when value is gated by reading count
    expect(result.avgGlucose).toBeCloseTo(105, 5)
  })

  it('computes a value from >=5 readings regardless of the 30-day density/diversity bar', () => {
    // all 'random' context, single day — clears MIN_READINGS_FOR_ESTIMATE but
    // would fail checkEA1CEligibility; calculateRollingEA1C ignores that.
    const readings = Array.from({ length: 5 }, () => reading(1, 120, now))
    const result = calculateRollingEA1C(readings, 30, now)
    expect(result.value).not.toBeNull()
    expect(result.eligibility.eligible).toBe(false)
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

describe('calculateGatedEA1C (standalone display — EA1CCard)', () => {
  const now = Date.now()

  it('nulls the value when the 30-day density/diversity bar is not cleared, even with >=5 readings', () => {
    const readings = Array.from({ length: 10 }, () => reading(1, 120, now))
    const result = calculateGatedEA1C(readings, 30, now)
    expect(result.eligibility.eligible).toBe(false)
    expect(result.value).toBeNull()
    // the raw average is still reported — the "showing raw glucose
    // averages only" fallback, not a blank result
    expect(result.avgGlucose).toBeCloseTo(120, 5)
  })

  it('reports a value once density/diversity is met', () => {
    const result = calculateGatedEA1C(eligibleReadings(now, 120), 30, now)
    expect(result.eligibility.eligible).toBe(true)
    expect(result.value).toBeCloseTo(glucoseToEA1C(120), 5)
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
