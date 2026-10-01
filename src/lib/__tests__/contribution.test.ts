import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import {
  computeRelativeContribution,
  CONTRIBUTION_REFERENCE_GLUCOSE,
  MIN_READINGS_PER_SIDE,
} from '../contribution'

function reading(context: GlucoseReading['context'], value: number, i: number): GlucoseReading {
  const t = Date.now() - i * 3600_000
  return { context, value, timestamp: t, source: 'manual', createdAt: t, updatedAt: t }
}

describe('computeRelativeContribution', () => {
  it('is ineligible with fewer than MIN_READINGS_PER_SIDE on either side', () => {
    const readings = [
      ...Array.from({ length: MIN_READINGS_PER_SIDE - 1 }, (_, i) => reading('fasting', 110, i)),
      ...Array.from({ length: MIN_READINGS_PER_SIDE }, (_, i) => reading('post_meal_1h', 150, i)),
    ]
    const result = computeRelativeContribution(readings)
    expect(result.eligible).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('splits proportional to each side\'s excursion above the reference', () => {
    // fasting avg 120 -> excursion 20; postprandial avg 150 -> excursion 50
    // expected split: fasting 20/70=28.57%, post 50/70=71.43%
    const readings = [
      ...Array.from({ length: MIN_READINGS_PER_SIDE }, (_, i) => reading('fasting', 120, i)),
      ...Array.from({ length: MIN_READINGS_PER_SIDE }, (_, i) => reading('post_meal_1h', 150, i)),
    ]
    const result = computeRelativeContribution(readings)
    expect(result.eligible).toBe(true)
    expect(result.fastingPct).toBeCloseTo((20 / 70) * 100, 2)
    expect(result.postprandialPct).toBeCloseTo((50 / 70) * 100, 2)
  })

  it('combines pre_meal with fasting, and 1hr with 2hr post-meal, on each side', () => {
    const readings = [
      ...Array.from({ length: 3 }, (_, i) => reading('fasting', 110, i)),
      ...Array.from({ length: 3 }, (_, i) => reading('pre_meal', 110, i + 10)),
      ...Array.from({ length: 3 }, (_, i) => reading('post_meal_1h', 140, i)),
      ...Array.from({ length: 3 }, (_, i) => reading('post_meal_2h', 140, i + 10)),
    ]
    const result = computeRelativeContribution(readings)
    expect(result.fastingReadingCount).toBe(6)
    expect(result.postprandialReadingCount).toBe(6)
    expect(result.eligible).toBe(true)
  })

  it('reports a neutral 50/50 split when both sides are at or under the reference', () => {
    const readings = [
      ...Array.from({ length: MIN_READINGS_PER_SIDE }, (_, i) =>
        reading('fasting', CONTRIBUTION_REFERENCE_GLUCOSE - 10, i),
      ),
      ...Array.from({ length: MIN_READINGS_PER_SIDE }, (_, i) =>
        reading('post_meal_1h', CONTRIBUTION_REFERENCE_GLUCOSE - 5, i),
      ),
    ]
    const result = computeRelativeContribution(readings)
    expect(result.fastingPct).toBe(50)
    expect(result.postprandialPct).toBe(50)
  })

  it('excludes readings outside the window', () => {
    const now = Date.now()
    const old = now - 40 * 24 * 3600_000
    const readings = [
      ...Array.from({ length: MIN_READINGS_PER_SIDE }, () => ({
        context: 'fasting' as const,
        value: 300,
        timestamp: old,
        source: 'manual' as const,
        createdAt: old,
        updatedAt: old,
      })),
    ]
    const result = computeRelativeContribution(readings, 30, now)
    expect(result.fastingReadingCount).toBe(0)
  })
})
