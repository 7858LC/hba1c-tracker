import { db } from '../db/db'
import type {
  AdherenceEntry,
  AppSettings,
  DuplicateReview,
  ExerciseEntry,
  FastingWindowEntry,
  GlucoseProtocolRun,
  GlucoseReading,
  LabA1cEntry,
  MealEntry,
  Protocol,
  SleepEntry,
  SupplementChangeEntry,
} from '../types'

export interface BackupPayload {
  exportedAt: string
  readings: GlucoseReading[]
  meals: MealEntry[]
  fastingWindows: FastingWindowEntry[]
  exercise: ExerciseEntry[]
  sleep: SleepEntry[]
  protocols: Protocol[]
  adherence: AdherenceEntry[]
  settings: AppSettings[]
  supplementChanges: SupplementChangeEntry[]
  protocolRuns: GlucoseProtocolRun[]
  labA1cEntries: LabA1cEntry[]
  duplicateReviews: DuplicateReview[]
}

const REQUIRED_ARRAY_KEYS: (keyof BackupPayload)[] = [
  'readings',
  'meals',
  'fastingWindows',
  'exercise',
  'sleep',
  'protocols',
  'adherence',
  'settings',
]

// Added after the original 8 — a backup taken before this upgrade won't
// have these keys at all. Defaulted to [] rather than required, so an
// older backup file still restores successfully instead of being rejected.
const OPTIONAL_ARRAY_KEYS: (keyof BackupPayload)[] = [
  'supplementChanges',
  'protocolRuns',
  'labA1cEntries',
  'duplicateReviews',
]

export function parseBackupFile(text: string): BackupPayload {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unexpected backup format.')
  }
  const obj = data as Record<string, unknown>
  for (const key of REQUIRED_ARRAY_KEYS) {
    if (!Array.isArray(obj[key])) {
      throw new Error(
        `Missing or invalid "${key}" field — this doesn't look like an HbA1c Tracker backup file.`,
      )
    }
  }
  for (const key of OPTIONAL_ARRAY_KEYS) {
    if (!Array.isArray(obj[key])) obj[key] = []
  }
  return obj as unknown as BackupPayload
}

export type RestoreCounts = Record<
  Exclude<keyof BackupPayload, 'exportedAt'>,
  number
>

/**
 * Replaces ALL local data with the backup's contents — a restore, not a
 * merge. Records keep their original ids so relations (e.g. adherence ->
 * protocolId) stay intact.
 */
export async function restoreBackup(payload: BackupPayload): Promise<RestoreCounts> {
  await db.transaction(
    'rw',
    [
      db.readings,
      db.meals,
      db.fastingWindows,
      db.exercise,
      db.sleep,
      db.protocols,
      db.adherence,
      db.settings,
      db.supplementChanges,
      db.protocolRuns,
      db.labA1cEntries,
      db.duplicateReviews,
    ],
    async () => {
      await Promise.all([
        db.readings.clear(),
        db.meals.clear(),
        db.fastingWindows.clear(),
        db.exercise.clear(),
        db.sleep.clear(),
        db.protocols.clear(),
        db.adherence.clear(),
        db.settings.clear(),
        db.supplementChanges.clear(),
        db.protocolRuns.clear(),
        db.labA1cEntries.clear(),
        db.duplicateReviews.clear(),
      ])
      await Promise.all([
        db.readings.bulkPut(payload.readings),
        db.meals.bulkPut(payload.meals),
        db.fastingWindows.bulkPut(payload.fastingWindows),
        db.exercise.bulkPut(payload.exercise),
        db.sleep.bulkPut(payload.sleep),
        db.protocols.bulkPut(payload.protocols),
        db.adherence.bulkPut(payload.adherence),
        db.settings.bulkPut(payload.settings),
        db.supplementChanges.bulkPut(payload.supplementChanges),
        db.protocolRuns.bulkPut(payload.protocolRuns),
        db.labA1cEntries.bulkPut(payload.labA1cEntries),
        db.duplicateReviews.bulkPut(payload.duplicateReviews),
      ])
    },
  )
  return {
    readings: payload.readings.length,
    meals: payload.meals.length,
    fastingWindows: payload.fastingWindows.length,
    exercise: payload.exercise.length,
    sleep: payload.sleep.length,
    supplementChanges: payload.supplementChanges.length,
    protocolRuns: payload.protocolRuns.length,
    labA1cEntries: payload.labA1cEntries.length,
    duplicateReviews: payload.duplicateReviews.length,
    protocols: payload.protocols.length,
    adherence: payload.adherence.length,
    settings: payload.settings.length,
  }
}
