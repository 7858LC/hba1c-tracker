import { describe, expect, it } from 'vitest'
import type { GlucoseContext, GlucoseReading, LabA1cEntry } from '../../types'
import { DAY_MS } from '../dates'
import { glucoseToGMI, gmiToGlucose, GMI_SLOPE } from '../gmi'
import {
  computeLabForecast,
  contextWeightedMean,
  MIN_BASELINE_READINGS,
  shareOfWindowAfter,
} from '../labForecast'

// Synthetic fixtures only; no real person's readings belong in this public repo.
const NOW = Date.parse('2030-06-01T12:00:00')

function reading(daysAgo: number, value: number, context: GlucoseContext): GlucoseReading {
  const timestamp = NOW - daysAgo * DAY_MS
  return { timestamp, value, context, source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

function lab(labDate: string, a1cPercent: number): LabA1cEntry {
  return { labDate, a1cPercent, createdAt: 0, updatedAt: 0 }
}

/** 5 readings in each of the four weighted contexts, over the last 5 days. */
function baselineReadings(): GlucoseReading[] {
  const out: GlucoseReading[] = []
  for (let d = 0; d < 5; d++) {
    out.push(reading(d, 110, 'fasting'))
    out.push(reading(d, 95, 'pre_meal'))
    out.push(reading(d, 105, 'post_meal_1h'))
    out.push(reading(d, 100, 'post_meal_2h'))
  }
  return out
}

describe('GMI formula', () => {
  it('matches published values and differs from ADAG', () => {
    expect(glucoseToGMI(100)).toBeCloseTo(5.702, 3)
    expect(glucoseToGMI(154)).toBeCloseTo(6.994, 3)
    expect(glucoseToGMI(100)).not.toBeCloseTo((100 + 46.7) / 28.7, 1)
  })

  it('round-trips through its inverse', () => {
    expect(gmiToGlucose(glucoseToGMI(117))).toBeCloseTo(117, 9)
  })
})

describe('contextWeightedMean', () => {
  it('weights each context by the hours it represents', () => {
    const result = contextWeightedMean(baselineReadings())!
    // (110*8 + 95*1 + 105*1.5 + 100*1.5) / 12
    expect(result.mean).toBeCloseTo(106.875, 6)
    expect(result.readingsUsed).toBe(20)
  })

  it('ignores contexts outside the weighted set', () => {
    const readings = [...baselineReadings(), reading(0, 300, 'random')]
    expect(contextWeightedMean(readings)!.mean).toBeCloseTo(106.875, 6)
  })

  it('renormalizes when a context has no readings', () => {
    const onlyFasting = [reading(0, 100, 'fasting'), reading(1, 110, 'fasting')]
    expect(contextWeightedMean(onlyFasting)!.mean).toBeCloseTo(105, 9)
  })

  it('returns null with no weighted-context readings', () => {
    expect(contextWeightedMean([reading(0, 100, 'random')])).toBeNull()
    expect(contextWeightedMean([])).toBeNull()
  })
})

describe('shareOfWindowAfter', () => {
  const labTime = NOW

  it('is 1 when the whole window is after the baseline', () => {
    expect(shareOfWindowAfter(labTime - 90 * DAY_MS, labTime)).toBeCloseTo(1, 9)
    expect(shareOfWindowAfter(labTime - 200 * DAY_MS, labTime)).toBeCloseTo(1, 9)
  })

  it('is 0 when the baseline ends at or after the lab date', () => {
    expect(shareOfWindowAfter(labTime, labTime)).toBe(0)
    expect(shareOfWindowAfter(labTime + 5 * DAY_MS, labTime)).toBe(0)
  })

  it('counts the most recent month at half weight', () => {
    expect(shareOfWindowAfter(labTime - 30 * DAY_MS, labTime)).toBeCloseTo(0.5, 9)
  })

  it('handles a baseline ending partway through a bin', () => {
    // 35 days before the lab: all of the newest bin (0.5) + 30-35 of the second bin
    expect(shareOfWindowAfter(labTime - 35 * DAY_MS, labTime)).toBeCloseTo(0.5 + 0.25 * (5 / 30), 9)
  })
})

describe('computeLabForecast', () => {
  const labTime = NOW + 60 * DAY_MS

  it('requires a lab result', () => {
    expect(computeLabForecast([], baselineReadings(), 5.4, labTime).status).toBe('no_lab')
  })

  it('requires enough baseline readings', () => {
    const few = baselineReadings().slice(0, MIN_BASELINE_READINGS - 1)
    const result = computeLabForecast([lab('2030-05-01', 5.9)], few, 5.4, labTime)
    expect(result.status).toBe('insufficient_data')
  })

  it('uses the most recent lab as the anchor', () => {
    const labs = [lab('2029-01-01', 6.4), lab('2030-05-01', 5.9)]
    const result = computeLabForecast(labs, baselineReadings(), 5.4, labTime)
    expect(result.status === 'ok' && result.anchorPercent).toBe(5.9)
  })

  it('returns the anchor lab when the average does not change', () => {
    const result = computeLabForecast([lab('2030-05-01', 5.9)], baselineReadings(), 5.4, labTime)
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(result.rows[0].labEstimate).toBeCloseTo(5.9, 9)
    expect(result.rows[0].heldNinetyDays).toBeCloseTo(5.9, 9)
  })

  it('shifts the estimate by share x slope x change in mean', () => {
    const result = computeLabForecast([lab('2030-05-01', 5.9)], baselineReadings(), 5.4, labTime)
    if (result.status !== 'ok') throw new Error('expected ok')
    const eightLower = result.rows.find((r) => r.label === '8 mg/dL lower')!
    expect(eightLower.labEstimate).toBeCloseTo(5.9 - result.shareAfter * GMI_SLOPE * 8, 9)
    expect(eightLower.heldNinetyDays).toBeCloseTo(5.9 - GMI_SLOPE * 8, 9)
    expect(eightLower.labEstimate).toBeGreaterThan(eightLower.heldNinetyDays)
  })

  it('computes the mean needed to land on the goal over a full window', () => {
    const result = computeLabForecast([lab('2030-05-01', 5.9)], baselineReadings(), 5.4, labTime)
    if (result.status !== 'ok') throw new Error('expected ok')
    const needed = result.meanNeededForGoal
    expect(5.9 + GMI_SLOPE * (needed - result.baselineMean)).toBeCloseTo(5.4, 9)
  })

  it('reports no open window when the lab date is not after the data', () => {
    const result = computeLabForecast([lab('2030-05-01', 5.9)], baselineReadings(), 5.4, NOW)
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(result.shareAfter).toBe(0)
  })
})
