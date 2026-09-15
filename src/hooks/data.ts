import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, getSettings } from '../db/db'
import type { AppSettings } from '../types'

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

export function useSettings(): AppSettings | undefined {
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  const live = useLiveQuery(() => db.settings.get(1), [])

  return live ?? settings
}
