import type { AdherenceEntry, Protocol } from '../types'
import { DAY_MS, toDateKey } from './dates'

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

function buildDailyPctMap(
  adherence: AdherenceEntry[],
  protocolId: number,
  ruleCount: number,
): Map<string, number> {
  const map = new Map<string, number>()
  if (ruleCount === 0) return map
  for (const entry of adherence) {
    if (entry.protocolId !== protocolId) continue
    map.set(entry.date, (entry.metRuleIds.length / ruleCount) * 100)
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
  now: number = Date.now(),
): DurabilityResult {
  const ruleCount = protocol.rules.length
  const protocolAgeDays = Math.max(0, Math.floor((now - protocol.createdAt) / DAY_MS) + 1)
  const dailyPct = buildDailyPctMap(adherence, protocol.id!, ruleCount)

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
