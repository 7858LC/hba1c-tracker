import { describe, expect, it } from 'vitest'
import type { ExerciseEntry, GlucoseReading, MealEntry, SleepEntry } from '../../types'
import {
  computeDataQuality,
  MIN_AWAKENING_DAYS,
  MIN_FASTING_READINGS,
  MIN_MEAL_LINKED_READINGS,
  MIN_SLEEP_PAIRED_NIGHTS,
} from '../dataQuality'

function reading(
  id: number,
  timestamp: number,
  context: GlucoseReading['context'] = 'fasting',
  mealId?: number,
): GlucoseReading {
  return { id, timestamp, value: 100, context, mealId, source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

describe('computeDataQuality', () => {
  it('reports every category insufficient with no data', () => {
    const items = computeDataQuality({ readings: [], meals: [], sleepEntries: [], exerciseEntries: [] })
    expect(items.every((i) => i.status === 'insufficient')).toBe(true)
    expect(items.map((i) => i.label)).toEqual([
      'Fasting analysis',
      '1-hour meal analysis',
      '2-hour meal analysis',
      'Awakening analysis',
      'Sleep correlation',
      'Exercise effect',
      'Meal carbohydrate response',
    ])
  })

  it('marks fasting analysis good once the minimum is met', () => {
    const readings = Array.from({ length: MIN_FASTING_READINGS }, (_, i) =>
      reading(i, Date.now() - i * 3600_000, 'fasting'),
    )
    const items = computeDataQuality({ readings, meals: [], sleepEntries: [], exerciseEntries: [] })
    const fasting = items.find((i) => i.label === 'Fasting analysis')!
    expect(fasting.status).toBe('good')
    expect(fasting.count).toBe(MIN_FASTING_READINGS)
  })

  it('marks meal-linked categories insufficient when readings exist but have no mealId', () => {
    const readings = Array.from({ length: 20 }, (_, i) =>
      reading(i, Date.now() + i * 3600_000, 'post_meal_1h'), // no mealId
    )
    const items = computeDataQuality({ readings, meals: [], sleepEntries: [], exerciseEntries: [] })
    expect(items.find((i) => i.label === 'Meal carbohydrate response')!.status).toBe('insufficient')
  })

  it('marks meal carbohydrate response good once enough readings are linked to real meals', () => {
    const mealTime = Date.now()
    const meals: MealEntry[] = [
      { id: 1, timestamp: mealTime, carbsGrams: 50, mealType: 'dinner', createdAt: 0, updatedAt: 0 },
    ]
    const readings = Array.from({ length: MIN_MEAL_LINKED_READINGS }, (_, i) =>
      reading(i, mealTime + (i + 1) * 60_000, 'post_meal_1h', 1),
    )
    const items = computeDataQuality({ readings, meals, sleepEntries: [], exerciseEntries: [] })
    expect(items.find((i) => i.label === 'Meal carbohydrate response')!.status).toBe('good')
  })

  it('marks awakening analysis good only once enough days have T0+T30+T60 together', () => {
    const sleepEntries: SleepEntry[] = []
    const readings: GlucoseReading[] = []
    let id = 0
    for (let day = 0; day < MIN_AWAKENING_DAYS; day++) {
      const wake = Date.parse('2025-09-20T06:30:00') + day * 24 * 3600_000
      sleepEntries.push({
        date: `day-${day}`,
        durationMinutes: 420,
        wasoMinutes: 10,
        wakeTimestamp: wake,
        createdAt: 0,
        updatedAt: 0,
      })
      readings.push(reading(id++, wake, 'waking'))
      readings.push(reading(id++, wake + 30 * 60_000, 'waking'))
      readings.push(reading(id++, wake + 60 * 60_000, 'waking'))
    }
    const items = computeDataQuality({ readings, meals: [], sleepEntries, exerciseEntries: [] })
    expect(items.find((i) => i.label === 'Awakening analysis')!.status).toBe('good')
  })

  it('does not count a day with only T0 and T30 (missing T60) toward awakening readiness', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const sleepEntries: SleepEntry[] = [
      { date: 'd', durationMinutes: 420, wasoMinutes: 10, wakeTimestamp: wake, createdAt: 0, updatedAt: 0 },
    ]
    const readings = [reading(1, wake, 'waking'), reading(2, wake + 30 * 60_000, 'waking')]
    const items = computeDataQuality({ readings, meals: [], sleepEntries, exerciseEntries: [] })
    expect(items.find((i) => i.label === 'Awakening analysis')!.count).toBe(0)
  })

  it('marks sleep correlation good once enough nights pair a wake time with a next-morning fasting reading', () => {
    const sleepEntries: SleepEntry[] = []
    const readings: GlucoseReading[] = []
    let id = 0
    for (let day = 0; day < MIN_SLEEP_PAIRED_NIGHTS; day++) {
      const wake = Date.parse('2025-09-20T06:30:00') + day * 24 * 3600_000
      sleepEntries.push({
        date: `day-${day}`,
        durationMinutes: 420,
        wasoMinutes: 10,
        wakeTimestamp: wake,
        createdAt: 0,
        updatedAt: 0,
      })
      readings.push(reading(id++, wake + 10 * 60_000, 'fasting'))
    }
    const items = computeDataQuality({ readings, meals: [], sleepEntries, exerciseEntries: [] })
    expect(items.find((i) => i.label === 'Sleep correlation')!.status).toBe('good')
  })

  it('marks exercise effect insufficient with no exercise events even if readings exist', () => {
    const readings = Array.from({ length: 50 }, (_, i) => reading(i, Date.now() + i * 3600_000))
    const exerciseEntries: ExerciseEntry[] = []
    const items = computeDataQuality({ readings, meals: [], sleepEntries: [], exerciseEntries })
    expect(items.find((i) => i.label === 'Exercise effect')!.status).toBe('insufficient')
  })
})
