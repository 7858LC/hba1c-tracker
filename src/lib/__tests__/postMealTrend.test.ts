import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import { DAY_MS } from '../dates'
import { dailyPostMealSeries } from '../postMealTrend'

function reading(
  context: GlucoseReading['context'],
  value: number,
  timestamp: number,
): GlucoseReading {
  return { context, value, timestamp, source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

describe('dailyPostMealSeries', () => {
  const now = Date.parse('2025-09-20T12:00:00')

  it('returns empty with no readings', () => {
    expect(dailyPostMealSeries([], 30, now)).toEqual([])
  })

  it('averages multiple same-day readings per context independently', () => {
    const readings = [
      reading('post_meal_1h', 130, now),
      reading('post_meal_1h', 150, now - 1000),
      reading('post_meal_2h', 110, now),
    ]
    const result = dailyPostMealSeries(readings, 30, now)
    expect(result).toHaveLength(1)
    expect(result[0].value1h).toBeCloseTo(140, 5)
    expect(result[0].value2h).toBeCloseTo(110, 5)
  })

  it('leaves the other series null on a day with only one context logged', () => {
    const readings = [reading('post_meal_1h', 130, now)]
    const result = dailyPostMealSeries(readings, 30, now)
    expect(result[0].value1h).toBe(130)
    expect(result[0].value2h).toBeNull()
  })

  it('ignores fasting/pre_meal/random readings entirely', () => {
    const readings = [
      reading('fasting', 85, now),
      reading('pre_meal', 90, now),
      reading('random', 200, now),
    ]
    expect(dailyPostMealSeries(readings, 30, now)).toEqual([])
  })

  it('excludes points outside the trailing window', () => {
    const readings = [
      reading('post_meal_1h', 130, now - 40 * DAY_MS), // outside a 30d window
      reading('post_meal_1h', 135, now),
    ]
    const result = dailyPostMealSeries(readings, 30, now)
    expect(result).toHaveLength(1)
    expect(result[0].value1h).toBe(135)
  })

  it('sorts points chronologically', () => {
    const readings = [
      reading('post_meal_1h', 120, now),
      reading('post_meal_1h', 125, now - 2 * DAY_MS),
      reading('post_meal_1h', 130, now - 1 * DAY_MS),
    ]
    const result = dailyPostMealSeries(readings, 30, now)
    expect(result.map((p) => p.date)).toEqual([...result.map((p) => p.date)].sort())
  })
})
