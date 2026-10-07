import Dexie, { type EntityTable } from 'dexie'
import { FASTING_TARGET_HIGH } from '../lib/glycemicTargets'
import type {
  GlucoseReading,
  MealEntry,
  FastingWindowEntry,
  ExerciseEntry,
  SleepEntry,
  Protocol,
  AdherenceEntry,
  AppSettings,
  SupplementChangeEntry,
  GlucoseProtocolRun,
  LabA1cEntry,
  DuplicateReview,
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
  supplementChanges!: EntityTable<SupplementChangeEntry, 'id'>
  protocolRuns!: EntityTable<GlucoseProtocolRun, 'id'>
  labA1cEntries!: EntityTable<LabA1cEntry, 'id'>
  duplicateReviews!: EntityTable<DuplicateReview, 'id'>

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
    this.version(2).stores({
      supplementChanges: '++id, date',
    })
    // v3: longitudinal metabolic analysis upgrade — meal/protocol linking,
    // lab A1c history, duplicate review. All additive; no v1/v2 store is
    // touched, so existing data and indexes are untouched.
    this.version(3).stores({
      readings: '++id, timestamp, context, source, mealId, protocolRunId',
      protocolRuns: '++id, type, active',
      labA1cEntries: '++id, labDate',
      duplicateReviews: '++id, pairKey',
    })
  }
}

export const db = new HbA1cDatabase()

export const DEFAULT_SETTINGS: Omit<AppSettings, 'id'> = {
  goalHbA1c: 5.7,
  targetFastingGlucose: FASTING_TARGET_HIGH,
}

const SETTINGS_ID = 1

/**
 * Settings is a singleton row at a fixed id, not "whichever row comes
 * first" — a read-then-add race (e.g. two components mounting around the
 * same time) can otherwise create duplicate rows, since add() doesn't
 * check for an existing one. put() with a fixed id is idempotent: it's
 * a no-op collision, never a duplicate.
 */
export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(SETTINGS_ID)
  if (existing) {
    // Backfill fields added after a settings row already existed on a
    // real device, rather than leaving `undefined` for callers to trip
    // over — this has already happened once (targetFastingGlucose is new).
    if (existing.targetFastingGlucose == null) {
      const migrated: AppSettings = {
        ...existing,
        targetFastingGlucose: DEFAULT_SETTINGS.targetFastingGlucose,
      }
      await db.settings.put(migrated)
      return migrated
    }
    return existing
  }
  const settings: AppSettings = { id: SETTINGS_ID, ...DEFAULT_SETTINGS }
  await db.settings.put(settings)
  return settings
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (settings.id == null) {
    throw new Error('saveSettings requires an existing settings id')
  }
  await db.settings.put(settings)
}
