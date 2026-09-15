import { describe, expect, it } from 'vitest'
import type { GlucoseReading, MealEntry } from '../../types'
import { DAY_MS } from '../dates'
import { carbsVsNextDayGlucose, pearsonCorrelation } from '../correlation'

describe('pearsonCorrelation', () => {
  it('is 1 for perfectly correlated data', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 6)
  })
  it('is -1 for perfectly inversely correlated data', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 6)
  })
  it('returns null with fewer than 3 points', () => {
    expect(pearsonCorrelation([1, 2], [1, 2])).toBeNull()
  })
})

describe('carbsVsNextDayGlucose', () => {
  it('pairs a day\'s carbs with the NEXT day\'s average glucose, not the same day', () => {
    const day0 = Date.parse('2025-01-01T12:00:00Z')
    const day1 = day0 + DAY_MS

    const meals: MealEntry[] = [
      {
        timestamp: day0,
        carbsGrams: 200,
        mealType: 'dinner',
        createdAt: day0,
        updatedAt: day0,
      },
    ]
    const readings: GlucoseReading[] = [
      // same-day reading should NOT be paired with day0's carbs
      { timestamp: day0, value: 999, context: 'random', source: 'manual', createdAt: day0, updatedAt: day0 },
      { timestamp: day1, value: 160, context: 'random', source: 'manual', createdAt: day1, updatedAt: day1 },
    ]

    const result = carbsVsNextDayGlucose(meals, readings)
    expect(result.n).toBe(1)
    expect(result.points[0].x).toBe(200)
    expect(result.points[0].y).toBe(160)
  })
})
