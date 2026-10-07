import type { ExerciseEntry, GlucoseReading } from '../types'
import { exerciseRecencyBucket, minutesSinceExercise, type ExerciseRecencyBucket } from './elapsedTime'
import { mean, standardDeviation } from './stats'

export const MIN_EXERCISE_BUCKET_READINGS = 5

const BUCKET_ORDER: ExerciseRecencyBucket[] = ['0-1h', '1-3h', '3-12h', '12-24h', 'none']

const BUCKET_LABELS: Record<ExerciseRecencyBucket, string> = {
  '0-1h': 'Within 1 hour after exercise',
  '1-3h': '1-3 hours after exercise',
  '3-12h': '3-12 hours after exercise',
  '12-24h': '12-24 hours after exercise',
  none: 'No exercise in the prior 24h',
}

export interface ExerciseBucketStats {
  bucket: ExerciseRecencyBucket
  label: string
  eligible: boolean
  readingCount: number
  mean: number | null
  sd: number | null
}

/**
 * Section H (Exercise). Readings compared by recency since the nearest
 * PRIOR exercise event — an association across buckets, never a causal
 * claim. The UI layer is responsible for phrasing this as an association,
 * per spec; nothing here asserts exercise caused any particular value.
 */
export function computeExerciseEffectAnalytics(
  readings: GlucoseReading[],
  exerciseEntries: ExerciseEntry[],
): ExerciseBucketStats[] {
  const byBucket = new Map<ExerciseRecencyBucket, number[]>()
  for (const b of BUCKET_ORDER) byBucket.set(b, [])
  for (const r of readings) {
    const m = minutesSinceExercise(r, exerciseEntries)
    byBucket.get(exerciseRecencyBucket(m))!.push(r.value)
  }

  return BUCKET_ORDER.map((bucket) => {
    const values = byBucket.get(bucket)!
    return {
      bucket,
      label: BUCKET_LABELS[bucket],
      eligible: values.length >= MIN_EXERCISE_BUCKET_READINGS,
      readingCount: values.length,
      mean: mean(values),
      sd: standardDeviation(values),
    }
  })
}
