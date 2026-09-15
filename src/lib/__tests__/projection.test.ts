import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import { DAY_MS } from '../dates'
import { linearRegression, projectTargetDate } from '../projection'

function readingsForDays(
  now: number,
  numDays: number,
  valueForDay: (dayIndex: number) => number,
  perDay = 3,
): GlucoseReading[] {
  const readings: GlucoseReading[] = []
  for (let day = 0; day < numDays; day++) {
    const daysAgo = numDays - 1 - day
    for (let k = 0; k < perDay; k++) {
      const timestamp = now - daysAgo * DAY_MS + k * 60_000
      readings.push({
        timestamp,
        value: valueForDay(day),
        context: 'random',
        source: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
  }
  return readings
}

describe('linearRegression', () => {
  it('recovers a known slope/intercept exactly for a perfect line', () => {
    const xs = [0, 1, 2, 3, 4]
    const ys = xs.map((x) => 10 - 0.5 * x)
    const fit = linearRegression(xs, ys)
    expect(fit).not.toBeNull()
    expect(fit!.slope).toBeCloseTo(-0.5, 6)
    expect(fit!.intercept).toBeCloseTo(10, 6)
    expect(fit!.r2).toBeCloseTo(1, 6)
  })

  it('returns null with fewer than 2 points', () => {
    expect(linearRegression([1], [1])).toBeNull()
  })
})

describe('projectTargetDate', () => {
  const now = Date.now()

  it('refuses to project with fewer than 14 days of readings', () => {
    const readings = readingsForDays(now, 5, () => 150)
    const result = projectTargetDate(readings, 5.7, now)
    expect(result.status).toBe('insufficient_data')
    expect(result.projectedDate).toBeNull()
  })

  it('reports goal_met when current eA1C is already at/below target', () => {
    const readings = readingsForDays(now, 20, () => 108) // eA1C ~5.4%
    const result = projectTargetDate(readings, 5.7, now)
    expect(result.status).toBe('goal_met')
  })

  it('reports not_on_track for a flat/rising trend', () => {
    const readings = readingsForDays(now, 20, (day) => 150 + day) // rising
    const result = projectTargetDate(readings, 5.7, now)
    expect(result.status).toBe('not_on_track')
    expect(result.projectedDate).toBeNull()
  })

  it('projects a target date for a clear declining trend', () => {
    const readings = readingsForDays(now, 30, (day) => 170 - day * 2) // steadily improving
    const result = projectTargetDate(readings, 5.7, now)
    expect(result.status).toBe('projected')
    expect(result.slopePerDay).toBeLessThan(0)
    expect(result.projectedDate).not.toBeNull()
    expect(result.projectedDaysRemaining).toBeGreaterThan(0)
  })
})
