import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import {
  evaluateReading,
  findPrecedingBaseline,
  hasExplicitTarget,
  timeInTargetByContext,
} from '../glycemicTargets'

function reading(
  context: GlucoseReading['context'],
  value: number,
  timestamp: number,
): GlucoseReading {
  return { context, value, timestamp, source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

describe('hasExplicitTarget', () => {
  it('is true for fasting/pre_meal/post_meal_1h/post_meal_2h', () => {
    expect(hasExplicitTarget('fasting')).toBe(true)
    expect(hasExplicitTarget('pre_meal')).toBe(true)
    expect(hasExplicitTarget('post_meal_1h')).toBe(true)
    expect(hasExplicitTarget('post_meal_2h')).toBe(true)
  })

  it('is false for random', () => {
    expect(hasExplicitTarget('random')).toBe(false)
  })
})

describe('evaluateReading', () => {
  it('flags fasting in range for 70-99, not 130 (ADA)', () => {
    expect(evaluateReading(85, 'fasting').inTarget).toBe(true)
    expect(evaluateReading(99, 'fasting').inTarget).toBe(true)
    expect(evaluateReading(100, 'fasting').inTarget).toBe(false)
    expect(evaluateReading(115, 'fasting').inTarget).toBe(false) // would pass under ADA's 80-130
    expect(evaluateReading(65, 'fasting').inTarget).toBe(false)
  })

  it('applies the same band to pre_meal as fasting', () => {
    expect(evaluateReading(99, 'pre_meal').inTarget).toBe(true)
    expect(evaluateReading(100, 'pre_meal').inTarget).toBe(false)
  })

  it('flags 1hr post-meal in range under 140, ideal under 120, not 180 (ADA)', () => {
    expect(evaluateReading(139, 'post_meal_1h').inTarget).toBe(true)
    expect(evaluateReading(140, 'post_meal_1h').inTarget).toBe(true)
    expect(evaluateReading(141, 'post_meal_1h').inTarget).toBe(false)
    expect(evaluateReading(165, 'post_meal_1h').inTarget).toBe(false) // would pass under ADA's 180
    expect(evaluateReading(119, 'post_meal_1h').ideal).toBe(true)
    expect(evaluateReading(120, 'post_meal_1h').ideal).toBe(true)
    expect(evaluateReading(121, 'post_meal_1h').ideal).toBe(false)
  })

  it('flags 2hr post-meal in range under 120', () => {
    expect(evaluateReading(120, 'post_meal_2h').inTarget).toBe(true)
    expect(evaluateReading(121, 'post_meal_2h').inTarget).toBe(false)
    expect(evaluateReading(121, 'post_meal_2h').ideal).toBeUndefined()
  })

  it('flags slow clearance when a 2hr reading stays >20 above the preceding baseline even if in range', () => {
    const result = evaluateReading(115, 'post_meal_2h', 90)
    expect(result.inTarget).toBe(true) // 115 is under the 120 absolute ceiling
    expect(result.slowClearance).toBe(true) // but 25 above the 90 baseline
  })

  it('does not flag slow clearance when the 2hr reading is close to baseline', () => {
    const result = evaluateReading(105, 'post_meal_2h', 90)
    expect(result.slowClearance).toBe(false)
  })

  it('does not flag slow clearance with no known baseline', () => {
    expect(evaluateReading(115, 'post_meal_2h').slowClearance).toBe(false)
  })
})

describe('findPrecedingBaseline', () => {
  const day = Date.parse('2025-09-16T00:00:00')

  it('finds the closest earlier same-day fasting/pre_meal reading', () => {
    const target = reading('post_meal_2h', 115, day + 12 * 3600_000)
    const readings = [
      reading('fasting', 88, day + 7 * 3600_000),
      reading('pre_meal', 92, day + 10 * 3600_000),
      target,
      reading('post_meal_1h', 150, day + 11 * 3600_000),
    ]
    expect(findPrecedingBaseline(readings, target)).toBe(92)
  })

  it('ignores readings from a different day', () => {
    const target = reading('post_meal_2h', 115, day + 12 * 3600_000)
    const readings = [reading('fasting', 88, day - 20 * 3600_000), target]
    expect(findPrecedingBaseline(readings, target)).toBeUndefined()
  })

  it('ignores post-meal readings when looking for a baseline', () => {
    const target = reading('post_meal_2h', 115, day + 12 * 3600_000)
    const readings = [reading('post_meal_1h', 150, day + 10 * 3600_000), target]
    expect(findPrecedingBaseline(readings, target)).toBeUndefined()
  })
})

describe('timeInTargetByContext', () => {
  const t0 = Date.now()

  it('scores each group against its own band', () => {
    const readings = [
      reading('fasting', 85, t0),
      reading('fasting', 110, t0 + 1000),
      reading('pre_meal', 60, t0 + 2000),
      reading('post_meal_1h', 130, t0 + 3000),
      reading('post_meal_2h', 125, t0 + 4000),
      reading('random', 200, t0 + 5000),
    ]
    const result = timeInTargetByContext(readings)

    const fastingGroup = result.find((g) => g.context === 'fasting_pre_meal')!
    expect(fastingGroup.readingCount).toBe(3)
    expect(fastingGroup.inTargetPct).toBeCloseTo((1 / 3) * 100, 5) // only 85 is in 70-99
    expect(fastingGroup.belowPct).toBeCloseTo((1 / 3) * 100, 5) // 60
    expect(fastingGroup.abovePct).toBeCloseTo((1 / 3) * 100, 5) // 110

    const post1h = result.find((g) => g.context === 'post_meal_1h')!
    expect(post1h.readingCount).toBe(1)
    expect(post1h.inTargetPct).toBe(100) // 130 < 140
    expect(post1h.belowPct).toBeNull()
    expect(post1h.idealPct).toBe(0) // 130 > 120 ideal

    const post2h = result.find((g) => g.context === 'post_meal_2h')!
    expect(post2h.readingCount).toBe(1)
    expect(post2h.abovePct).toBe(100) // 125 > 120
  })

  it('returns zeroed groups with no readings rather than crashing', () => {
    const result = timeInTargetByContext([])
    for (const g of result) {
      expect(g.readingCount).toBe(0)
      expect(g.inTargetPct).toBe(0)
    }
  })
})
