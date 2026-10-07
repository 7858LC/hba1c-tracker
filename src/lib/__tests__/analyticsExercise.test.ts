import { describe, expect, it } from 'vitest'
import type { ExerciseEntry, GlucoseReading } from '../../types'
import { computeExerciseEffectAnalytics, MIN_EXERCISE_BUCKET_READINGS } from '../analyticsExercise'

function reading(value: number, timestamp: number): GlucoseReading {
  return { value, timestamp, context: 'random', source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

function exercise(timestamp: number, durationMinutes = 30): ExerciseEntry {
  return {
    timestamp,
    activityType: 'walk',
    modality: 'aerobic',
    durationMinutes,
    intensity: 'moderate',
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('computeExerciseEffectAnalytics', () => {
  it('returns all 5 buckets even with no data', () => {
    const result = computeExerciseEffectAnalytics([], [])
    expect(result.map((b) => b.bucket)).toEqual(['0-1h', '1-3h', '3-12h', '12-24h', 'none'])
  })

  it('puts a reading with no exercise history into the "none" bucket', () => {
    const readings = [reading(100, Date.now())]
    const result = computeExerciseEffectAnalytics(readings, [])
    expect(result.find((b) => b.bucket === 'none')!.readingCount).toBe(1)
  })

  it('buckets a reading correctly by recency since the nearest prior exercise', () => {
    const exerciseStart = Date.parse('2025-09-20T08:00:00')
    const ex = exercise(exerciseStart, 30) // ends 08:30
    const readings = [
      reading(100, exerciseStart + 45 * 60_000), // 15 min after end -> 0-1h
      reading(110, exerciseStart + 2 * 3600_000), // ~1.5h after end -> 1-3h
    ]
    const result = computeExerciseEffectAnalytics(readings, [ex])
    expect(result.find((b) => b.bucket === '0-1h')!.readingCount).toBe(1)
    expect(result.find((b) => b.bucket === '1-3h')!.readingCount).toBe(1)
  })

  it('marks a bucket eligible once it meets the minimum', () => {
    const exerciseStart = Date.now()
    const ex = exercise(exerciseStart, 30)
    const readings = Array.from({ length: MIN_EXERCISE_BUCKET_READINGS }, (_, i) =>
      reading(100 + i, exerciseStart + (31 + i) * 60_000),
    )
    const result = computeExerciseEffectAnalytics(readings, [ex])
    expect(result.find((b) => b.bucket === '0-1h')!.eligible).toBe(true)
  })

  it('never uses causal language — output is numbers and neutral labels only', () => {
    const result = computeExerciseEffectAnalytics([], [])
    for (const b of result) {
      expect(b.label.toLowerCase()).not.toMatch(/caus|because|due to|lowers|raises/)
    }
  })
})
