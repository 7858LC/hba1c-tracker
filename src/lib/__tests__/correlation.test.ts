import { describe, expect, it } from 'vitest'
import type { GlucoseReading, MealEntry, SleepEntry } from '../../types'
import { DAY_MS } from '../dates'
import { carbsVsNextDayGlucose, pearsonCorrelation, sleepVsNextDayGlucose } from '../correlation'

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

describe('sleepVsNextDayGlucose', () => {
  it("pairs a night's sleep (dated the night it began) with the following morning's fasting glucose — not same-calendar-day, and not a non-fasting reading", () => {
    const sleep: SleepEntry[] = [
      {
        date: '2025-09-16',
        durationMinutes: 450, // 7h30m
        wasoMinutes: 20,
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const sameNightReading = new Date(2025, 8, 16, 22, 0).getTime() // 9/16 10pm — must be ignored
    const nextMorningFasting = new Date(2025, 8, 17, 7, 0).getTime() // 9/17 7am, fasting — the target
    const nextMorningPostMeal = new Date(2025, 8, 17, 9, 0).getTime() // 9/17 9am, non-fasting — must be ignored

    const readings: GlucoseReading[] = [
      {
        timestamp: sameNightReading,
        value: 999,
        context: 'fasting',
        source: 'manual',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        timestamp: nextMorningFasting,
        value: 102,
        context: 'fasting',
        source: 'manual',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        timestamp: nextMorningPostMeal,
        value: 180,
        context: 'post_meal_1h',
        source: 'manual',
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const result = sleepVsNextDayGlucose(sleep, readings)
    expect(result.n).toBe(1)
    expect(result.points[0].x).toBeCloseTo(7.5, 5) // 450 min -> 7.5h
    expect(result.points[0].y).toBe(102) // only the 9/17 fasting reading
  })

  it('excludes a night with no fasting reading the next morning', () => {
    const sleep: SleepEntry[] = [
      { date: '2025-09-16', durationMinutes: 400, wasoMinutes: 10, createdAt: 0, updatedAt: 0 },
    ]
    const readings: GlucoseReading[] = [
      {
        timestamp: new Date(2025, 8, 17, 9, 0).getTime(),
        value: 180,
        context: 'post_meal_1h',
        source: 'manual',
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    const result = sleepVsNextDayGlucose(sleep, readings)
    expect(result.n).toBe(0)
  })
})
