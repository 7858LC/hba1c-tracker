import type { GlucoseReading } from '../types'
import { DAY_MS, daySpan } from './dates'
import { rollingEA1CSeries } from './ea1c'

export const MIN_DAYS_FOR_PROJECTION = 14

export interface LinearFit {
  slope: number
  intercept: number
  /** coefficient of determination, 0-1, how well the line fits the points */
  r2: number
}

/** Ordinary least squares on (x, y) pairs. */
export function linearRegression(xs: number[], ys: number[]): LinearFit | null {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2 }
}

export type ProjectionStatus =
  | 'insufficient_data'
  | 'goal_met'
  | 'not_on_track'
  | 'projected'

export interface ProjectionResult {
  status: ProjectionStatus
  daysOfData: number
  currentEA1C: number | null
  /** eA1C change per day; negative means improving toward the goal */
  slopePerDay: number | null
  r2: number | null
  goal: number
  projectedDate: string | null
  projectedDaysRemaining: number | null
}

/**
 * Projects whether the current eA1C trend reaches `goal` and when, by
 * fitting a line to a trailing-window eA1C series and solving for the day
 * the line crosses the goal. Refuses to project (status: insufficient_data)
 * below MIN_DAYS_FOR_PROJECTION days of readings, rather than show a
 * false-confidence line on sparse data.
 */
export function projectTargetDate(
  readings: GlucoseReading[],
  goal: number,
  now: number = Date.now(),
  trendWindowDays: number = 14,
): ProjectionResult {
  const daysOfData = daySpan(readings.map((r) => r.timestamp))

  if (daysOfData < MIN_DAYS_FOR_PROJECTION) {
    return {
      status: 'insufficient_data',
      daysOfData,
      currentEA1C: null,
      slopePerDay: null,
      r2: null,
      goal,
      projectedDate: null,
      projectedDaysRemaining: null,
    }
  }

  const series = rollingEA1CSeries(readings, trendWindowDays, now).filter(
    (p) => p.value != null,
  )

  if (series.length < MIN_DAYS_FOR_PROJECTION) {
    return {
      status: 'insufficient_data',
      daysOfData,
      currentEA1C: null,
      slopePerDay: null,
      r2: null,
      goal,
      projectedDate: null,
      projectedDaysRemaining: null,
    }
  }

  const xs = series.map((p) => p.timestamp / DAY_MS)
  const ys = series.map((p) => p.value as number)
  const currentEA1C = ys[ys.length - 1]

  if (currentEA1C <= goal) {
    return {
      status: 'goal_met',
      daysOfData,
      currentEA1C,
      slopePerDay: null,
      r2: null,
      goal,
      projectedDate: null,
      projectedDaysRemaining: null,
    }
  }

  const fit = linearRegression(xs, ys)
  if (!fit || fit.slope >= 0) {
    return {
      status: 'not_on_track',
      daysOfData,
      currentEA1C,
      slopePerDay: fit?.slope ?? null,
      r2: fit?.r2 ?? null,
      goal,
      projectedDate: null,
      projectedDaysRemaining: null,
    }
  }

  const xGoal = (goal - fit.intercept) / fit.slope
  const xLast = xs[xs.length - 1]
  const daysRemaining = xGoal - xLast

  if (daysRemaining <= 0) {
    return {
      status: 'not_on_track',
      daysOfData,
      currentEA1C,
      slopePerDay: fit.slope,
      r2: fit.r2,
      goal,
      projectedDate: null,
      projectedDaysRemaining: null,
    }
  }

  const projectedDate = new Date(now + daysRemaining * DAY_MS).toISOString().slice(0, 10)

  return {
    status: 'projected',
    daysOfData,
    currentEA1C,
    slopePerDay: fit.slope,
    r2: fit.r2,
    goal,
    projectedDate,
    projectedDaysRemaining: Math.round(daysRemaining),
  }
}
