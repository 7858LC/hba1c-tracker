import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, getSettings } from '../db/db'
import { computeStreak } from '../lib/streaks'
import type { AdherenceEntry, AppSettings } from '../types'

export function useAllReadings() {
  return useLiveQuery(() => db.readings.orderBy('timestamp').toArray(), []) ?? []
}

export function useAllMeals() {
  return useLiveQuery(() => db.meals.orderBy('timestamp').toArray(), []) ?? []
}

export function useAllExercise() {
  return useLiveQuery(() => db.exercise.orderBy('timestamp').toArray(), []) ?? []
}

export function useAllProtocols() {
  return useLiveQuery(() => db.protocols.toArray(), []) ?? []
}

export function useAllAdherence() {
  return useLiveQuery(() => db.adherence.toArray(), []) ?? []
}

/** True when an active protocol exists and today has no adherence logged yet. */
export function useNeedsProtocolLog(): boolean {
  const active = useLiveQuery(() => db.protocols.filter((p) => p.active).first(), [])
  const adherence = useLiveQuery<AdherenceEntry[]>(
    () =>
      active?.id != null
        ? db.adherence.where('protocolId').equals(active.id).toArray()
        : Promise.resolve([]),
    [active?.id],
  )

  if (active?.id == null || !adherence) return false
  return !computeStreak(adherence, active.id).loggedToday
}

export function useSettings(): AppSettings | undefined {
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  const live = useLiveQuery(() => db.settings.get(1), [])

  return live ?? settings
}
