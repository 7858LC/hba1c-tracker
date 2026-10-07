import { describe, expect, it } from 'vitest'
import type { ExerciseEntry, FastingWindowEntry, GlucoseReading, MealEntry, SleepEntry } from '../../types'
import {
  actualMinutesSinceMeal,
  exerciseRecencyBucket,
  fastingDurationMinutes,
  findRelevantWake,
  minutesAfterWaking,
  minutesSinceExercise,
  postMealBucket,
} from '../elapsedTime'

function reading(timestamp: number, context: GlucoseReading['context'] = 'post_meal_1h'): GlucoseReading {
  return { timestamp, value: 100, context, source: 'manual', createdAt: timestamp, updatedAt: timestamp }
}

function meal(timestamp: number): MealEntry {
  return { timestamp, carbsGrams: 50, mealType: 'dinner', createdAt: timestamp, updatedAt: timestamp }
}

describe('actualMinutesSinceMeal + postMealBucket — the Oct 6 scenario', () => {
  it('reports the TRUE elapsed minutes regardless of the "1hr" context label, and buckets it as a 150-180min reading, not a 0-90min one', () => {
    const mealTime = Date.parse('2025-10-06T18:00:00')
    const m = meal(mealTime)
    // labeled post_meal_1h (target=60min) but actually logged 152 minutes later
    const r = { ...reading(mealTime + 152 * 60_000, 'post_meal_1h'), targetPostMealMinutes: 60 }

    const actual = actualMinutesSinceMeal(r, m)
    expect(actual).toBe(152)
    expect(postMealBucket(actual)).toBe('150-180')
    // critically, NOT the bucket its label would suggest
    expect(postMealBucket(actual)).not.toBe('0-90')
  })

  it('buckets a true 1-hour reading as 0-90', () => {
    const mealTime = Date.now()
    expect(postMealBucket(actualMinutesSinceMeal(reading(mealTime + 58 * 60_000), meal(mealTime)))).toBe(
      '0-90',
    )
  })

  it('buckets a true 2-hour reading as 90-150', () => {
    const mealTime = Date.now()
    expect(
      postMealBucket(actualMinutesSinceMeal(reading(mealTime + 125 * 60_000), meal(mealTime))),
    ).toBe('90-150')
  })

  it('buckets 150-180 and 180+ correctly at the boundaries', () => {
    expect(postMealBucket(150)).toBe('90-150')
    expect(postMealBucket(151)).toBe('150-180')
    expect(postMealBucket(180)).toBe('150-180')
    expect(postMealBucket(181)).toBe('180+')
  })

  it('returns null for a reading logged before its linked meal (invalid pairing)', () => {
    expect(postMealBucket(-5)).toBeNull()
  })
})

describe('minutesAfterWaking + findRelevantWake', () => {
  it('is null when wakeTimestamp is unknown', () => {
    expect(minutesAfterWaking(reading(Date.now()), {})).toBeNull()
  })

  it('computes exact minutes after a known wake time', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const r = reading(wake + 90 * 60_000, 'waking')
    expect(minutesAfterWaking(r, { wakeTimestamp: wake })).toBe(90)
  })

  it('distinguishes T0/T30/T60/T90 as genuinely different observations, not all "fasting"', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const t0 = minutesAfterWaking(reading(wake), { wakeTimestamp: wake })
    const t30 = minutesAfterWaking(reading(wake + 30 * 60_000), { wakeTimestamp: wake })
    const t60 = minutesAfterWaking(reading(wake + 60 * 60_000), { wakeTimestamp: wake })
    const t90 = minutesAfterWaking(reading(wake + 90 * 60_000), { wakeTimestamp: wake })
    expect(new Set([t0, t30, t60, t90]).size).toBe(4)
  })

  it('finds the most recent plausible wake time within the lookback window', () => {
    const wakeToday = Date.parse('2025-09-20T06:30:00')
    const wakeYesterday = Date.parse('2025-09-19T07:00:00')
    const sleepEntries: SleepEntry[] = [
      { date: '2025-09-18', durationMinutes: 420, wasoMinutes: 10, wakeTimestamp: wakeYesterday, createdAt: 0, updatedAt: 0 },
      { date: '2025-09-19', durationMinutes: 420, wasoMinutes: 10, wakeTimestamp: wakeToday, createdAt: 0, updatedAt: 0 },
    ]
    const r = reading(wakeToday + 20 * 60_000)
    expect(findRelevantWake(r, sleepEntries)?.wakeTimestamp).toBe(wakeToday)
  })

  it('does not attach a reading to a wake time more than the lookback window in the past', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const sleepEntries: SleepEntry[] = [
      { date: '2025-09-19', durationMinutes: 420, wasoMinutes: 10, wakeTimestamp: wake, createdAt: 0, updatedAt: 0 },
    ]
    const r = reading(wake + 8 * 60 * 60_000) // 8 hours later, beyond the default 6h lookback
    expect(findRelevantWake(r, sleepEntries)).toBeNull()
  })

  it('ignores a wake time that is after the reading', () => {
    const wake = Date.parse('2025-09-20T06:30:00')
    const sleepEntries: SleepEntry[] = [
      { date: '2025-09-20', durationMinutes: 420, wasoMinutes: 10, wakeTimestamp: wake, createdAt: 0, updatedAt: 0 },
    ]
    const r = reading(wake - 60 * 60_000)
    expect(findRelevantWake(r, sleepEntries)).toBeNull()
  })
})

describe('fastingDurationMinutes', () => {
  it('is null when no fasting window is known', () => {
    expect(fastingDurationMinutes(reading(Date.now()), [])).toBeNull()
  })

  it('computes duration from the most recent eating window end before the reading', () => {
    const eatingEnd = Date.parse('2025-09-19T20:00:00')
    const windows: FastingWindowEntry[] = [
      { date: '2025-09-19', eatingStart: eatingEnd - 3600_000, eatingEnd, createdAt: 0, updatedAt: 0 },
    ]
    const r = reading(eatingEnd + 12 * 60 * 60_000, 'fasting') // 12h later
    expect(fastingDurationMinutes(r, windows)).toBe(12 * 60)
  })

  it('does not infer fasting duration from an implausibly old eating window (>72h)', () => {
    const eatingEnd = Date.parse('2025-09-10T20:00:00')
    const windows: FastingWindowEntry[] = [
      { date: '2025-09-10', eatingStart: eatingEnd - 3600_000, eatingEnd, createdAt: 0, updatedAt: 0 },
    ]
    const r = reading(eatingEnd + 100 * 60 * 60_000, 'fasting') // 100h later
    expect(fastingDurationMinutes(r, windows)).toBeNull()
  })

  it('picks the most recent of several eating windows, not the earliest', () => {
    const earlierEnd = Date.parse('2025-09-18T20:00:00')
    const laterEnd = Date.parse('2025-09-19T20:00:00')
    const windows: FastingWindowEntry[] = [
      { date: '2025-09-18', eatingStart: earlierEnd - 3600_000, eatingEnd: earlierEnd, createdAt: 0, updatedAt: 0 },
      { date: '2025-09-19', eatingStart: laterEnd - 3600_000, eatingEnd: laterEnd, createdAt: 0, updatedAt: 0 },
    ]
    const r = reading(laterEnd + 10 * 60 * 60_000, 'fasting')
    expect(fastingDurationMinutes(r, windows)).toBe(10 * 60)
  })
})

describe('minutesSinceExercise + exerciseRecencyBucket', () => {
  function exercise(timestamp: number, durationMinutes: number): ExerciseEntry {
    return {
      timestamp,
      activityType: 'walk',
      modality: 'aerobic',
      durationMinutes,
      intensity: 'moderate',
      createdAt: 0,
      updatedAt: 0,
    }
  }

  it('is null with no exercise events', () => {
    expect(minutesSinceExercise(reading(Date.now()), [])).toBeNull()
  })

  it('computes minutes since the exercise event ENDED, not started', () => {
    const start = Date.parse('2025-09-20T08:00:00')
    const ex = exercise(start, 30) // ends at 08:30
    const r = reading(start + 60 * 60_000) // 09:00 -> 30 min after end
    expect(minutesSinceExercise(r, [ex])).toBe(30)
  })

  it('does not count exercise that starts after the reading', () => {
    const r = reading(Date.parse('2025-09-20T08:00:00'))
    const ex = exercise(Date.parse('2025-09-20T09:00:00'), 30)
    expect(minutesSinceExercise(r, [ex])).toBeNull()
  })

  it('picks the most recently ended exercise among several', () => {
    const r = reading(Date.parse('2025-09-20T12:00:00'))
    const morning = exercise(Date.parse('2025-09-20T07:00:00'), 30) // ends 07:30
    const noon = exercise(Date.parse('2025-09-20T11:00:00'), 30) // ends 11:30
    expect(minutesSinceExercise(r, [morning, noon])).toBe(30)
  })

  it('buckets recency into the comparison windows', () => {
    expect(exerciseRecencyBucket(30)).toBe('0-1h')
    expect(exerciseRecencyBucket(120)).toBe('1-3h')
    expect(exerciseRecencyBucket(400)).toBe('3-12h')
    expect(exerciseRecencyBucket(1000)).toBe('12-24h')
    expect(exerciseRecencyBucket(2000)).toBe('none')
    expect(exerciseRecencyBucket(null)).toBe('none')
  })
})
