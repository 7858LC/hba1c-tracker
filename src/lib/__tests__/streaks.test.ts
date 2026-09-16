import { describe, expect, it } from 'vitest'
import type { AdherenceEntry } from '../../types'
import { DAY_MS } from '../dates'
import { computeStreak } from '../streaks'

function entry(date: string, metRuleIds: string[], protocolId = 1): AdherenceEntry {
  return { date, protocolId, metRuleIds, createdAt: 0, updatedAt: 0 }
}

describe('computeStreak', () => {
  const now = Date.parse('2025-06-10T12:00:00')

  it('is zero with no adherence history', () => {
    const result = computeStreak([], 1, now)
    expect(result.currentStreak).toBe(0)
    expect(result.longestStreak).toBe(0)
    expect(result.loggedToday).toBe(false)
  })

  it('counts a streak of consecutive logged days ending yesterday', () => {
    const adherence = [
      entry('2025-06-07', ['r1']),
      entry('2025-06-08', ['r1']),
      entry('2025-06-09', ['r1']),
    ]
    const result = computeStreak(adherence, 1, now)
    expect(result.loggedToday).toBe(false)
    expect(result.currentStreak).toBe(3)
  })

  it('includes today once today has a checked rule', () => {
    const adherence = [entry('2025-06-09', ['r1']), entry('2025-06-10', ['r1'])]
    const result = computeStreak(adherence, 1, now)
    expect(result.loggedToday).toBe(true)
    expect(result.currentStreak).toBe(2)
  })

  it('does not count an empty entry for today as breaking or logged', () => {
    const adherence = [entry('2025-06-09', ['r1']), entry('2025-06-10', [])]
    const result = computeStreak(adherence, 1, now)
    expect(result.loggedToday).toBe(false)
    // yesterday still counts even though today has an empty (unchecked) entry
    expect(result.currentStreak).toBe(1)
  })

  it('breaks the streak on a gap day', () => {
    const adherence = [
      entry('2025-06-05', ['r1']),
      // gap on 06-06, 06-07
      entry('2025-06-08', ['r1']),
      entry('2025-06-09', ['r1']),
    ]
    const result = computeStreak(adherence, 1, now)
    expect(result.currentStreak).toBe(2)
  })

  it('tracks the longest streak separately from the current one', () => {
    const adherence = [
      entry('2025-06-01', ['r1']),
      entry('2025-06-02', ['r1']),
      entry('2025-06-03', ['r1']),
      entry('2025-06-04', ['r1']),
      // gap
      entry('2025-06-09', ['r1']),
    ]
    const result = computeStreak(adherence, 1, now)
    expect(result.longestStreak).toBe(4)
    expect(result.currentStreak).toBe(1)
  })

  it('only counts entries for the given protocol', () => {
    const adherence = [
      entry('2025-06-08', ['r1'], 1),
      entry('2025-06-09', ['r1'], 1),
      entry('2025-06-09', ['r1'], 2),
    ]
    // protocol 1 has a 2-day streak; protocol 2 only has one logged day.
    // If protocol filtering leaked, protocol 2 would incorrectly show 2.
    const result = computeStreak(adherence, 2, now)
    expect(result.currentStreak).toBe(1)
  })
})

describe('computeStreak date math sanity', () => {
  it('DAY_MS is exactly 24 hours', () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000)
  })
})
