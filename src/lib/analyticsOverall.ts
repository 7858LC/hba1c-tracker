import type { GlucoseReading } from '../types'
import { toDateKey } from './dates'
import { glucoseToEA1C } from './ea1c'
import {
  bandDistribution,
  coefficientOfVariation,
  mean,
  median,
  range,
  standardDeviation,
  type DistributionResult,
  type Range,
} from './stats'

export const MIN_OVERALL_READINGS = 10

const OVERALL_BANDS = [
  { label: '<70', min: 0, max: 69 },
  { label: '70-99', min: 70, max: 99 },
  { label: '100-125', min: 100, max: 125 },
  { label: '>=126', min: 126, max: null },
]

export interface OverallAnalytics {
  eligible: boolean
  totalReadings: number
  dateRangeStart: string | null
  dateRangeEnd: string | null
  mean: number | null
  median: number | null
  range: Range | null
  sd: number | null
  cv: number | null
  /**
   * Meter-derived estimate (ADAG formula applied to the mean of ALL
   * readings in range) — NOT a diagnostic HbA1c, and NOT the same
   * calculation as the dashboard's gated eA1C (which requires fasting +
   * meal-relative diversity). Always labeled GMI in the UI to keep it
   * visually distinct from a lab result.
   */
  gmi: number | null
  distribution: DistributionResult[] | null
}

/**
 * Section A (Overall) of the analytics engine. Observed data only — no
 * interpretation. `eligible` reflects a minimum sample size, not data
 * shape (unlike the per-category checks in dataQuality.ts); values are
 * still computed below the minimum so a caller can show them as
 * preliminary if it chooses, but the standalone dashboard display should
 * gate on `eligible`.
 */
export function computeOverallAnalytics(readings: GlucoseReading[]): OverallAnalytics {
  if (readings.length === 0) {
    return {
      eligible: false,
      totalReadings: 0,
      dateRangeStart: null,
      dateRangeEnd: null,
      mean: null,
      median: null,
      range: null,
      sd: null,
      cv: null,
      gmi: null,
      distribution: null,
    }
  }

  const values = readings.map((r) => r.value)
  const timestamps = readings.map((r) => r.timestamp)
  const m = mean(values)

  return {
    eligible: readings.length >= MIN_OVERALL_READINGS,
    totalReadings: readings.length,
    dateRangeStart: toDateKey(Math.min(...timestamps)),
    dateRangeEnd: toDateKey(Math.max(...timestamps)),
    mean: m,
    median: median(values),
    range: range(values),
    sd: standardDeviation(values),
    cv: coefficientOfVariation(values),
    gmi: m != null ? glucoseToEA1C(m) : null,
    distribution: bandDistribution(values, OVERALL_BANDS),
  }
}
