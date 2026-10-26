import type { GlucoseContext, GlucoseReading, LabA1cEntry } from '../types'
import { DAY_MS } from './dates'
import { GMI_SLOPE } from './gmi'

/**
 * Hours of the day each reading context stands in for. These are
 * ASSUMPTIONS, not measurements: GMI was built from continuous data that
 * samples every hour equally, so a plain mean of fingersticks over-weights
 * whichever context is checked most often. Weighting by the clock time a
 * context represents is the closest fingerstick approximation. Contexts not
 * listed here (random, bedtime, ...) are left out of the weighted mean.
 */
export const CONTEXT_HOURS: Partial<Record<GlucoseContext, number>> = {
  fasting: 8,
  pre_meal: 1,
  post_meal_1h: 1.5,
  post_meal_2h: 1.5,
}

/** Look-back used to describe "current" average glucose. */
export const BASELINE_WINDOW_DAYS = 28
/** Minimum weighted-context readings in that window before forecasting. */
export const MIN_BASELINE_READINGS = 10
/** HbA1c reflects ~90 days, weighted toward the most recent month. */
export const FORECAST_WINDOW_DAYS = 90
const RECENCY_WEIGHTS = [0.5, 0.25, 0.25]
const BIN_DAYS = FORECAST_WINDOW_DAYS / RECENCY_WEIGHTS.length
/** Rough ± to show around an estimate; GMI and lab HbA1c often differ by this much or more. */
export const FORECAST_RANGE = 0.25

export interface WeightedMean {
  mean: number
  readingsUsed: number
  contextsUsed: GlucoseContext[]
}

/**
 * Mean of per-context means, each weighted by CONTEXT_HOURS. Contexts with
 * no readings drop out and the remaining weights renormalize. Returns null
 * when no reading belongs to a weighted context.
 */
export function contextWeightedMean(readings: GlucoseReading[]): WeightedMean | null {
  const byContext = new Map<GlucoseContext, number[]>()
  for (const r of readings) {
    if (CONTEXT_HOURS[r.context] == null) continue
    const list = byContext.get(r.context) ?? []
    list.push(r.value)
    byContext.set(r.context, list)
  }
  if (byContext.size === 0) return null

  let weighted = 0
  let totalWeight = 0
  let readingsUsed = 0
  for (const [context, values] of byContext) {
    const hours = CONTEXT_HOURS[context]!
    const contextMean = values.reduce((s, v) => s + v, 0) / values.length
    weighted += contextMean * hours
    totalWeight += hours
    readingsUsed += values.length
  }
  return { mean: weighted / totalWeight, readingsUsed, contextsUsed: [...byContext.keys()] }
}

/**
 * Share of the lab's 90-day window (counting the most recent 30 days at
 * 50%, the middle 30 at 25%, the oldest 30 at 25%) that falls AFTER
 * `baselineEnd`, i.e. the part of the window that can still change.
 */
export function shareOfWindowAfter(baselineEnd: number, labTime: number): number {
  const binMs = BIN_DAYS * DAY_MS
  let share = 0
  RECENCY_WEIGHTS.forEach((weight, i) => {
    const binEnd = labTime - i * binMs
    const binStart = binEnd - binMs
    const overlap = Math.max(0, binEnd - Math.max(binStart, baselineEnd))
    share += (weight * Math.min(overlap, binMs)) / binMs
  })
  return share
}

export interface ForecastRow {
  label: string
  meanGlucose: number
  /** estimated lab HbA1c on the lab date */
  labEstimate: number
  /** what a lab would show if this average were held for the full 90 days */
  heldNinetyDays: number
}

export type ForecastResult =
  | { status: 'no_lab' }
  | { status: 'insufficient_data'; readingsUsed: number }
  | {
      status: 'ok'
      anchorPercent: number
      anchorDate: string
      baselineMean: number
      baselineEnd: number
      readingsUsed: number
      /** share of the lab window that can still change; 0 means the lab date is not after the data */
      shareAfter: number
      /** average glucose that, held for 90 days, lands exactly on `goal` */
      meanNeededForGoal: number
      rows: ForecastRow[]
    }

const SCENARIO_DROPS = [0, 2, 4, 8, 12]

/**
 * Lab-anchored scenario model, not a prediction. Starts from the latest real
 * lab and shifts it by the change in average glucose since the baseline
 * window, scaled by how much of the lab's 90-day window is still open:
 *
 *   estimate = lab + shareAfter × GMI_SLOPE × (newMean − baselineMean)
 *
 * Anchoring on the lab, rather than on GMI(newMean), keeps the person's own
 * lab-versus-meter offset instead of discarding it.
 */
export function computeLabForecast(
  labs: LabA1cEntry[],
  readings: GlucoseReading[],
  goal: number,
  labTime: number,
): ForecastResult {
  if (labs.length === 0) return { status: 'no_lab' }
  const anchor = [...labs].sort((a, b) => b.labDate.localeCompare(a.labDate))[0]

  const latestReading = readings.reduce((m, r) => Math.max(m, r.timestamp), 0)
  const since = latestReading - BASELINE_WINDOW_DAYS * DAY_MS
  const inWindow = readings.filter((r) => r.timestamp > since && r.timestamp <= latestReading)
  const baseline = contextWeightedMean(inWindow)
  if (!baseline || baseline.readingsUsed < MIN_BASELINE_READINGS) {
    return { status: 'insufficient_data', readingsUsed: baseline?.readingsUsed ?? 0 }
  }

  const shareAfter = shareOfWindowAfter(latestReading, labTime)
  const at = (meanGlucose: number, share: number) =>
    anchor.a1cPercent + share * GMI_SLOPE * (meanGlucose - baseline.mean)

  const rows: ForecastRow[] = SCENARIO_DROPS.map((drop) => {
    const meanGlucose = baseline.mean - drop
    return {
      label: drop === 0 ? 'Same as baseline' : `${drop} mg/dL lower`,
      meanGlucose,
      labEstimate: at(meanGlucose, shareAfter),
      heldNinetyDays: at(meanGlucose, 1),
    }
  })

  return {
    status: 'ok',
    anchorPercent: anchor.a1cPercent,
    anchorDate: anchor.labDate,
    baselineMean: baseline.mean,
    baselineEnd: latestReading,
    readingsUsed: baseline.readingsUsed,
    shareAfter,
    meanNeededForGoal: baseline.mean + (goal - anchor.a1cPercent) / GMI_SLOPE,
    rows,
  }
}
