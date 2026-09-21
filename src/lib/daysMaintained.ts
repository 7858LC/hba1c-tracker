import type { GlucoseReading } from '../types'
import { DAY_MS, toDateKey } from './dates'

/**
 * How many consecutive days of over-target fasting readings count as a
 * real break, resetting the "days maintained" count — not a single bad
 * day, which would zero out months of durable progress the way an
 * all-or-nothing streak does.
 */
export const SUSTAINED_BREAK_DAYS = 3

export function dailyFastingAverage(readings: GlucoseReading[]): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>()
  for (const r of readings) {
    if (r.context !== 'fasting') continue
    const key = toDateKey(r.timestamp)
    const bucket = sums.get(key) ?? { total: 0, count: 0 }
    bucket.total += r.value
    bucket.count += 1
    sums.set(key, bucket)
  }
  const out = new Map<string, number>()
  for (const [key, { total, count }] of sums) out.set(key, total / count)
  return out
}

export interface DaysMaintainedResult {
  /** null when there is no fasting data at all */
  daysMaintained: number | null
  /** first day of the current regime, or null with no data */
  regimeStartDate: string | null
  /** 0, 1, or 2 — how many consecutive over-target days have accrued
   * toward the next reset (a soft warning, not yet a break) */
  daysCurrentlyOver: number
  target: number
}

/**
 * The headline "days maintained under target" count. Counts calendar days
 * since the most recent SUSTAINED_BREAK_DAYS-long run of over-target
 * fasting readings ended — a day with no fasting reading logged neither
 * extends nor breaks this (it's not evidence either way), only actual
 * over-target readings do.
 */
export function computeDaysMaintained(
  readings: GlucoseReading[],
  target: number,
  now: number = Date.now(),
): DaysMaintainedResult {
  const dailyFasting = dailyFastingAverage(readings)
  if (dailyFasting.size === 0) {
    return { daysMaintained: null, regimeStartDate: null, daysCurrentlyOver: 0, target }
  }

  const firstDateKey = [...dailyFasting.keys()].sort()[0]
  const firstDay = Date.parse(`${firstDateKey}T00:00:00`)
  const lastDay = Date.parse(`${toDateKey(now)}T00:00:00`)

  let regimeStart = firstDay
  let consecutiveOver = 0

  for (let day = firstDay; day <= lastDay; day += DAY_MS) {
    const value = dailyFasting.get(toDateKey(day))
    // A gap day (no reading) breaks the CONSECUTIVE-days claim the same
    // way an under-target day does — you can't say 3 consecutive days ran
    // over target when the middle day has no evidence either way. It does
    // NOT roll daysMaintained itself backward, only resets the streak
    // that's building toward a break.
    if (value != null && value > target) {
      consecutiveOver++
      if (consecutiveOver >= SUSTAINED_BREAK_DAYS) {
        regimeStart = day + DAY_MS
        consecutiveOver = 0
      }
    } else {
      consecutiveOver = 0
    }
  }

  const daysMaintained = Math.max(0, Math.floor((lastDay - regimeStart) / DAY_MS) + 1)

  return {
    daysMaintained,
    regimeStartDate: toDateKey(regimeStart),
    daysCurrentlyOver: consecutiveOver,
    target,
  }
}

export interface FastingSeriesPoint {
  date: string
  value: number
}

/** Daily average fasting glucose over a trailing window, for a trend chart. */
export function dailyFastingSeries(
  readings: GlucoseReading[],
  windowDays: number,
  now: number = Date.now(),
): FastingSeriesPoint[] {
  const dailyFasting = dailyFastingAverage(readings)
  const since = now - windowDays * DAY_MS
  return [...dailyFasting.entries()]
    .filter(([dateKey]) => Date.parse(`${dateKey}T00:00:00`) >= since)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
