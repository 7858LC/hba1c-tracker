import type { GlucoseReading, HydrationStatus, SleepEntry } from '../types'
import { toDateKey } from './dates'
import { MIN_FASTING_READINGS } from './dataQuality'
import { findRelevantWake, minutesAfterWaking } from './elapsedTime'
import { linearRegression } from './projection'
import { median, mean, range as statsRange, standardDeviation, thresholdPercentages, type Range } from './stats'

export { MIN_FASTING_READINGS }
export const MIN_PRE_MEAL_READINGS = 10

const DAY_MS = 24 * 60 * 60 * 1000

export interface TrendResult {
  slopePerDay: number
  r2: number
  direction: 'rising' | 'falling' | 'flat'
}

const FLAT_SLOPE_THRESHOLD = 0.3

/**
 * Linear trend of value over calendar time. Simple magnitude threshold for
 * "flat" rather than a significance test — this is a descriptive trend
 * line, not a hypothesis test, and is reported alongside r² so the UI can
 * show fit quality rather than asserting the trend is real.
 */
export function computeTrend(readings: { timestamp: number; value: number }[]): TrendResult | null {
  if (readings.length < 2) return null
  const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp)
  const firstDay = sorted[0].timestamp
  const xs = sorted.map((r) => (r.timestamp - firstDay) / DAY_MS)
  const ys = sorted.map((r) => r.value)
  const fit = linearRegression(xs, ys)
  if (!fit) return null
  const direction = Math.abs(fit.slope) < FLAT_SLOPE_THRESHOLD ? 'flat' : fit.slope > 0 ? 'rising' : 'falling'
  return { slopePerDay: fit.slope, r2: fit.r2, direction }
}

/** Average clock time-of-day, in minutes since local midnight (browser-local, same convention the rest of the app's displays use). */
function averageTimeOfDayMinutes(readings: GlucoseReading[]): number | null {
  if (readings.length === 0) return null
  const minutesList = readings.map((r) => {
    const d = new Date(r.timestamp)
    return d.getHours() * 60 + d.getMinutes()
  })
  return mean(minutesList)
}

export interface FastingAnalytics {
  eligible: boolean
  readingCount: number
  mean: number | null
  median: number | null
  range: Range | null
  sd: number | null
  trend: TrendResult | null
  pctAtOrAbove100: number | null
  pctAtOrAbove110: number | null
  pctAtOrAbove126: number | null
  /** mean value of the single earliest fasting reading on each day that has one */
  earliestOfDayMean: number | null
  earliestOfDayCount: number
  /** average clock time-of-day across all fasting readings, minutes since midnight */
  avgTimeOfDayMinutes: number | null
  /** average minutes-after-waking, over only the readings where a wake time is known */
  avgMinutesAfterWaking: number | null
  minutesAfterWakingCount: number
}

export function computeFastingAnalytics(
  readings: GlucoseReading[],
  sleepEntries: SleepEntry[],
): FastingAnalytics {
  const fasting = readings.filter((r) => r.context === 'fasting')
  const values = fasting.map((r) => r.value)

  if (fasting.length === 0) {
    return {
      eligible: false,
      readingCount: 0,
      mean: null,
      median: null,
      range: null,
      sd: null,
      trend: null,
      pctAtOrAbove100: null,
      pctAtOrAbove110: null,
      pctAtOrAbove126: null,
      earliestOfDayMean: null,
      earliestOfDayCount: 0,
      avgTimeOfDayMinutes: null,
      avgMinutesAfterWaking: null,
      minutesAfterWakingCount: 0,
    }
  }

  const thresholds = thresholdPercentages(values, [100, 110, 126])!

  const byDay = new Map<string, GlucoseReading>()
  for (const r of fasting) {
    const key = toDateKey(r.timestamp)
    const existing = byDay.get(key)
    if (!existing || r.timestamp < existing.timestamp) byDay.set(key, r)
  }
  const earliestValues = [...byDay.values()].map((r) => r.value)

  const wakeMinutes: number[] = []
  for (const r of fasting) {
    const wake = findRelevantWake(r, sleepEntries)
    if (!wake) continue
    const m = minutesAfterWaking(r, wake)
    if (m != null) wakeMinutes.push(m)
  }

  return {
    eligible: fasting.length >= MIN_FASTING_READINGS,
    readingCount: fasting.length,
    mean: mean(values),
    median: median(values),
    range: statsRange(values),
    sd: standardDeviation(values),
    trend: computeTrend(fasting),
    pctAtOrAbove100: thresholds.find((t) => t.threshold === 100)!.pct,
    pctAtOrAbove110: thresholds.find((t) => t.threshold === 110)!.pct,
    pctAtOrAbove126: thresholds.find((t) => t.threshold === 126)!.pct,
    earliestOfDayMean: mean(earliestValues),
    earliestOfDayCount: earliestValues.length,
    avgTimeOfDayMinutes: averageTimeOfDayMinutes(fasting),
    avgMinutesAfterWaking: mean(wakeMinutes),
    minutesAfterWakingCount: wakeMinutes.length,
  }
}

export const MIN_HYDRATION_BUCKET_READINGS = 5
const HYDRATION_STATUSES: HydrationStatus[] = ['low', 'normal', 'high']

export interface HydrationBucketStats {
  status: HydrationStatus
  eligible: boolean
  readingCount: number
  mean: number | null
}

/**
 * Fasting glucose grouped by the hydration status self-reported at THAT
 * reading (the optional quick-entry flag) — not a separate tracked
 * behavior, just whatever was already captured when the reading was
 * logged. A crude 3-level self-rating, so treat any signal here as weak
 * evidence at best, never on the level of the sleep/exercise sections.
 */
export function computeFastingByHydration(readings: GlucoseReading[]): HydrationBucketStats[] {
  const fasting = readings.filter((r) => r.context === 'fasting')
  return HYDRATION_STATUSES.map((status) => {
    const values = fasting.filter((r) => r.hydrationStatus === status).map((r) => r.value)
    return {
      status,
      eligible: values.length >= MIN_HYDRATION_BUCKET_READINGS,
      readingCount: values.length,
      mean: mean(values),
    }
  })
}

export interface PreMealAnalytics {
  eligible: boolean
  readingCount: number
  mean: number | null
  median: number | null
  range: Range | null
  trend: TrendResult | null
}

export function computePreMealAnalytics(readings: GlucoseReading[]): PreMealAnalytics {
  const preMeal = readings.filter((r) => r.context === 'pre_meal')
  const values = preMeal.map((r) => r.value)

  return {
    eligible: preMeal.length >= MIN_PRE_MEAL_READINGS,
    readingCount: preMeal.length,
    mean: mean(values),
    median: median(values),
    range: statsRange(values),
    trend: computeTrend(preMeal),
  }
}
