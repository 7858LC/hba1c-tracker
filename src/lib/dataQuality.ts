import type { ExerciseEntry, GlucoseReading, MealEntry, SleepEntry } from '../types'
import {
  actualMinutesSinceMeal,
  minutesAfterWaking,
  minutesSinceExercise,
  postMealBucket,
} from './elapsedTime'

// Minimum sample sizes below which a report category is withheld rather
// than shown with false confidence. These are judgment calls, not derived
// from a clinical standard — documented here so they can be revisited.
export const MIN_FASTING_READINGS = 10
export const MIN_POST_MEAL_READINGS = 10
export const MIN_AWAKENING_DAYS = 5
export const MIN_SLEEP_PAIRED_NIGHTS = 5
export const MIN_EXERCISE_LINKED_READINGS = 5
export const MIN_MEAL_LINKED_READINGS = 10

export type DataSufficiency = 'good' | 'insufficient'

export interface DataQualityItem {
  label: string
  status: DataSufficiency
  count: number
  detail: string
}

/** Distinct sleep nights with readings close to T0 (~waking), T30, and T60 all present. */
function awakeningTripleDays(readings: GlucoseReading[], sleepEntries: SleepEntry[]): number {
  let count = 0
  for (const s of sleepEntries) {
    if (s.wakeTimestamp == null) continue
    const minutesList = readings
      .map((r) => minutesAfterWaking(r, s))
      .filter((m): m is number => m != null)
    const hasT0 = minutesList.some((m) => m >= -5 && m <= 10)
    const hasT30 = minutesList.some((m) => m >= 20 && m <= 40)
    const hasT60 = minutesList.some((m) => m >= 50 && m <= 70)
    if (hasT0 && hasT30 && hasT60) count++
  }
  return count
}

/** Nights with a known wake time AND a fasting reading within 4h of waking to pair against it. */
function sleepPairedNights(readings: GlucoseReading[], sleepEntries: SleepEntry[]): number {
  const fasting = readings.filter((r) => r.context === 'fasting')
  return sleepEntries.filter((s) => {
    if (s.wakeTimestamp == null) return false
    return fasting.some((r) => {
      const m = minutesAfterWaking(r, s)
      return m != null && m >= 0 && m <= 240
    })
  }).length
}

/**
 * Reports, per analysis category, whether enough of the right KIND of data
 * exists to support it — not just a raw reading count. Prevents the app
 * from producing confident-looking statistics from inadequate data: a
 * category below its minimum is marked insufficient and says what's
 * missing, rather than silently shown with a tiny sample.
 */
export function computeDataQuality(input: {
  readings: GlucoseReading[]
  meals: MealEntry[]
  sleepEntries: SleepEntry[]
  exerciseEntries: ExerciseEntry[]
}): DataQualityItem[] {
  const { readings, meals, sleepEntries, exerciseEntries } = input

  const mealById = new Map(meals.filter((m) => m.id != null).map((m) => [m.id!, m]))
  const linkedReadings = readings.filter((r) => r.mealId != null && mealById.has(r.mealId))
  const linkedBuckets = linkedReadings.map((r) =>
    postMealBucket(actualMinutesSinceMeal(r, mealById.get(r.mealId!)!)),
  )

  const fastingCount = readings.filter((r) => r.context === 'fasting').length
  const oneHourCount = linkedBuckets.filter((b) => b === '0-90').length
  const twoHourCount = linkedBuckets.filter((b) => b === '90-150').length
  const awakeningDays = awakeningTripleDays(readings, sleepEntries)
  const sleepNights = sleepPairedNights(readings, sleepEntries)
  const exerciseLinkedCount = readings.filter((r) => {
    const m = minutesSinceExercise(r, exerciseEntries)
    return m != null && m <= 1440
  }).length
  const mealLinkedCount = linkedReadings.length

  function item(
    label: string,
    count: number,
    min: number,
    missingHint: string,
    unit = 'readings',
  ): DataQualityItem {
    const good = count >= min
    return {
      label,
      status: good ? 'good' : 'insufficient',
      count,
      detail: good ? `${count} ${unit} — good` : `insufficient — need ${missingHint}`,
    }
  }

  return [
    item('Fasting analysis', fastingCount, MIN_FASTING_READINGS, `${MIN_FASTING_READINGS}+ fasting readings (have ${fastingCount})`),
    item('1-hour meal analysis', oneHourCount, MIN_POST_MEAL_READINGS, 'meal IDs linked on 0-90min post-meal readings'),
    item('2-hour meal analysis', twoHourCount, MIN_POST_MEAL_READINGS, 'meal IDs linked on 90-150min post-meal readings'),
    item('Awakening analysis', awakeningDays, MIN_AWAKENING_DAYS, 'T0/T30/T60', 'days'),
    item('Sleep correlation', sleepNights, MIN_SLEEP_PAIRED_NIGHTS, 'sleep/wake timestamps', 'nights'),
    item('Exercise effect', exerciseLinkedCount, MIN_EXERCISE_LINKED_READINGS, 'exercise event linking'),
    item('Meal carbohydrate response', mealLinkedCount, MIN_MEAL_LINKED_READINGS, 'meal IDs/macros'),
  ]
}
