import type { GlucoseReading, MealEntry } from '../types'
import { toDateKey } from './dates'
import { actualMinutesSinceMeal } from './elapsedTime'

export interface AwakeningDaySummary {
  date: string
  t0: number | null
  t30: number | null
  t60: number | null
  riseT0ToT30: number | null
  riseT0ToT60: number | null
  pctRiseT0ToT60: number | null
}

/**
 * Per-day T0/T30/T60 values and rises for one Awakening Glucose Profile
 * run. Deliberately framed as "awakening glucose pattern," not diagnosed
 * as dawn phenomenon or anything else — this is observation, not
 * interpretation.
 */
export function summarizeAwakeningRun(
  readings: GlucoseReading[],
  runId: number,
): AwakeningDaySummary[] {
  const runReadings = readings.filter((r) => r.protocolRunId === runId)
  const byDate = new Map<string, GlucoseReading[]>()
  for (const r of runReadings) {
    const key = toDateKey(r.timestamp)
    const list = byDate.get(key) ?? []
    list.push(r)
    byDate.set(key, list)
  }

  const out: AwakeningDaySummary[] = []
  for (const [date, list] of byDate) {
    const t0 = list.find((r) => r.protocolRole === 'T0')?.value ?? null
    const t30 = list.find((r) => r.protocolRole === 'T30')?.value ?? null
    const t60 = list.find((r) => r.protocolRole === 'T60')?.value ?? null
    out.push({
      date,
      t0,
      t30,
      t60,
      riseT0ToT30: t0 != null && t30 != null ? t30 - t0 : null,
      riseT0ToT60: t0 != null && t60 != null ? t60 - t0 : null,
      pctRiseT0ToT60: t0 != null && t60 != null && t0 !== 0 ? ((t60 - t0) / t0) * 100 : null,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export interface MealResponsePoint {
  role: string
  actualMinutes: number
  value: number
}

export interface MealResponseSummary {
  mealId: number
  baseline: number | null
  points: MealResponsePoint[]
  peak: number | null
  peakExcursion: number | null
  timeToPeakMinutes: number | null
}

/**
 * Baseline/peak/excursion for one Meal Glucose Response run, using ACTUAL
 * elapsed minutes from the linked meal — never the role label alone — so a
 * "90min" reading taken at minute 110 is correctly plotted at 110, not 90.
 */
export function summarizeMealResponse(
  readings: GlucoseReading[],
  mealId: number,
  meal: MealEntry,
): MealResponseSummary {
  const linked = readings.filter((r) => r.mealId === mealId && r.protocolRole != null)
  const baseline = linked.find((r) => r.protocolRole === 'pre')?.value ?? null
  const points: MealResponsePoint[] = linked
    .filter((r) => r.protocolRole !== 'pre')
    .map((r) => ({
      role: r.protocolRole!,
      actualMinutes: actualMinutesSinceMeal(r, meal),
      value: r.value,
    }))
    .sort((a, b) => a.actualMinutes - b.actualMinutes)

  let peak: number | null = baseline
  let timeToPeakMinutes: number | null = baseline != null ? 0 : null
  for (const p of points) {
    if (peak == null || p.value > peak) {
      peak = p.value
      timeToPeakMinutes = p.actualMinutes
    }
  }

  return {
    mealId,
    baseline,
    points,
    peak,
    peakExcursion: baseline != null && peak != null ? peak - baseline : null,
    timeToPeakMinutes,
  }
}
