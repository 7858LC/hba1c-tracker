import { describe, expect, it } from 'vitest'
import type { DuplicateReview, GlucoseReading } from '../../types'
import { detectPotentialDuplicates, pairKey } from '../duplicates'

function reading(
  id: number,
  timestamp: number,
  value: number,
  context: GlucoseReading['context'] = 'fasting',
): GlucoseReading {
  return { id, timestamp, value, context, source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

describe('pairKey', () => {
  it('is stable regardless of argument order', () => {
    expect(pairKey(3, 7)).toBe(pairKey(7, 3))
  })
})

describe('detectPotentialDuplicates', () => {
  const t0 = Date.parse('2025-09-20T07:00:00')

  it('flags two readings one minute apart with the same value and context', () => {
    const readings = [reading(1, t0, 95, 'fasting'), reading(2, t0 + 60_000, 95, 'fasting')]
    const result = detectPotentialDuplicates(readings)
    expect(result).toHaveLength(1)
    expect(result[0].pairKey).toBe('1-2')
  })

  it('does not flag readings with different values', () => {
    const readings = [reading(1, t0, 95, 'fasting'), reading(2, t0 + 60_000, 98, 'fasting')]
    expect(detectPotentialDuplicates(readings)).toHaveLength(0)
  })

  it('does not flag readings with different contexts, even if the value matches', () => {
    const readings = [reading(1, t0, 95, 'fasting'), reading(2, t0 + 30_000, 95, 'post_meal_1h')]
    expect(detectPotentialDuplicates(readings)).toHaveLength(0)
  })

  it('flags readings exactly 2 minutes apart (inclusive boundary)', () => {
    const readings = [reading(1, t0, 95, 'fasting'), reading(2, t0 + 2 * 60_000, 95, 'fasting')]
    expect(detectPotentialDuplicates(readings)).toHaveLength(1)
  })

  it('does not flag readings more than 2 minutes apart', () => {
    const readings = [reading(1, t0, 95, 'fasting'), reading(2, t0 + 2 * 60_000 + 1, 95, 'fasting')]
    expect(detectPotentialDuplicates(readings)).toHaveLength(0)
  })

  it('excludes a pair the user has already confirmed is not a duplicate', () => {
    const readings = [reading(1, t0, 95, 'fasting'), reading(2, t0 + 60_000, 95, 'fasting')]
    const reviewed: DuplicateReview[] = [
      { pairKey: '1-2', readingIdA: 1, readingIdB: 2, notDuplicate: true, createdAt: 0, updatedAt: 0 },
    ]
    expect(detectPotentialDuplicates(readings, reviewed)).toHaveLength(0)
  })

  it('never merges or mutates the input readings', () => {
    const readings = [reading(1, t0, 95, 'fasting'), reading(2, t0 + 60_000, 95, 'fasting')]
    const snapshot = JSON.parse(JSON.stringify(readings))
    detectPotentialDuplicates(readings)
    expect(readings).toEqual(snapshot)
  })

  it('finds multiple independent duplicate pairs', () => {
    const readings = [
      reading(1, t0, 95, 'fasting'),
      reading(2, t0 + 30_000, 95, 'fasting'),
      reading(3, t0 + 3 * 3600_000, 140, 'post_meal_1h'),
      reading(4, t0 + 3 * 3600_000 + 45_000, 140, 'post_meal_1h'),
    ]
    const result = detectPotentialDuplicates(readings)
    expect(result).toHaveLength(2)
  })

  it('ignores unsaved readings with no id', () => {
    const readings = [
      { timestamp: t0, value: 95, context: 'fasting' as const, source: 'manual' as const, createdAt: t0, updatedAt: t0 },
      reading(2, t0 + 60_000, 95, 'fasting'),
    ]
    expect(detectPotentialDuplicates(readings)).toHaveLength(0)
  })
})
