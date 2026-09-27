import type { AdherenceEntry, GlucoseReading, Protocol } from '../types'
import { DAY_MS, toDateKey } from './dates'
import { evaluateReading, hasExplicitTarget, type TargetContext } from './glycemicTargets'

const SCORE_WINDOW_DAYS = 14
const FLOOR_LOOKBACK_DAYS = 90

/**
 * Below this rolling-14-day adherence score (%), a degradation alert fires
 * — an early-warning signal for drift, distinct from the burnout flag below.
 */
export const DEGRADATION_ALERT_THRESHOLD = 50

/**
 * A day at/above this adherence % counts toward the burnout-risk streak.
 * 45+ consecutive such days is the early-warning version of the pattern
 * that historically preceded a drop-off: a hard push that isn't durable.
 */
export const BURNOUT_INTENSITY_THRESHOLD = 90
export const BURNOUT_MIN_DAYS = 45

/**
 * % of a day's target-context readings (fasting/pre-meal/1hr/2hr post) that
 * landed in their own glycemic target. Days with zero such readings are
 * left out of the map entirely — treated as no evidence either way, not as
 * a failure — so a day with no glucose logged doesn't silently zero out an
 * otherwise-solid checklist day (that would double-penalize sparse glucose
 * logging, which the eA1C density gate already accounts for separately).
 */
function buildDailyGlycemicPctMap(readings: GlucoseReading[]): Map<string, number> {
  const byDay = new Map<string, GlucoseReading[]>()
  for (const r of readings) {
    if (!hasExplicitTarget(r.context)) continue
    const key = toDateKey(r.timestamp)
    const bucket = byDay.get(key) ?? []
    bucket.push(r)
    byDay.set(key, bucket)
  }
  const map = new Map<string, number>()
  for (const [date, group] of byDay) {
    const inTargetCount = group.filter(
      (r) => evaluateReading(r.value, r.context as TargetContext).inTarget,
    ).length
    map.set(date, (inTargetCount / group.length) * 100)
  }
  return map
}

/**
 * Blends protocol-checklist completion with glycemic-target adherence into
 * one daily %, feeding the same rolling-window engine as before. A day
 * with no glucose logged falls back to the checklist % alone rather than
 * being dragged toward 0 for a dimension it has no data for.
 */
function buildDailyPctMap(
  adherence: AdherenceEntry[],
  protocolId: number,
  ruleCount: number,
  readings: GlucoseReading[],
): Map<string, number> {
  const checklistMap = new Map<string, number>()
  if (ruleCount > 0) {
    for (const entry of adherence) {
      if (entry.protocolId !== protocolId) continue
      checklistMap.set(entry.date, (entry.metRuleIds.length / ruleCount) * 100)
    }
  }
  const glycemicMap = buildDailyGlycemicPctMap(readings)

  const dates = new Set([...checklistMap.keys(), ...glycemicMap.keys()])
  const map = new Map<string, number>()
  for (const date of dates) {
    const checklistPct = checklistMap.get(date) ?? 0
    const glycemicPct = glycemicMap.get(date)
    map.set(date, glycemicPct == null ? checklistPct : (checklistPct + glycemicPct) / 2)
  }
  return map
}

/**
 * Average daily adherence % over `windowDays` ending at `now` (inclusive).
 * A day with no logged entry counts as 0% — silence counts against
 * durability rather than being excluded from the average, since an
 * unlogged stretch is exactly the failure mode this is meant to catch.
 */
function averageAdherenceOverWindow(
  dailyPct: Map<string, number>,
  now: number,
  windowDays: number,
): number {
  let total = 0
  for (let d = 0; d < windowDays; d++) {
    total += dailyPct.get(toDateKey(now - d * DAY_MS)) ?? 0
  }
  return total / windowDays
}

export interface DurabilityResult {
  /** rolling 14-day adherence score (%), 0-100 */
  rolling14Score: number
  /**
   * The lowest rolling-14-day score over any 14-day window within the
   * trailing 90 days — not an average. A burnout dip in the middle of an
   * otherwise strong quarter surfaces here even though an average would
   * smooth it away. Null until at least 14 days of protocol history exist.
   */
  ninetyDayFloor: number | null
  /** how many days of history the floor actually covers (<=90) */
  floorWindowDays: number
  degradationAlert: boolean
  burnoutRisk: boolean
  burnoutStreakDays: number
}

export function computeDurability(
  adherence: AdherenceEntry[],
  protocol: Protocol,
  readings: GlucoseReading[] = [],
  now: number = Date.now(),
): DurabilityResult {
  const ruleCount = protocol.rules.length
  const protocolAgeDays = Math.max(0, Math.floor((now - protocol.createdAt) / DAY_MS) + 1)
  const dailyPct = buildDailyPctMap(adherence, protocol.id!, ruleCount, readings)

  // Cap the current score's window to how long the protocol has actually
  // existed, so a protocol created yesterday doesn't get 13 days of
  // pre-existence padded in as 0%-adherence failures.
  const rolling14Score = averageAdherenceOverWindow(
    dailyPct,
    now,
    Math.max(1, Math.min(SCORE_WINDOW_DAYS, protocolAgeDays)),
  )

  const floorWindowDays = Math.min(FLOOR_LOOKBACK_DAYS, protocolAgeDays)
  let ninetyDayFloor: number | null = null
  if (floorWindowDays >= SCORE_WINDOW_DAYS) {
    let min = Infinity
    for (let end = 0; end <= floorWindowDays - SCORE_WINDOW_DAYS; end++) {
      min = Math.min(min, averageAdherenceOverWindow(dailyPct, now - end * DAY_MS, SCORE_WINDOW_DAYS))
    }
    ninetyDayFloor = min
  }

  const degradationAlert = rolling14Score < DEGRADATION_ALERT_THRESHOLD

  let burnoutStreakDays = 0
  const burnoutLoopCap = Math.min(365, protocolAgeDays)
  for (let d = 0; d < burnoutLoopCap; d++) {
    const pct = dailyPct.get(toDateKey(now - d * DAY_MS)) ?? 0
    if (pct >= BURNOUT_INTENSITY_THRESHOLD) burnoutStreakDays++
    else break
  }
  const burnoutRisk = burnoutStreakDays >= BURNOUT_MIN_DAYS

  return {
    rolling14Score,
    ninetyDayFloor,
    floorWindowDays,
    degradationAlert,
    burnoutRisk,
    burnoutStreakDays,
  }
}
