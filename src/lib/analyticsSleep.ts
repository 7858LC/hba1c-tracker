import type { GlucoseReading, SleepEntry } from '../types'
import { sleepVsNextDayGlucose, type LagCorrelationResult } from './correlation'
import { DAY_MS, toDateKey } from './dates'
import { dailyFastingAverage } from './daysMaintained'
import { mean } from './stats'

export const MIN_SLEEP_DURATION_BUCKET_READINGS = 5
export const MIN_SLEEP_QUALITY_BUCKET_READINGS = 5
export const MIN_WASO_BUCKET_READINGS = 5
export const MIN_WAKE_REGULARITY_BUCKET_READINGS = 5

// Judgment calls, not derived from a clinical standard — documented here so
// they can be revisited. 14 nights/3-night minimum mirrors the "need a few
// data points before trusting a baseline" approach used elsewhere (e.g.
// dataQuality.ts's minimums); 14 days specifically so a years-old wake
// pattern doesn't drag down how "regular" a recent night looks.
const WAKE_REGULARITY_LOOKBACK_DAYS = 14
const MIN_WAKE_BASELINE_NIGHTS = 3

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

interface WasoBucketDef {
  label: string
  minMinutes: number
  maxMinutes: number
}

const WASO_BUCKETS: WasoBucketDef[] = [
  { label: '0-15m', minMinutes: 0, maxMinutes: 15 },
  { label: '15-30m', minMinutes: 15, maxMinutes: 30 },
  { label: '30-60m', minMinutes: 30, maxMinutes: 60 },
  { label: '60m+', minMinutes: 60, maxMinutes: Infinity },
]

/**
 * Next-morning fasting glucose grouped by the preceding night's WASO
 * (minutes awake during the sleep period) — a fragmentation proxy distinct
 * from total duration. A short, unbroken night and a long, fragmented one
 * can have the same durationMinutes but very different WASO.
 */
export function computeGlucoseByWaso(readings: GlucoseReading[], sleepEntries: SleepEntry[]): BucketStats[] {
  const fastingByDay = dailyFastingAverage(readings)
  const byBucket = new Map<string, number[]>()
  for (const b of WASO_BUCKETS) byBucket.set(b.label, [])

  for (const s of sleepEntries) {
    const fasting = fastingByDay.get(nextDayKey(s.date))
    if (fasting == null) continue
    const bucket = WASO_BUCKETS.find((b) => s.wasoMinutes >= b.minMinutes && s.wasoMinutes < b.maxMinutes)
    if (bucket) byBucket.get(bucket.label)!.push(fasting)
  }

  return WASO_BUCKETS.map((b) => {
    const values = byBucket.get(b.label)!
    return {
      label: b.label,
      eligible: values.length >= MIN_WASO_BUCKET_READINGS,
      readingCount: values.length,
      mean: mean(values),
    }
  })
}

interface RegularityBucketDef {
  label: string
  minMinutes: number
  maxMinutes: number
}

const WAKE_REGULARITY_BUCKETS: RegularityBucketDef[] = [
  { label: '<30m', minMinutes: 0, maxMinutes: 30 },
  { label: '30-60m', minMinutes: 30, maxMinutes: 60 },
  { label: '60-120m', minMinutes: 60, maxMinutes: 120 },
  { label: '120m+', minMinutes: 120, maxMinutes: Infinity },
]

/** Clock-time-of-day a wake timestamp falls on, in minutes since local midnight. */
function wakeTimeOfDayMinutes(wakeTimestamp: number): number {
  const d = new Date(wakeTimestamp)
  return d.getHours() * 60 + d.getMinutes()
}

/** Shortest distance between two times-of-day, in minutes, handling midnight wraparound. */
function circularMinuteDistance(a: number, b: number): number {
  const raw = Math.abs(a - b)
  return Math.min(raw, 1440 - raw)
}

/**
 * Next-morning fasting glucose grouped by how far that morning's wake time
 * deviated from the person's own recent usual wake time — a circadian
 * regularity signal distinct from duration or WASO. A night can be long and
 * unbroken but still a 3-hour deviation from someone's routine wake time;
 * that irregularity is what this isolates.
 *
 * The baseline is the mean wake-time-of-day over the trailing
 * WAKE_REGULARITY_LOOKBACK_DAYS nights before the one being scored (not
 * including it) — a night is only scored once at least MIN_WAKE_BASELINE_NIGHTS
 * of those trailing nights have a known wake time to compare against.
 */
export function computeGlucoseByWakeRegularity(
  readings: GlucoseReading[],
  sleepEntries: SleepEntry[],
): BucketStats[] {
  const fastingByDay = dailyFastingAverage(readings)
  const byBucket = new Map<string, number[]>()
  for (const b of WAKE_REGULARITY_BUCKETS) byBucket.set(b.label, [])

  const withWake = sleepEntries
    .filter((s): s is SleepEntry & { wakeTimestamp: number } => s.wakeTimestamp != null)
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))

  for (const entry of withWake) {
    const entryDateMs = Date.parse(`${entry.date}T00:00:00`)
    const priorWindow = withWake.filter((e) => {
      const diffDays = (entryDateMs - Date.parse(`${e.date}T00:00:00`)) / DAY_MS
      return diffDays > 0 && diffDays <= WAKE_REGULARITY_LOOKBACK_DAYS
    })
    if (priorWindow.length < MIN_WAKE_BASELINE_NIGHTS) continue

    const fasting = fastingByDay.get(nextDayKey(entry.date))
    if (fasting == null) continue

    const baseline = mean(priorWindow.map((e) => wakeTimeOfDayMinutes(e.wakeTimestamp)))!
    const deviation = circularMinuteDistance(wakeTimeOfDayMinutes(entry.wakeTimestamp), baseline)
    const bucket = WAKE_REGULARITY_BUCKETS.find((b) => deviation >= b.minMinutes && deviation < b.maxMinutes)
    if (bucket) byBucket.get(bucket.label)!.push(fasting)
  }

  return WAKE_REGULARITY_BUCKETS.map((b) => {
    const values = byBucket.get(b.label)!
    return {
      label: b.label,
      eligible: values.length >= MIN_WAKE_REGULARITY_BUCKET_READINGS,
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
