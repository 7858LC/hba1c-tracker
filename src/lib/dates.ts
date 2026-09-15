export const DAY_MS = 24 * 60 * 60 * 1000

export function toDateKey(timestamp: number): string {
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysAgo(days: number, from: number = Date.now()): number {
  return from - days * DAY_MS
}

export function daySpan(timestamps: number[]): number {
  if (timestamps.length === 0) return 0
  const min = Math.min(...timestamps)
  const max = Math.max(...timestamps)
  return Math.floor((max - min) / DAY_MS) + 1
}
