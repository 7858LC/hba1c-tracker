import type { DuplicateReview, GlucoseReading } from '../types'

const DUPLICATE_WINDOW_MS = 2 * 60_000

export interface DuplicateCandidate {
  a: GlucoseReading
  b: GlucoseReading
  pairKey: string
}

export function pairKey(idA: number, idB: number): string {
  const [lo, hi] = idA < idB ? [idA, idB] : [idB, idA]
  return `${lo}-${hi}`
}

/**
 * Flags reading pairs within 2 minutes with the same value AND context as
 * potential duplicates. Never auto-merges or auto-deletes anything — this
 * only surfaces candidates for the user to confirm. Pairs the user has
 * already confirmed are NOT duplicates (via a DuplicateReview row with
 * notDuplicate=true) are excluded so they aren't re-flagged on every view.
 */
export function detectPotentialDuplicates(
  readings: GlucoseReading[],
  reviewed: DuplicateReview[] = [],
): DuplicateCandidate[] {
  const reviewedKeys = new Set(reviewed.filter((r) => r.notDuplicate).map((r) => r.pairKey))
  const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp)
  const candidates: DuplicateCandidate[] = []

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      // sorted by timestamp, so once b is too far past a, no later j can
      // match either — safe to stop scanning this i.
      if (b.timestamp - a.timestamp > DUPLICATE_WINDOW_MS) break
      if (a.id == null || b.id == null) continue
      if (a.value !== b.value || a.context !== b.context) continue
      const key = pairKey(a.id, b.id)
      if (reviewedKeys.has(key)) continue
      candidates.push({ a, b, pairKey: key })
    }
  }
  return candidates
}
