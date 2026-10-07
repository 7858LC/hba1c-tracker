import type { ExerciseEntry, FastingWindowEntry, GlucoseReading, MealEntry, SleepEntry } from '../types'

/**
 * Actual elapsed minutes from a meal to a glucose reading, computed from
 * real timestamps — never from the reading's context label or
 * targetPostMealMinutes. A reading tagged "post_meal_1h" eaten 152 minutes
 * after the meal is a 152-minute reading, not a 60-minute one.
 */
export function actualMinutesSinceMeal(reading: GlucoseReading, meal: MealEntry): number {
  return Math.round((reading.timestamp - meal.timestamp) / 60_000)
}

export type PostMealBucket = '0-90' | '90-150' | '150-180' | '180+'

/**
 * Buckets ACTUAL elapsed minutes, not the target/label — late post-meal
 * readings must never be pooled into "1-hour"/"2-hour" stats just because
 * that's how they were tagged. A negative elapsed time (reading logged
 * before the meal it's supposedly linked to) is an invalid pairing, not
 * "0 minutes" — returns null rather than silently bucketing it.
 */
export function postMealBucket(actualMinutes: number): PostMealBucket | null {
  if (actualMinutes < 0) return null
  if (actualMinutes <= 90) return '0-90'
  if (actualMinutes <= 150) return '90-150'
  if (actualMinutes <= 180) return '150-180'
  return '180+'
}

/**
 * Minutes from a night's recorded wake moment to a glucose reading. Null
 * when wakeTimestamp is unknown — never inferred from "morning" or from
 * the reading's context label alone.
 */
export function minutesAfterWaking(
  reading: GlucoseReading,
  sleep: Pick<SleepEntry, 'wakeTimestamp'>,
): number | null {
  if (sleep.wakeTimestamp == null) return null
  return Math.round((reading.timestamp - sleep.wakeTimestamp) / 60_000)
}

const DEFAULT_WAKE_LOOKBACK_HOURS = 6
const HOUR_MS = 60 * 60 * 1000

/**
 * Finds the SleepEntry whose wake moment most plausibly applies to this
 * reading: the most recent wakeTimestamp at or before the reading, within
 * `maxLookbackHours` — a "waking"/"fasting" reading taken many hours after
 * actually waking shouldn't silently attach to a stale wake time.
 */
export function findRelevantWake(
  reading: GlucoseReading,
  sleepEntries: SleepEntry[],
  maxLookbackHours: number = DEFAULT_WAKE_LOOKBACK_HOURS,
): SleepEntry | null {
  const maxLookbackMs = maxLookbackHours * HOUR_MS
  let best: SleepEntry | null = null
  for (const s of sleepEntries) {
    if (s.wakeTimestamp == null) continue
    if (s.wakeTimestamp > reading.timestamp) continue
    if (reading.timestamp - s.wakeTimestamp > maxLookbackMs) continue
    if (best?.wakeTimestamp == null || s.wakeTimestamp > best.wakeTimestamp) best = s
  }
  return best
}

const MAX_FASTING_LOOKBACK_HOURS = 72

/**
 * Fasting duration from the end of the most recent known eating window to
 * this reading. Returns null (unknown) when there's no FastingWindowEntry
 * covering this reading, or when the most recent one ended implausibly
 * long ago (>72h — more likely a logging gap than a genuine multi-day
 * fast) — fasting duration is never inferred from time of day or context
 * label alone.
 */
export function fastingDurationMinutes(
  reading: GlucoseReading,
  fastingWindows: FastingWindowEntry[],
): number | null {
  let latestEnd: number | null = null
  for (const w of fastingWindows) {
    if (w.eatingEnd <= reading.timestamp && (latestEnd == null || w.eatingEnd > latestEnd)) {
      latestEnd = w.eatingEnd
    }
  }
  if (latestEnd == null) return null
  if (reading.timestamp - latestEnd > MAX_FASTING_LOOKBACK_HOURS * HOUR_MS) return null
  return Math.round((reading.timestamp - latestEnd) / 60_000)
}

/**
 * Minutes since the most recent exercise event ENDED, relative to a
 * reading — null when no exercise event ended before the reading. Never
 * looks forward: a reading before an exercise event isn't "post-exercise."
 */
export function minutesSinceExercise(
  reading: GlucoseReading,
  exerciseEntries: ExerciseEntry[],
): number | null {
  let mostRecentEnd: number | null = null
  for (const e of exerciseEntries) {
    const end = e.timestamp + e.durationMinutes * 60_000
    if (end <= reading.timestamp && (mostRecentEnd == null || end > mostRecentEnd)) {
      mostRecentEnd = end
    }
  }
  if (mostRecentEnd == null) return null
  return Math.round((reading.timestamp - mostRecentEnd) / 60_000)
}

export type ExerciseRecencyBucket = '0-1h' | '1-3h' | '3-12h' | '12-24h' | 'none'

/** Buckets minutesSinceExercise into the windows the exercise-effect report compares. */
export function exerciseRecencyBucket(minutesSince: number | null): ExerciseRecencyBucket {
  if (minutesSince == null) return 'none'
  if (minutesSince <= 60) return '0-1h'
  if (minutesSince <= 180) return '1-3h'
  if (minutesSince <= 720) return '3-12h'
  if (minutesSince <= 1440) return '12-24h'
  return 'none'
}
