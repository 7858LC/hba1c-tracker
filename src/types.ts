// Core data model. All persisted locally (IndexedDB via Dexie) — see src/db/db.ts.

/**
 * post_meal_1h/post_meal_2h are kept exactly as before (existing features —
 * eA1C eligibility, glycemic targets, durability blend, charts, correlation —
 * all key off these specific values). The newer, generic `post_meal` is for
 * when a reading is clearly post-meal but the user doesn't know/want to
 * assert which timing bucket it falls in — the actual bucketing for
 * analysis comes from `actualMinutesSinceMeal` (lib/elapsedTime.ts), not
 * from this label, so a generic tag here doesn't lose analytical precision.
 */
export type GlucoseContext =
  | 'fasting'
  | 'pre_meal'
  | 'post_meal_1h'
  | 'post_meal_2h'
  | 'post_meal'
  | 'waking'
  | 'bedtime'
  | 'overnight'
  | 'exercise'
  | 'random'
  | 'symptom_driven'

export type GlucoseSource = 'manual' | 'csv_import'

export type StressLevel = 1 | 2 | 3 | 4 | 5
export type HydrationStatus = 'low' | 'normal' | 'high'

export interface GlucoseReading {
  id?: number
  /** epoch ms — the canonical instant, unchanged from before */
  timestamp: number
  /**
   * Local UTC offset in minutes AT THE TIME OF ENTRY (east-of-UTC positive,
   * i.e. `-new Date().getTimezoneOffset()`), captured once and never
   * recomputed later — so a reading logged while traveling keeps its true
   * local wall-clock hour for time-of-day analysis even if the device's
   * current timezone later differs. Optional: absent on older rows and on
   * CSV-imported rows where it can't be known.
   */
  timezoneOffsetMinutes?: number
  /** mg/dL */
  value: number
  context: GlucoseContext
  note?: string
  source: GlucoseSource
  /** free text — which meter/app produced this reading, optional */
  deviceId?: string
  /** links this reading to a MealEntry for actual-elapsed-time analysis */
  mealId?: number
  /**
   * User's INTENDED post-meal timing (e.g. 60 for "meant to be the 1hr
   * check") — kept for intent, but analysis uses actualMinutesSinceMeal
   * (computed from mealId's timestamp), never this value, since the two
   * can diverge significantly in practice.
   */
  targetPostMealMinutes?: number
  /** links this reading to a GlucoseProtocolRun (awakening / meal_response) */
  protocolRunId?: number
  /** role within that protocol run, e.g. "T0"/"T30"/"T60" or "pre"/"30min" */
  protocolRole?: string
  // Lightweight optional context — quick-entry flags, not a form to fill out.
  caffeineBeforeMeasurement?: boolean
  alcoholPrevious24h?: boolean
  stressLevel?: StressLevel
  illnessFlag?: boolean
  medicationsTaken?: string
  supplementsTaken?: string
  hydrationStatus?: HydrationStatus
  symptoms?: string
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
  // Optional macro detail — never required. "eggs, avocado, spinach" in
  // `description` with nothing else filled in is a complete, valid entry.
  fiberGrams?: number
  proteinGrams?: number
  fatGrams?: number
  calories?: number
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
  /**
   * epoch ms of the actual wake moment, when known — distinct from `date`
   * (just the calendar night). This is what minutesAfterWaking is computed
   * against; without it, waking-relative analysis isn't possible for that
   * night, and the app says so rather than guessing a wake time from the
   * date alone.
   */
  wakeTimestamp?: number
  sleepQuality?: StressLevel
  /** device/app-reported sleep score (e.g. 0-100), optional, unit varies by source */
  sleepScore?: number
  awakeningsCount?: number
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

/**
 * A structured, time-limited glucose-collection protocol — distinct from
 * `Protocol` above, which is a daily behavior checklist. These are
 * "Awakening Glucose Profile" (T0/T30/T60 each morning) and "Meal Glucose
 * Response" (pre/30/60/90/120 min around one meal) runs; readings tag
 * themselves into a run via `GlucoseReading.protocolRunId` + `protocolRole`
 * so they can be analyzed together regardless of when else they were
 * logged.
 */
export type GlucoseProtocolType = 'awakening' | 'meal_response'

export interface GlucoseProtocolRun {
  id?: number
  type: GlucoseProtocolType
  /** YYYY-MM-DD the run was started, for display ("day 3 of 14") */
  startDate: string
  /** only set for meal_response runs — the meal this run is centered on */
  mealId?: number
  active: boolean
  createdAt: number
  updatedAt: number
}

/**
 * A lab-drawn HbA1c history, separate from the single labHbA1c/labHbA1cDate
 * fields on AppSettings (kept as-is for back-compat — that pair still
 * drives the existing single "lab HbA1c" reference line). This is a full
 * history for comparing GMI trend against multiple real draws over time.
 */
export interface LabA1cEntry {
  id?: number
  /** YYYY-MM-DD */
  labDate: string
  a1cPercent: number
  labFastingGlucose?: number
  labSource?: string
  notes?: string
  createdAt: number
  updatedAt: number
}

/**
 * A user's verdict on a flagged potential-duplicate reading pair — created
 * only when the user explicitly confirms the pair is NOT a duplicate
 * (two real, distinct readings that happen to be close in time/value).
 * Readings are never auto-merged or auto-deleted; this just suppresses a
 * pair from being re-flagged once reviewed.
 */
export interface DuplicateReview {
  id?: number
  /** `${min(idA,idB)}-${max(idA,idB)}` — stable regardless of entry order */
  pairKey: string
  readingIdA: number
  readingIdB: number
  notDuplicate: boolean
  createdAt: number
  updatedAt: number
}
