import type { GlucoseReading } from '../types'
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

export interface EA1CResult {
  /** null when there is no data at all in the window */
  value: number | null
  avgGlucose: number | null
  readingCount: number
  /** number of distinct calendar days with at least one reading in-window */
  daysWithData: number
  /** the requested window size, e.g. 30/60/90 */
  windowDays: number
  /** true once daysWithData >= windowDays (or all available history if shorter) */
  isFullWindow: boolean
}

const MIN_READINGS_FOR_ESTIMATE = 5

export function calculateRollingEA1C(
  readings: GlucoseReading[],
  windowDays: number,
  now: number = Date.now(),
): EA1CResult {
  const since = daysAgo(windowDays, now)
  const inWindow = readings.filter((r) => r.timestamp >= since && r.timestamp <= now)
  const daysWithData = new Set(inWindow.map((r) => toDateKey(r.timestamp))).size

  if (inWindow.length < MIN_READINGS_FOR_ESTIMATE) {
    return {
      value: null,
      avgGlucose: null,
      readingCount: inWindow.length,
      daysWithData,
      windowDays,
      isFullWindow: false,
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
