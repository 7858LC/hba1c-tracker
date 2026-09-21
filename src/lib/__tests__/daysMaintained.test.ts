import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import { DAY_MS, toDateKey } from '../dates'
import { computeDaysMaintained, dailyFastingSeries, SUSTAINED_BREAK_DAYS } from '../daysMaintained'

const now = Date.parse('2025-06-15T12:00:00')

function fasting(daysAgo: number, value: number): GlucoseReading {
  const timestamp = now - daysAgo * DAY_MS
  return {
    timestamp,
    value,
    context: 'fasting',
    source: 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

describe('computeDaysMaintained', () => {
  it('returns null with no fasting readings at all', () => {
    const result = computeDaysMaintained([], 100, now)
    expect(result.daysMaintained).toBeNull()
  })

  it('counts every day since the first reading when nothing ever broke the target', () => {
    const readings = [fasting(9, 95), fasting(5, 98), fasting(0, 90)]
    const result = computeDaysMaintained(readings, 100, now)
    expect(result.daysMaintained).toBe(10) // day 9 ago through today, inclusive
  })

  it('does not reset on a single over-target day', () => {
    const readings = [fasting(5, 95), fasting(4, 130), fasting(3, 95), fasting(0, 90)]
    const result = computeDaysMaintained(readings, 100, now)
    // a single bad day (4 days ago) must not zero out the count
    expect(result.daysMaintained).toBe(6)
  })

  it(`resets on ${SUSTAINED_BREAK_DAYS}+ consecutive over-target days`, () => {
    const readings = [
      fasting(20, 95),
      fasting(10, 130),
      fasting(9, 135),
      fasting(8, 128), // 3 consecutive over-target days -> a real break
      fasting(3, 95),
      fasting(0, 90),
    ]
    const result = computeDaysMaintained(readings, 100, now)
    // regime restarts the day after the 3-day break ends (7 days ago)
    expect(result.daysMaintained).toBe(8)
  })

  it('does not let a gap day (no reading) count toward or break the over-streak', () => {
    const readings = [
      fasting(10, 130),
      // day 9 ago: no reading at all
      fasting(8, 130),
      fasting(7, 130), // 3rd over-target reading, but not on 3 CONSECUTIVE calendar days
      fasting(0, 90),
    ]
    const result = computeDaysMaintained(readings, 100, now)
    // the gap day breaks consecutiveness, so this should NOT count as a reset
    expect(result.daysCurrentlyOver).toBe(0)
    expect(result.regimeStartDate).toBe(toDateKey(readings[0].timestamp))
  })

  it('reports daysCurrentlyOver as a soft warning before a full reset', () => {
    const readings = [fasting(2, 95), fasting(1, 130), fasting(0, 135)]
    const result = computeDaysMaintained(readings, 100, now)
    expect(result.daysCurrentlyOver).toBe(2)
  })
})

describe('dailyFastingSeries', () => {
  it('only includes days within the requested window', () => {
    const readings = [fasting(5, 100), fasting(40, 100)]
    const series = dailyFastingSeries(readings, 30, now)
    expect(series).toHaveLength(1)
  })

  it('averages multiple same-day fasting readings', () => {
    const readings = [fasting(1, 100), fasting(1, 120)]
    const series = dailyFastingSeries(readings, 30, now)
    expect(series[0].value).toBeCloseTo(110, 5)
  })
})
