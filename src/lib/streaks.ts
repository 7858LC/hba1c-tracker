import type { AdherenceEntry } from '../types'
import { DAY_MS, toDateKey } from './dates'

export interface StreakResult {
  currentStreak: number
  longestStreak: number
  loggedToday: boolean
  todayMetCount: number
}

/**
 * Current/longest streak of consecutive calendar days with at least one
 * rule checked, for the given protocol. Today only counts once it has a
 * checked rule — an empty "today" neither extends nor breaks the streak,
 * since the day isn't over yet.
 */
export function computeStreak(
  adherence: AdherenceEntry[],
  protocolId: number,
  now: number = Date.now(),
): StreakResult {
  const forProtocol = adherence.filter((a) => a.protocolId === protocolId)
  const loggedDates = new Set(
    forProtocol.filter((a) => a.metRuleIds.length > 0).map((a) => a.date),
  )

  const todayKey = toDateKey(now)
  const loggedToday = loggedDates.has(todayKey)
  const todayEntry = forProtocol.find((a) => a.date === todayKey)

  let cursor = loggedToday ? now : now - DAY_MS
  let currentStreak = 0
  while (loggedDates.has(toDateKey(cursor))) {
    currentStreak++
    cursor -= DAY_MS
  }

  const sortedDates = [...loggedDates].sort()
  let longestStreak = 0
  let running = 0
  let prevTime: number | null = null
  for (const dateKey of sortedDates) {
    const t = Date.parse(`${dateKey}T00:00:00`)
    running = prevTime != null && t - prevTime === DAY_MS ? running + 1 : 1
    longestStreak = Math.max(longestStreak, running)
    prevTime = t
  }

  return {
    currentStreak,
    longestStreak,
    loggedToday,
    todayMetCount: todayEntry?.metRuleIds.length ?? 0,
  }
}
