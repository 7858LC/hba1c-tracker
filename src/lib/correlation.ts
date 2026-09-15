import type { ExerciseEntry, GlucoseReading, MealEntry } from '../types'
import { DAY_MS, toDateKey } from './dates'

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n !== ys.length || n < 3) return null
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx2 = 0
  let dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  if (denom === 0) return null
  return num / denom
}

function dailyAverage(entries: { timestamp: number }[], valueOf: (e: any) => number) {
  const sums = new Map<string, { total: number; count: number }>()
  for (const e of entries) {
    const key = toDateKey(e.timestamp)
    const bucket = sums.get(key) ?? { total: 0, count: 0 }
    bucket.total += valueOf(e)
    bucket.count += 1
    sums.set(key, bucket)
  }
  const out = new Map<string, number>()
  for (const [key, { total, count }] of sums) out.set(key, total / count)
  return out
}

function dailySum(entries: { timestamp: number }[], valueOf: (e: any) => number) {
  const sums = new Map<string, number>()
  for (const e of entries) {
    const key = toDateKey(e.timestamp)
    sums.set(key, (sums.get(key) ?? 0) + valueOf(e))
  }
  return sums
}

export interface LagCorrelationPoint {
  /** date of the leading-indicator day */
  date: string
  x: number
  y: number
}

export interface LagCorrelationResult {
  r: number | null
  n: number
  points: LagCorrelationPoint[]
  xLabel: string
  yLabel: string
}

/**
 * Correlates a same-day leading indicator (carbs, exercise minutes) against
 * NEXT-day average glucose. Deliberately a plain Pearson r over visible
 * paired points, not a fitted model — the chart of `points` is the proof,
 * not a hidden coefficient.
 */
export function carbsVsNextDayGlucose(
  meals: MealEntry[],
  readings: GlucoseReading[],
): LagCorrelationResult {
  const carbsByDay = dailySum(meals, (m: MealEntry) => m.carbsGrams)
  const glucoseByDay = dailyAverage(readings, (r: GlucoseReading) => r.value)
  const points: LagCorrelationPoint[] = []
  for (const [dateKey, carbs] of carbsByDay) {
    const nextDay = new Date(dateKey + 'T00:00:00')
    nextDay.setTime(nextDay.getTime() + DAY_MS)
    const nextDayKey = toDateKey(nextDay.getTime())
    const glucose = glucoseByDay.get(nextDayKey)
    if (glucose != null) points.push({ date: dateKey, x: carbs, y: glucose })
  }
  points.sort((a, b) => a.date.localeCompare(b.date))
  return {
    r: pearsonCorrelation(
      points.map((p) => p.x),
      points.map((p) => p.y),
    ),
    n: points.length,
    points,
    xLabel: 'Carbs (g) that day',
    yLabel: 'Avg glucose (mg/dL) next day',
  }
}

export function exerciseVsNextDayGlucose(
  exercise: ExerciseEntry[],
  readings: GlucoseReading[],
): LagCorrelationResult {
  const minutesByDay = dailySum(exercise, (e: ExerciseEntry) => e.durationMinutes)
  const glucoseByDay = dailyAverage(readings, (r: GlucoseReading) => r.value)
  const allDays = new Set<string>([...minutesByDay.keys(), ...glucoseByDay.keys()])
  const points: LagCorrelationPoint[] = []
  for (const dateKey of allDays) {
    const minutes = minutesByDay.get(dateKey) ?? 0
    const nextDay = new Date(dateKey + 'T00:00:00')
    nextDay.setTime(nextDay.getTime() + DAY_MS)
    const nextDayKey = toDateKey(nextDay.getTime())
    const glucose = glucoseByDay.get(nextDayKey)
    if (glucose != null) points.push({ date: dateKey, x: minutes, y: glucose })
  }
  points.sort((a, b) => a.date.localeCompare(b.date))
  return {
    r: pearsonCorrelation(
      points.map((p) => p.x),
      points.map((p) => p.y),
    ),
    n: points.length,
    points,
    xLabel: 'Exercise (min) that day',
    yLabel: 'Avg glucose (mg/dL) next day',
  }
}
