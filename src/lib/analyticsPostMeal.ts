import type { GlucoseReading, MealEntry } from '../types'
import { MIN_POST_MEAL_READINGS } from './dataQuality'
import { actualMinutesSinceMeal, postMealBucket, type PostMealBucket } from './elapsedTime'
import { mean, median, range as statsRange, standardDeviation, type Range } from './stats'

export { MIN_POST_MEAL_READINGS }

export interface PostMealBucketStats {
  bucket: PostMealBucket
  eligible: boolean
  readingCount: number
  mean: number | null
  median: number | null
  range: Range | null
  sd: number | null
}

export interface PostMealAnalytics {
  buckets: PostMealBucketStats[]
  linkedReadingCount: number
  /** post-meal-context readings with no mealId — can't be bucketed by actual elapsed time, shown as informational context, never folded into a bucket's stats */
  unlinkedPostMealCount: number
}

const BUCKET_ORDER: PostMealBucket[] = ['0-90', '90-150', '150-180', '180+']
const POST_MEAL_CONTEXTS: GlucoseReading['context'][] = ['post_meal_1h', 'post_meal_2h', 'post_meal']

/**
 * Section D (Post-meal) of the analytics engine. Buckets readings by
 * ACTUAL elapsed minutes from their linked meal — never by context label —
 * and never pools a late reading into an earlier bucket's stats. Only
 * readings explicitly linked via mealId are analyzed at all: the nearest
 * prior pre-meal/meal reading is never assumed to belong to a given
 * post-meal reading without that explicit link, per spec.
 */
export function computePostMealAnalytics(
  readings: GlucoseReading[],
  meals: MealEntry[],
): PostMealAnalytics {
  const mealById = new Map(meals.filter((m) => m.id != null).map((m) => [m.id!, m]))
  const linked = readings.filter((r) => r.mealId != null && mealById.has(r.mealId))

  const byBucket = new Map<PostMealBucket, number[]>()
  for (const b of BUCKET_ORDER) byBucket.set(b, [])
  for (const r of linked) {
    const meal = mealById.get(r.mealId!)!
    const actual = actualMinutesSinceMeal(r, meal)
    const bucket = postMealBucket(actual)
    if (bucket) byBucket.get(bucket)!.push(r.value)
  }

  const buckets: PostMealBucketStats[] = BUCKET_ORDER.map((bucket) => {
    const values = byBucket.get(bucket)!
    return {
      bucket,
      eligible: values.length >= MIN_POST_MEAL_READINGS,
      readingCount: values.length,
      mean: mean(values),
      median: median(values),
      range: statsRange(values),
      sd: standardDeviation(values),
    }
  })

  const unlinkedPostMealCount = readings.filter(
    (r) => POST_MEAL_CONTEXTS.includes(r.context) && r.mealId == null,
  ).length

  return { buckets, linkedReadingCount: linked.length, unlinkedPostMealCount }
}
