import { describe, expect, it } from 'vitest'
import type { GlucoseReading, MealEntry } from '../../types'
import { computePostMealAnalytics, MIN_POST_MEAL_READINGS } from '../analyticsPostMeal'

function reading(
  value: number,
  timestamp: number,
  overrides: Partial<GlucoseReading> = {},
): GlucoseReading {
  return {
    value,
    timestamp,
    context: 'post_meal_1h',
    source: 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function meal(id: number, timestamp: number): MealEntry {
  return { id, timestamp, carbsGrams: 50, mealType: 'dinner', createdAt: 0, updatedAt: 0 }
}

describe('computePostMealAnalytics', () => {
  it('buckets readings by ACTUAL elapsed time, not the context label — the Oct 6 scenario', () => {
    const t = Date.now()
    const meals = [meal(1, t)]
    // labeled "1h" but actually 152 minutes after the meal
    const readings = [reading(140, t + 152 * 60_000, { mealId: 1, context: 'post_meal_1h' })]
    const result = computePostMealAnalytics(readings, meals)
    expect(result.buckets.find((b) => b.bucket === '150-180')!.readingCount).toBe(1)
    expect(result.buckets.find((b) => b.bucket === '0-90')!.readingCount).toBe(0)
  })

  it('never includes an unlinked post-meal reading in any bucket', () => {
    const t = Date.now()
    const readings = [reading(140, t + 60 * 60_000)] // no mealId
    const result = computePostMealAnalytics(readings, [])
    expect(result.buckets.every((b) => b.readingCount === 0)).toBe(true)
    expect(result.unlinkedPostMealCount).toBe(1)
  })

  it('does not assume the nearest prior meal when mealId is unset, even if timing would line up', () => {
    const t = Date.now()
    const meals = [meal(1, t)]
    // mealId deliberately NOT set, even though this reading is 60 min after meal 1
    const readings = [reading(140, t + 60 * 60_000)]
    const result = computePostMealAnalytics(readings, meals)
    expect(result.linkedReadingCount).toBe(0)
  })

  it('marks a bucket eligible once it meets the minimum reading count', () => {
    const t = Date.now()
    const meals = [meal(1, t)]
    const readings = Array.from({ length: MIN_POST_MEAL_READINGS }, (_, i) =>
      reading(130 + i, t + 30 * 60_000, { mealId: 1, id: i }),
    )
    const result = computePostMealAnalytics(readings, meals)
    const bucket0to90 = result.buckets.find((b) => b.bucket === '0-90')!
    expect(bucket0to90.eligible).toBe(true)
    expect(bucket0to90.mean).toBeCloseTo(130 + (MIN_POST_MEAL_READINGS - 1) / 2, 5)
  })

  it('correctly separates readings linked to different meals into their own actual-time buckets', () => {
    const t1 = Date.now()
    const t2 = t1 + 24 * 3600_000
    const meals = [meal(1, t1), meal(2, t2)]
    const readings = [
      reading(130, t1 + 45 * 60_000, { mealId: 1 }), // 45min -> 0-90
      reading(150, t2 + 200 * 60_000, { mealId: 2 }), // 200min -> 180+
    ]
    const result = computePostMealAnalytics(readings, meals)
    expect(result.buckets.find((b) => b.bucket === '0-90')!.readingCount).toBe(1)
    expect(result.buckets.find((b) => b.bucket === '180+')!.readingCount).toBe(1)
  })
})
