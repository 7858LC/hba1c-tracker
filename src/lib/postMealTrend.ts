import type { GlucoseContext, GlucoseReading } from '../types'
import { DAY_MS, toDateKey } from './dates'

function dailyAverageByContext(
  readings: GlucoseReading[],
  context: GlucoseContext,
): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>()
  for (const r of readings) {
    if (r.context !== context) continue
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

export interface PostMealSeriesPoint {
  date: string
  value1h: number | null
  value2h: number | null
}

/**
 * Daily average 1hr and 2hr post-meal glucose over a trailing window, as
 * two parallel series for a single chart — same chart shape as
 * dailyFastingSeries, but carrying both post-meal contexts side by side so
 * they can be given the same visual prominence as the fasting trend line,
 * not folded into a secondary/smaller chart.
 */
export function dailyPostMealSeries(
  readings: GlucoseReading[],
  windowDays: number,
  now: number = Date.now(),
): PostMealSeriesPoint[] {
  const daily1h = dailyAverageByContext(readings, 'post_meal_1h')
  const daily2h = dailyAverageByContext(readings, 'post_meal_2h')
  const since = now - windowDays * DAY_MS

  const allDates = new Set([...daily1h.keys(), ...daily2h.keys()])
  return [...allDates]
    .filter((dateKey) => Date.parse(`${dateKey}T00:00:00`) >= since)
    .map((date) => ({
      date,
      value1h: daily1h.get(date) ?? null,
      value2h: daily2h.get(date) ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
