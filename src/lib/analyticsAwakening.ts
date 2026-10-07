import type { GlucoseReading, SleepEntry } from '../types'
import {
  awakeningTripleDays,
  MIN_AWAKENING_DAYS,
  T0_WINDOW,
  T30_WINDOW,
  T60_WINDOW,
} from './dataQuality'
import { findRelevantWake, minutesAfterWaking } from './elapsedTime'
import { mean } from './stats'
import { pearsonCorrelation } from './correlation'

export { MIN_AWAKENING_DAYS }

const RELATIONSHIP_WINDOW_MAX_MINUTES = 180

export interface AwakeningAnalytics {
  eligible: boolean
  daysWithTriple: number
  t0Mean: number | null
  t0Count: number
  t30Mean: number | null
  t30Count: number
  t60Mean: number | null
  t60Count: number
  meanRiseT0ToT30: number | null
  meanRiseT0ToT60: number | null
  /**
   * Pearson r between minutes-after-waking and glucose, over all readings
   * with a resolvable wake time within 3 hours of waking — an association,
   * not a causal claim; the UI must not word it as one.
   */
  minutesVsGlucoseR: number | null
  minutesVsGlucoseN: number
}

/**
 * Section E (Awakening). Unlike the Awakening Glucose Profile PROTOCOL
 * (lib/protocolSummary.ts), which only looks at readings explicitly
 * tagged into a protocol run, this looks at ALL readings with a
 * resolvable wake time — so morning readings logged outside a formal
 * protocol run still count here.
 */
export function computeAwakeningAnalytics(
  readings: GlucoseReading[],
  sleepEntries: SleepEntry[],
): AwakeningAnalytics {
  const t0Values: number[] = []
  const t30Values: number[] = []
  const t60Values: number[] = []
  const relationshipPairs: { minutes: number; value: number }[] = []

  for (const r of readings) {
    const wake = findRelevantWake(r, sleepEntries)
    if (!wake) continue
    const m = minutesAfterWaking(r, wake)
    if (m == null) continue

    if (m >= T0_WINDOW[0] && m <= T0_WINDOW[1]) t0Values.push(r.value)
    else if (m >= T30_WINDOW[0] && m <= T30_WINDOW[1]) t30Values.push(r.value)
    else if (m >= T60_WINDOW[0] && m <= T60_WINDOW[1]) t60Values.push(r.value)

    if (m >= 0 && m <= RELATIONSHIP_WINDOW_MAX_MINUTES) {
      relationshipPairs.push({ minutes: m, value: r.value })
    }
  }

  const t0Mean = mean(t0Values)
  const t30Mean = mean(t30Values)
  const t60Mean = mean(t60Values)

  return {
    eligible: awakeningTripleDays(readings, sleepEntries) >= MIN_AWAKENING_DAYS,
    daysWithTriple: awakeningTripleDays(readings, sleepEntries),
    t0Mean,
    t0Count: t0Values.length,
    t30Mean,
    t30Count: t30Values.length,
    t60Mean,
    t60Count: t60Values.length,
    meanRiseT0ToT30: t0Mean != null && t30Mean != null ? t30Mean - t0Mean : null,
    meanRiseT0ToT60: t0Mean != null && t60Mean != null ? t60Mean - t0Mean : null,
    minutesVsGlucoseR: pearsonCorrelation(
      relationshipPairs.map((p) => p.minutes),
      relationshipPairs.map((p) => p.value),
    ),
    minutesVsGlucoseN: relationshipPairs.length,
  }
}
