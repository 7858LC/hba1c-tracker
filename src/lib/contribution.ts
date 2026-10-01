import type { GlucoseReading } from '../types'
import { daysAgo } from './dates'

/**
 * Reference "normal" glucose used as the zero-point for excursion-based
 * contribution — each side's share is its own average's distance above
 * this reference, as a fraction of the combined distance. A commonly used
 * proxy in Monnier-style methodology, not a clinical target of its own.
 */
export const CONTRIBUTION_REFERENCE_GLUCOSE = 100

/**
 * Minimum readings required on EACH side before a split is shown — below
 * this a handful of readings swings the average wildly and would overstate
 * confidence in the split.
 */
export const MIN_READINGS_PER_SIDE = 5

export interface ContributionResult {
  eligible: boolean
  windowDays: number
  fastingReadingCount: number
  postprandialReadingCount: number
  fastingPct?: number
  postprandialPct?: number
  reason?: string
}

/**
 * Approximates each component's relative share of the user's OWN rolling
 * glucose elevation — not the published Monnier population percentages,
 * which this app deliberately avoids asserting apply directly to any one
 * person. Each side's "excursion" is its mean reading's distance above
 * CONTRIBUTION_REFERENCE_GLUCOSE (clamped at 0); the split is each side's
 * excursion as a fraction of the combined excursion. A rough approximation,
 * not a validated clinical calculation — always surface it as such.
 */
export function computeRelativeContribution(
  readings: GlucoseReading[],
  windowDays: number = 30,
  now: number = Date.now(),
): ContributionResult {
  const since = daysAgo(windowDays, now)
  const inWindow = readings.filter((r) => r.timestamp >= since && r.timestamp <= now)

  const fasting = inWindow.filter((r) => r.context === 'fasting' || r.context === 'pre_meal')
  const postprandial = inWindow.filter(
    (r) => r.context === 'post_meal_1h' || r.context === 'post_meal_2h',
  )

  if (fasting.length < MIN_READINGS_PER_SIDE || postprandial.length < MIN_READINGS_PER_SIDE) {
    return {
      eligible: false,
      windowDays,
      fastingReadingCount: fasting.length,
      postprandialReadingCount: postprandial.length,
      reason: `Need at least ${MIN_READINGS_PER_SIDE} fasting/pre-meal and ${MIN_READINGS_PER_SIDE} post-meal readings in the last ${windowDays} days (have ${fasting.length} and ${postprandial.length}).`,
    }
  }

  const fastingAvg = fasting.reduce((s, r) => s + r.value, 0) / fasting.length
  const postAvg = postprandial.reduce((s, r) => s + r.value, 0) / postprandial.length

  const fastingExcursion = Math.max(0, fastingAvg - CONTRIBUTION_REFERENCE_GLUCOSE)
  const postExcursion = Math.max(0, postAvg - CONTRIBUTION_REFERENCE_GLUCOSE)
  const total = fastingExcursion + postExcursion

  // Both sides at/under the reference — nothing to apportion; report a
  // neutral 50/50 rather than dividing by zero.
  if (total === 0) {
    return {
      eligible: true,
      windowDays,
      fastingReadingCount: fasting.length,
      postprandialReadingCount: postprandial.length,
      fastingPct: 50,
      postprandialPct: 50,
    }
  }

  return {
    eligible: true,
    windowDays,
    fastingReadingCount: fasting.length,
    postprandialReadingCount: postprandial.length,
    fastingPct: (fastingExcursion / total) * 100,
    postprandialPct: (postExcursion / total) * 100,
  }
}
