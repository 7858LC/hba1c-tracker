import type { GlucoseContext, GlucoseReading } from '../types'
import { DAY_MS, daysAgo, toDateKey } from './dates'

/**
 * ADAG (A1c-Derived Average Glucose) formula, the standard published
 * mapping between mean blood glucose and estimated HbA1c:
 *   eA1C(%) = (avg mg/dL + 46.7) / 28.7
 * Source: Nathan DM et al., Diabetes Care 2008;31(8):1473-8.
 * Known error margin: roughly ±0.5% around the point estimate — always
 * surface that alongside the number, this is an estimate, not a lab result.
 */
export const ADAG_OFFSET = 46.7
export const ADAG_DIVISOR = 28.7
export const ADAG_ERROR_MARGIN = 0.5

export function glucoseToEA1C(avgGlucoseMgDl: number): number {
  return (avgGlucoseMgDl + ADAG_OFFSET) / ADAG_DIVISOR
}

export function ea1cToGlucose(ea1c: number): number {
  return ea1c * ADAG_DIVISOR - ADAG_OFFSET
}

/**
 * Minimum recent data density required before an eA1C NUMBER is shown at
 * all — evaluated over a fixed 30-day lookback regardless of which display
 * window (30/60/90d) is selected. A 7-day gate was considered and rejected
 * as too permissive: the question this answers is "have you been logging
 * consistently for close to a month," not "did you log a handful of
 * readings recently." Below this bar the UI falls back to a plain glucose
 * average — a weaker, still-honest claim — rather than a number dressed up
 * to look like an estimate it isn't.
 */
export const DENSITY_WINDOW_DAYS = 30
/** "Most days" — roughly two-thirds of the 30-day window's calendar days. */
const MIN_DENSITY_DAY_RATIO = 2 / 3
export const MIN_DENSITY_DAYS = Math.ceil(DENSITY_WINDOW_DAYS * MIN_DENSITY_DAY_RATIO)

const MEAL_RELATIVE_CONTEXTS: GlucoseContext[] = ['pre_meal', 'post_meal_1h', 'post_meal_2h']

export interface EA1CEligibility {
  eligible: boolean
  daysWithData: number
  requiredDays: number
  windowDays: number
  hasFastingReading: boolean
  hasMealRelativeReading: boolean
}

/**
 * Checks the fixed 30-day density/diversity bar an eA1C number must clear,
 * independent of whichever 30/60/90-day window is being displayed — so a
 * user who just started 90-day-window viewing doesn't get a number built
 * on 6 readings just because the display window is wide.
 */
export function checkEA1CEligibility(
  readings: GlucoseReading[],
  now: number = Date.now(),
): EA1CEligibility {
  const since = daysAgo(DENSITY_WINDOW_DAYS, now)
  const inWindow = readings.filter((r) => r.timestamp >= since && r.timestamp <= now)
  const daysWithData = new Set(inWindow.map((r) => toDateKey(r.timestamp))).size
  const hasFastingReading = inWindow.some((r) => r.context === 'fasting')
  const hasMealRelativeReading = inWindow.some((r) => MEAL_RELATIVE_CONTEXTS.includes(r.context))

  return {
    eligible: daysWithData >= MIN_DENSITY_DAYS && hasFastingReading && hasMealRelativeReading,
    daysWithData,
    requiredDays: MIN_DENSITY_DAYS,
    windowDays: DENSITY_WINDOW_DAYS,
    hasFastingReading,
    hasMealRelativeReading,
  }
}

const MIN_READINGS_FOR_ESTIMATE = 5

export interface EA1CResult {
  /**
   * The window's eA1C, gated only by MIN_READINGS_FOR_ESTIMATE — NOT by
   * `eligibility`. This function is also the trend chart's and the
   * projection engine's per-day building block, and gating every one of
   * those points on the stricter 30-day bar would multiply how much data
   * a trend/projection needs by several times over, which is a much
   * bigger change than "don't show a misleadingly precise headline
   * number." Callers of a standalone display (see EA1CCard) should check
   * `eligibility.eligible` themselves before showing `value` as a real
   * eA1C; callers building a trend line can use `value` as-is.
   */
  value: number | null
  /** plain average glucose for the window — meaningful even when `value` is null */
  avgGlucose: number | null
  readingCount: number
  /** number of distinct calendar days with at least one reading in-window */
  daysWithData: number
  /** the requested window size, e.g. 30/60/90 */
  windowDays: number
  /** true once daysWithData >= windowDays (or all available history if shorter) */
  isFullWindow: boolean
  /** the fixed 30-day density/diversity check — informational; not applied to `value` here */
  eligibility: EA1CEligibility
}

export function calculateRollingEA1C(
  readings: GlucoseReading[],
  windowDays: number,
  now: number = Date.now(),
): EA1CResult {
  const eligibility = checkEA1CEligibility(readings, now)

  const since = daysAgo(windowDays, now)
  const inWindow = readings.filter((r) => r.timestamp >= since && r.timestamp <= now)
  const daysWithData = new Set(inWindow.map((r) => toDateKey(r.timestamp))).size

  if (inWindow.length < MIN_READINGS_FOR_ESTIMATE) {
    return {
      value: null,
      avgGlucose: inWindow.length > 0 ? inWindow.reduce((s, r) => s + r.value, 0) / inWindow.length : null,
      readingCount: inWindow.length,
      daysWithData,
      windowDays,
      isFullWindow: false,
      eligibility,
    }
  }

  const avgGlucose = inWindow.reduce((sum, r) => sum + r.value, 0) / inWindow.length
  return {
    value: glucoseToEA1C(avgGlucose),
    avgGlucose,
    readingCount: inWindow.length,
    daysWithData,
    windowDays,
    isFullWindow: daysWithData >= windowDays,
    eligibility,
  }
}

/**
 * The gated version for a standalone display (see EA1CCard): `value` is
 * null unless the fixed 30-day density/diversity bar is also cleared, not
 * just MIN_READINGS_FOR_ESTIMATE. `avgGlucose` is always populated when
 * there's any data, so a caller can fall back to "raw average, no eA1C"
 * rather than showing nothing.
 */
export function calculateGatedEA1C(
  readings: GlucoseReading[],
  windowDays: number,
  now: number = Date.now(),
): EA1CResult {
  const result = calculateRollingEA1C(readings, windowDays, now)
  return {
    ...result,
    value: result.eligibility.eligible ? result.value : null,
  }
}

export interface EA1CSeriesPoint {
  /** YYYY-MM-DD, the last day included in this trailing window */
  date: string
  timestamp: number
  value: number | null
  readingCount: number
}

/**
 * Daily series of a trailing-window eA1C, one point per calendar day that
 * has at least one reading anywhere in its trailing window. Used for the
 * trend chart and as the projection engine's input series.
 */
export function rollingEA1CSeries(
  readings: GlucoseReading[],
  windowDays: number,
  now: number = Date.now(),
): EA1CSeriesPoint[] {
  if (readings.length === 0) return []
  const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp)
  const firstDay = Math.floor(sorted[0].timestamp / DAY_MS) * DAY_MS
  const lastDay = Math.floor(now / DAY_MS) * DAY_MS

  const points: EA1CSeriesPoint[] = []
  for (let day = firstDay; day <= lastDay; day += DAY_MS) {
    const dayEnd = day + DAY_MS - 1
    const result = calculateRollingEA1C(sorted, windowDays, dayEnd)
    if (result.readingCount > 0) {
      points.push({
        date: toDateKey(day),
        timestamp: dayEnd,
        value: result.value,
        readingCount: result.readingCount,
      })
    }
  }
  return points
}
