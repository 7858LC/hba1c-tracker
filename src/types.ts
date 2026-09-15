// Core data model. All persisted locally (IndexedDB via Dexie) — see src/db/db.ts.

export type GlucoseContext =
  | 'fasting'
  | 'pre_meal'
  | 'post_meal_1h'
  | 'post_meal_2h'
  | 'random'

export type GlucoseSource = 'manual' | 'csv_import'

export interface GlucoseReading {
  id?: number
  /** epoch ms */
  timestamp: number
  /** mg/dL */
  value: number
  context: GlucoseContext
  note?: string
  source: GlucoseSource
  createdAt: number
  updatedAt: number
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealEntry {
  id?: number
  timestamp: number
  carbsGrams: number
  mealType: MealType
  description?: string
  createdAt: number
  updatedAt: number
}

export interface FastingWindowEntry {
  id?: number
  /** calendar date the eating window started, YYYY-MM-DD */
  date: string
  /** epoch ms of first bite */
  eatingStart: number
  /** epoch ms of last bite */
  eatingEnd: number
  createdAt: number
  updatedAt: number
}

export type ExerciseModality = 'aerobic' | 'resistance' | 'mixed' | 'other'
export type ExerciseIntensity = 'low' | 'moderate' | 'high'

export interface ExerciseEntry {
  id?: number
  timestamp: number
  activityType: string
  modality: ExerciseModality
  durationMinutes: number
  intensity: ExerciseIntensity
  note?: string
  createdAt: number
  updatedAt: number
}

export interface SleepEntry {
  id?: number
  /** calendar date the sleep is attributed to (morning of), YYYY-MM-DD */
  date: string
  hours: number
  note?: string
  createdAt: number
  updatedAt: number
}

export interface ProtocolRule {
  id: string
  label: string
}

export interface Protocol {
  id?: number
  name: string
  description?: string
  rules: ProtocolRule[]
  active: boolean
  createdAt: number
  updatedAt: number
}

export interface AdherenceEntry {
  id?: number
  /** YYYY-MM-DD */
  date: string
  protocolId: number
  /** ProtocolRule ids the user completed that day */
  metRuleIds: string[]
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  id?: number
  targetRangeLow: number
  targetRangeHigh: number
  goalHbA1c: number
  labHbA1c?: number
  labHbA1cDate?: string
}
