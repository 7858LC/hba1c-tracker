import type { GlucoseReading, SleepEntry } from '../types'
import { sleepVsNextDayGlucose, type LagCorrelationResult } from './correlation'
import { DAY_MS, toDateKey } from './dates'
import { dailyFastingAverage } from './daysMaintained'
import { mean } from './stats'

export const MIN_SLEEP_DURATION_BUCKET_READINGS = 5
export const MIN_SLEEP_QUALITY_BUCKET_READINGS = 5

interface DurationBucketDef {
  label: string
  minHours: number
  maxHours: number
}

const DURATION_BUCKETS: DurationBucketDef[] = [
  { label: '<6h', minHours: 0, maxHours: 6 },
  { label: '6-7h', minHours: 6, maxHours: 7 },
  { label: '7-8h', minHours: 7, maxHours: 8 },
  { label: '8-9h', minHours: 8, maxHours: 9 },
  { label: '9h+', minHours: 9, maxHours: Infinity },
]

export interface BucketStats {
  label: string
  eligible: boolean
  readingCount: number
  mean: number | null
}

function nextDayKey(dateKey: string): string {
  return toDateKey(Date.parse(`${dateKey}T00:00:00`) + DAY_MS)
}

/** Next-morning fasting glucose grouped by the preceding night's sleep duration. */
export function computeGlucoseBySleepDuration(
  readings: GlucoseReading[],
  sleepEntries: SleepEntry[],
): BucketStats[] {
  const fastingByDay = dailyFastingAverage(readings)
  const byBucket = new Map<string, number[]>()
  for (const b of DURATION_BUCKETS) byBucket.set(b.label, [])

  for (const s of sleepEntries) {
    const fasting = fastingByDay.get(nextDayKey(s.date))
    if (fasting == null) continue
    const hours = s.durationMinutes / 60
    const bucket = DURATION_BUCKETS.find((b) => hours >= b.minHours && hours < b.maxHours)
    if (bucket) byBucket.get(bucket.label)!.push(fasting)
  }

  return DURATION_BUCKETS.map((b) => {
    const values = byBucket.get(b.label)!
    return {
      label: b.label,
      eligible: values.length >= MIN_SLEEP_DURATION_BUCKET_READINGS,
      readingCount: values.length,
      mean: mean(values),
    }
  })
}

/** Next-morning fasting glucose grouped by the preceding night's self-reported sleep quality (1-5). */
export function computeGlucoseBySleepQuality(
  readings: GlucoseReading[],
  sleepEntries: SleepEntry[],
): BucketStats[] {
  const fastingByDay = dailyFastingAverage(readings)
  const byQuality = new Map<number, number[]>()
  for (let q = 1; q <= 5; q++) byQuality.set(q, [])

  for (const s of sleepEntries) {
    if (s.sleepQuality == null) continue
    const fasting = fastingByDay.get(nextDayKey(s.date))
    if (fasting == null) continue
    byQuality.get(s.sleepQuality)!.push(fasting)
  }

  return [1, 2, 3, 4, 5].map((q) => {
    const values = byQuality.get(q)!
    return {
      label: `Quality ${q}`,
      eligible: values.length >= MIN_SLEEP_QUALITY_BUCKET_READINGS,
      readingCount: values.length,
      mean: mean(values),
    }
  })
}

/**
 * The specific check the spec calls out: sleep duration vs next-morning
 * fasting glucose, as a plain paired-day correlation — reuses the
 * existing, already-tested correlation.ts implementation rather than
 * duplicating it. (The "time after waking" angle of Section I is covered
 * by Section E's minutesVsGlucoseR, not recomputed here.)
 */
export function computeSleepDurationFastingCorrelation(
  sleepEntries: SleepEntry[],
  readings: GlucoseReading[],
): LagCorrelationResult {
  return sleepVsNextDayGlucose(sleepEntries, readings)
}
