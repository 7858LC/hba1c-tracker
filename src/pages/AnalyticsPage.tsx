import { AwakeningPatternCard } from '../components/analytics/AwakeningPatternCard'
import { ExerciseEffectCard } from '../components/analytics/ExerciseEffectCard'
import { FastingPreMealCard } from '../components/analytics/FastingPreMealCard'
import { MealResponseCard } from '../components/analytics/MealResponseCard'
import { OverallSummaryCard } from '../components/analytics/OverallSummaryCard'
import { RecommendedMeasurementsCard } from '../components/analytics/RecommendedMeasurementsCard'
import { SleepRelationshipCard } from '../components/analytics/SleepRelationshipCard'
import { TimePatternsCard } from '../components/analytics/TimePatternsCard'
import { LabA1cLog } from '../components/LabA1cLog'
import { DataQualityCard } from '../components/dashboard/DataQualityCard'
import {
  useAllExercise,
  useAllMeals,
  useAllReadings,
  useAllSleep,
  useSettings,
} from '../hooks/data'

export function AnalyticsPage() {
  const readings = useAllReadings()
  const meals = useAllMeals()
  const exercise = useAllExercise()
  const sleep = useAllSleep()
  const settings = useSettings()

  if (!settings) return <p>Loading…</p>

  return (
    <div className="page">
      <p className="hint">
        Patterns and associations from your own data — not a diagnosis. "Pattern is consistent
        with," "may suggest," and "insufficient data to determine" are the operative phrases
        throughout; anything worth acting on is worth discussing with a clinician first.
      </p>

      {/* 1: Current Glucose Status / A: Overall */}
      <OverallSummaryCard readings={readings} />

      {/* 2: Fasting Pattern + 3rd item folded in: Pre-meal (B+C) */}
      <FastingPreMealCard readings={readings} sleepEntries={sleep} />

      {/* 3: Awakening Pattern (E) */}
      <AwakeningPatternCard readings={readings} sleepEntries={sleep} />

      {/* 4: Meal Response (D) */}
      <MealResponseCard readings={readings} meals={meals} />

      {/* 5: Exercise Effect (H) */}
      <ExerciseEffectCard readings={readings} exerciseEntries={exercise} />

      {/* 6: Sleep Relationship (I) */}
      <SleepRelationshipCard
        readings={readings}
        sleepEntries={sleep}
        targetFastingGlucose={settings.targetFastingGlucose}
      />

      {/* 7: Time-of-Day Pattern (F+G) */}
      <TimePatternsCard readings={readings} />

      {/* 8: Laboratory A1c Comparison */}
      <div className="card">
        <h2>Laboratory A1c comparison</h2>
        <p className="hint">
          Lab A1c is shown separately from meter-derived GMI, never implied to be the same
          measurement. A difference between them does not by itself prove anything about red
          blood cell lifespan or any other condition.
        </p>
        <LabA1cLog readings={readings} />
        <p className="stat-caveat">Add new lab results from the Settings tab.</p>
      </div>

      {/* 9: Data Quality */}
      <DataQualityCard readings={readings} meals={meals} sleepEntries={sleep} exerciseEntries={exercise} />

      {/* 10: Recommended Next Measurements */}
      <RecommendedMeasurementsCard
        readings={readings}
        meals={meals}
        sleepEntries={sleep}
        exerciseEntries={exercise}
      />

      <p className="stat-caveat">
        Glucose-over-time, fasting-over-time, and post-meal trend charts live on the Dashboard
        tab — not duplicated here to avoid maintaining the same chart twice.
      </p>
    </div>
  )
}
