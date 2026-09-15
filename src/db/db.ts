import Dexie, { type EntityTable } from 'dexie'
import type {
  GlucoseReading,
  MealEntry,
  FastingWindowEntry,
  ExerciseEntry,
  SleepEntry,
  Protocol,
  AdherenceEntry,
  AppSettings,
} from '../types'

class HbA1cDatabase extends Dexie {
  readings!: EntityTable<GlucoseReading, 'id'>
  meals!: EntityTable<MealEntry, 'id'>
  fastingWindows!: EntityTable<FastingWindowEntry, 'id'>
  exercise!: EntityTable<ExerciseEntry, 'id'>
  sleep!: EntityTable<SleepEntry, 'id'>
  protocols!: EntityTable<Protocol, 'id'>
  adherence!: EntityTable<AdherenceEntry, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('hba1c-tracker')
    this.version(1).stores({
      readings: '++id, timestamp, context, source',
      meals: '++id, timestamp, mealType',
      fastingWindows: '++id, date, eatingStart',
      exercise: '++id, timestamp, modality',
      sleep: '++id, date',
      protocols: '++id, active',
      adherence: '++id, date, protocolId, [protocolId+date]',
      settings: '++id',
    })
  }
}

export const db = new HbA1cDatabase()

export const DEFAULT_SETTINGS: Omit<AppSettings, 'id'> = {
  targetRangeLow: 70,
  targetRangeHigh: 180,
  goalHbA1c: 5.7,
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.toCollection().first()
  if (existing) return existing
  const id = await db.settings.add(DEFAULT_SETTINGS)
  return { id, ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (settings.id == null) {
    throw new Error('saveSettings requires an existing settings id')
  }
  await db.settings.put(settings)
}
