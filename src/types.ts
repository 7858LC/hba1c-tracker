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
  /**
   * Calendar date the sleep session began — the night of, not the wake
   * date. A night of 9/16 (date: "2025-09-16") pairs with the
   * morning-of-9/17 fasting glucose reading in correlation views, the
   * same day-D -> day-D+1 pattern used for diet/exercise entries.
   */
  date: string
  /** total sleep duration in minutes */
  durationMinutes: number
  /** minutes awake during the sleep period (WASO) */
  wasoMinutes: number
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

/**
 * An event, not a daily field — logged whenever a supplement is started,
 * stopped, or changed (formulation or dose). Shown as vertical markers on
 * the glucose/eA1C trend charts so a later "wait, did I change something
 * around here?" moment is answered by the chart, not memory.
 */
export interface SupplementChangeEntry {
  id?: number
  /** YYYY-MM-DD, the date the change took effect */
  date: string
  supplementName: string
  /** free text, e.g. "not taking" or "500mg 1x/day" */
  priorState: string
  /** free text, e.g. "1000mg 1x/day" or "discontinued" */
  newState: string
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  id?: number
  goalHbA1c: number
  /**
   * Fasting glucose target (mg/dL) used by the "days maintained" headline
   * metric. Defaults to the optimal-metabolic-health fasting/pre-meal
   * ceiling (see lib/glycemicTargets.ts) — a derived, editable starting
   * point, not a clinical recommendation.
   */
  targetFastingGlucose: number
  labHbA1c?: number
  labHbA1cDate?: string
}
