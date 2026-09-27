import type { GlucoseContext, GlucoseReading } from '../types'
import { toDateKey } from './dates'

/**
 * Optimal-metabolic-health glycemic targets — NOT standard ADA
 * diabetic-management thresholds (pre-meal 80-130, post-meal <180). Those
 * are treatment ranges built to prevent acute complications in people who
 * already have diabetes; using them here would under-flag real insulin
 * resistance in a prediabetic user. These constants are the single source
 * of truth for every glucose-vs-target evaluation in the app — adherence
 * scoring, chart bands, and log flags all read from here, never a
 * hard-coded 130/180 of their own.
 */
export const FASTING_TARGET_LOW = 70
export const FASTING_TARGET_HIGH = 99

export const POST_MEAL_1H_TARGET_HIGH = 140
export const POST_MEAL_1H_IDEAL_HIGH = 120

export const POST_MEAL_2H_TARGET_HIGH = 120
/** Flags slow clearance even when the absolute 2hr number is in range. */
export const POST_MEAL_2H_CLEARANCE_DELTA = 20

export type TargetContext = Extract<
  GlucoseContext,
  'fasting' | 'pre_meal' | 'post_meal_1h' | 'post_meal_2h'
>

export function hasExplicitTarget(context: GlucoseContext): context is TargetContext {
  return (
    context === 'fasting' ||
    context === 'pre_meal' ||
    context === 'post_meal_1h' ||
    context === 'post_meal_2h'
  )
}

export interface TargetBand {
  low: number | null
  high: number
  idealHigh?: number
}

export function targetBandFor(context: TargetContext): TargetBand {
  switch (context) {
    case 'fasting':
    case 'pre_meal':
      return { low: FASTING_TARGET_LOW, high: FASTING_TARGET_HIGH }
    case 'post_meal_1h':
      return { low: null, high: POST_MEAL_1H_TARGET_HIGH, idealHigh: POST_MEAL_1H_IDEAL_HIGH }
    case 'post_meal_2h':
      return { low: null, high: POST_MEAL_2H_TARGET_HIGH }
  }
}

export interface ReadingEvaluation {
  inTarget: boolean
  /** only meaningful for post_meal_1h, which has a tighter sub-threshold */
  ideal?: boolean
  /** true only for a post_meal_2h reading that stayed >20 mg/dL above the preceding baseline */
  slowClearance: boolean
}

/**
 * `precedingBaseline` is the most recent fasting/pre-meal value on the same
 * day before this reading, when known (see `findPrecedingBaseline`) — used
 * only for the 2hr slow-clearance check, which cares about trending back
 * toward baseline, not just the absolute 2hr number.
 */
export function evaluateReading(
  value: number,
  context: TargetContext,
  precedingBaseline?: number,
): ReadingEvaluation {
  const band = targetBandFor(context)
  const inTarget = (band.low == null || value >= band.low) && value <= band.high
  const slowClearance =
    context === 'post_meal_2h' &&
    precedingBaseline != null &&
    value - precedingBaseline > POST_MEAL_2H_CLEARANCE_DELTA

  return {
    inTarget,
    ideal: band.idealHigh != null ? value <= band.idealHigh : undefined,
    slowClearance,
  }
}

/**
 * The most recent fasting/pre-meal reading earlier the same calendar day —
 * the "baseline" a 2hr post-meal reading should have trended back toward.
 */
export function findPrecedingBaseline(
  readings: GlucoseReading[],
  target: GlucoseReading,
): number | undefined {
  const sameDay = toDateKey(target.timestamp)
  let best: GlucoseReading | undefined
  for (const r of readings) {
    if (r === target) continue
    if (r.timestamp >= target.timestamp) continue
    if (toDateKey(r.timestamp) !== sameDay) continue
    if (r.context !== 'fasting' && r.context !== 'pre_meal') continue
    if (!best || r.timestamp > best.timestamp) best = r
  }
  return best?.value
}

export interface ContextTargetResult {
  context: 'fasting_pre_meal' | 'post_meal_1h' | 'post_meal_2h'
  label: string
  band: TargetBand
  readingCount: number
  /** null when the band has no lower bound (post-meal targets) */
  belowPct: number | null
  inTargetPct: number
  abovePct: number
  /** % meeting the tighter ideal sub-threshold — only present for post_meal_1h */
  idealPct?: number
}

/**
 * Breaks the given (already time-windowed) readings down by target group
 * and scores each against its own band — replaces a single generic
 * low/high "time in range" band applied uniformly to every reading
 * regardless of context, which would blur a fine fasting number against a
 * high post-meal spike or vice versa. Readings with no explicit target
 * (e.g. 'random') are not included in any group.
 */
export function timeInTargetByContext(readings: GlucoseReading[]): ContextTargetResult[] {
  const groups: { key: ContextTargetResult['context']; label: string; contexts: TargetContext[] }[] = [
    { key: 'fasting_pre_meal', label: 'Fasting / pre-meal', contexts: ['fasting', 'pre_meal'] },
    { key: 'post_meal_1h', label: '1hr post-meal', contexts: ['post_meal_1h'] },
    { key: 'post_meal_2h', label: '2hr post-meal', contexts: ['post_meal_2h'] },
  ]

  return groups.map(({ key, label, contexts }) => {
    const group = readings.filter((r) => contexts.includes(r.context as TargetContext))
    const band = targetBandFor(contexts[0])
    const n = group.length

    if (n === 0) {
      return {
        context: key,
        label,
        band,
        readingCount: 0,
        belowPct: band.low != null ? 0 : null,
        inTargetPct: 0,
        abovePct: 0,
        idealPct: band.idealHigh != null ? 0 : undefined,
      }
    }

    let below = 0
    let inTarget = 0
    let above = 0
    let ideal = 0
    for (const r of group) {
      const evalResult = evaluateReading(r.value, contexts[0])
      if (evalResult.inTarget) inTarget++
      else if (band.low != null && r.value < band.low) below++
      else above++
      if (evalResult.ideal) ideal++
    }

    return {
      context: key,
      label,
      band,
      readingCount: n,
      belowPct: band.low != null ? (below / n) * 100 : null,
      inTargetPct: (inTarget / n) * 100,
      abovePct: (above / n) * 100,
      idealPct: band.idealHigh != null ? (ideal / n) * 100 : undefined,
    }
  })
}
