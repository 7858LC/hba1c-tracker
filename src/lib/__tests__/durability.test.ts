import { describe, expect, it } from 'vitest'
import type { AdherenceEntry, GlucoseReading, Protocol } from '../../types'
import { DAY_MS, toDateKey } from '../dates'
import {
  BURNOUT_MIN_DAYS,
  DEGRADATION_ALERT_THRESHOLD,
  computeDurability,
} from '../durability'

function fastingReading(daysAgo: number, value: number, at = now): GlucoseReading {
  const timestamp = at - daysAgo * DAY_MS
  return {
    context: 'fasting',
    value,
    timestamp,
    source: 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

const now = Date.parse('2025-06-15T12:00:00')

function protocol(createdDaysAgo: number, ruleCount: number, id = 1): Protocol {
  return {
    id,
    name: 'Test protocol',
    rules: Array.from({ length: ruleCount }, (_, i) => ({ id: `r${i}`, label: `Rule ${i}` })),
    active: true,
    createdAt: now - createdDaysAgo * DAY_MS,
    updatedAt: now,
  }
}

function entry(protocolId: number, daysAgo: number, metRuleIds: string[]): AdherenceEntry {
  return {
    protocolId,
    date: toDateKey(now - daysAgo * DAY_MS),
    metRuleIds,
    createdAt: now,
    updatedAt: now,
  }
}

/** Builds full-adherence (all rules met) entries for `count` consecutive
 * days ending `endDaysAgo` days ago. */
function fullAdherenceRun(protocolId: number, ruleIds: string[], endDaysAgo: number, count: number): AdherenceEntry[] {
  const out: AdherenceEntry[] = []
  for (let i = 0; i < count; i++) {
    out.push(entry(protocolId, endDaysAgo + i, ruleIds))
  }
  return out
}

describe('computeDurability — rolling14Score', () => {
  it('averages daily adherence % over the trailing 14 days, treating unlogged days as 0', () => {
    const p = protocol(30, 2)
    const ruleIds = p.rules.map((r) => r.id)
    // 7 days fully logged (100%), 7 days unlogged (0%) -> average 50%
    const adherence = fullAdherenceRun(1, ruleIds, 0, 7)
    const result = computeDurability(adherence, p, [], now)
    expect(result.rolling14Score).toBeCloseTo(50, 5)
  })

  it('is 100 when every day in the window is fully logged', () => {
    const p = protocol(30, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, 14)
    const result = computeDurability(adherence, p, [], now)
    expect(result.rolling14Score).toBeCloseTo(100, 5)
  })

  it("does not pad pre-existence days as 0% for a protocol younger than 14 days", () => {
    const p = protocol(3, 2) // created 3 days ago
    const ruleIds = p.rules.map((r) => r.id)
    // fully adherent on every day the protocol has actually existed
    const adherence = fullAdherenceRun(1, ruleIds, 0, 4)
    const result = computeDurability(adherence, p, [], now)
    expect(result.rolling14Score).toBeCloseTo(100, 5)
  })
})

describe('computeDurability — ninetyDayFloor', () => {
  it('is null when the protocol has fewer than 14 days of history', () => {
    const p = protocol(10, 2)
    const result = computeDurability([], p, [], now)
    expect(result.ninetyDayFloor).toBeNull()
  })

  it('surfaces a mid-history dip that an average would smooth away', () => {
    const p = protocol(90, 2)
    const ruleIds = p.rules.map((r) => r.id)
    // strong for 40 days, a 14-day burnout dip (0%), strong again
    const adherence = [
      ...fullAdherenceRun(1, ruleIds, 0, 38),
      // days 38-51 unlogged (the dip) — no entries added
      ...fullAdherenceRun(1, ruleIds, 52, 38),
    ]
    const result = computeDurability(adherence, p, [], now)
    expect(result.ninetyDayFloor).not.toBeNull()
    expect(result.ninetyDayFloor!).toBeLessThan(10) // the dip drags the floor near 0
    expect(result.rolling14Score).toBeCloseTo(100, 5) // current 14-day score looks fine
  })

  it('matches rolling14Score when adherence has been flat the whole time', () => {
    const p = protocol(90, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, 90)
    const result = computeDurability(adherence, p, [], now)
    expect(result.ninetyDayFloor).toBeCloseTo(100, 5)
  })
})

describe('computeDurability — degradationAlert', () => {
  it('fires when the rolling 14-day score drops below the threshold', () => {
    const p = protocol(30, 2)
    const result = computeDurability([], p, [], now) // nothing logged -> 0%
    expect(result.rolling14Score).toBeLessThan(DEGRADATION_ALERT_THRESHOLD)
    expect(result.degradationAlert).toBe(true)
  })

  it('does not fire when adherence is solid', () => {
    const p = protocol(30, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, 14)
    const result = computeDurability(adherence, p, [], now)
    expect(result.degradationAlert).toBe(false)
  })
})

describe('computeDurability — burnoutRisk', () => {
  it('does not flag just under the minimum consecutive high-intensity days', () => {
    const p = protocol(60, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, BURNOUT_MIN_DAYS - 1)
    const result = computeDurability(adherence, p, [], now)
    expect(result.burnoutRisk).toBe(false)
  })

  it('flags once the minimum consecutive high-intensity days is reached', () => {
    const p = protocol(60, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, BURNOUT_MIN_DAYS)
    const result = computeDurability(adherence, p, [], now)
    expect(result.burnoutRisk).toBe(true)
    expect(result.burnoutStreakDays).toBe(BURNOUT_MIN_DAYS)
  })

  it('resets the streak count on a day below the intensity threshold', () => {
    const p = protocol(60, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = [
      ...fullAdherenceRun(1, ruleIds, 0, 10),
      // a gap day at daysAgo=10 (unlogged -> 0%) breaks the streak
      ...fullAdherenceRun(1, ruleIds, 11, 50),
    ]
    const result = computeDurability(adherence, p, [], now)
    expect(result.burnoutStreakDays).toBe(10)
    expect(result.burnoutRisk).toBe(false)
  })
})

describe('computeDurability — glycemic blend', () => {
  it('is unaffected by glucose readings on days with no target-context readings', () => {
    const p = protocol(30, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, 14)
    // 'random'-context readings never carry an explicit target, so they
    // should not move the score at all.
    const readings: GlucoseReading[] = Array.from({ length: 14 }, (_, i) => ({
      context: 'random',
      value: 999,
      timestamp: now - i * DAY_MS,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    }))
    const result = computeDurability(adherence, p, readings, now)
    expect(result.rolling14Score).toBeCloseTo(100, 5)
  })

  it('blends in-target fasting readings with a full checklist for a higher combined score', () => {
    const p = protocol(30, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, 14)
    const readings = Array.from({ length: 14 }, (_, i) => fastingReading(i, 85)) // in target (70-99)
    const result = computeDurability(adherence, p, readings, now)
    expect(result.rolling14Score).toBeCloseTo(100, 5) // 100% checklist + 100% in-target -> 100
  })

  it('drags the score down when readings are logged but out of target', () => {
    const p = protocol(30, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, 14)
    const readings = Array.from({ length: 14 }, (_, i) => fastingReading(i, 130)) // out of target
    const result = computeDurability(adherence, p, readings, now)
    expect(result.rolling14Score).toBeCloseTo(50, 5) // 100% checklist + 0% in-target -> 50
  })

  it('falls back to checklist-only on a day missing glucose data, not a phantom 0', () => {
    const p = protocol(30, 2)
    const ruleIds = p.rules.map((r) => r.id)
    const adherence = fullAdherenceRun(1, ruleIds, 0, 14)
    // Only half the days have a glucose reading; the other half should
    // still score on checklist alone rather than being halved for
    // "missing" glycemic data.
    const readings = [0, 2, 4, 6, 8, 10, 12].map((d) => fastingReading(d, 85))
    const result = computeDurability(adherence, p, readings, now)
    expect(result.rolling14Score).toBeCloseTo(100, 5)
  })
})
