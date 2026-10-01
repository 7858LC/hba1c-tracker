import { CorrelationView } from '../components/dashboard/CorrelationView'
import { DaysMaintainedCard } from '../components/dashboard/DaysMaintainedCard'
import { EA1CCard } from '../components/dashboard/EA1CCard'
import { FastingTrendChart } from '../components/dashboard/FastingTrendChart'
import { PostMealTrendChart } from '../components/dashboard/PostMealTrendChart'
import { TimeInRangeChart } from '../components/dashboard/TimeInRangeChart'
import { TrendChart } from '../components/dashboard/TrendChart'
import { VariabilityCard } from '../components/dashboard/VariabilityCard'
import {
  useAllExercise,
  useAllMeals,
  useAllReadings,
  useAllSleep,
  useAllSupplementChanges,
  useSettings,
} from '../hooks/data'

export function DashboardPage() {
  const readings = useAllReadings()
  const meals = useAllMeals()
  const exercise = useAllExercise()
  const sleep = useAllSleep()
  const supplementChanges = useAllSupplementChanges()
  const settings = useSettings()

  if (!settings) return <p>Loading…</p>

  return (
    <div className="page">
      {/* Headline: durability, not a single best/lowest reading. */}
      <DaysMaintainedCard readings={readings} target={settings.targetFastingGlucose} />

      <div className="dashboard-grid">
        <EA1CCard readings={readings} />
        <VariabilityCard readings={readings} />
      </div>

      <TrendChart
        readings={readings}
        goal={settings.goalHbA1c}
        labHbA1c={settings.labHbA1c}
        supplementChanges={supplementChanges}
      />

      <FastingTrendChart
        readings={readings}
        target={settings.targetFastingGlucose}
        supplementChanges={supplementChanges}
      />

      <PostMealTrendChart readings={readings} supplementChanges={supplementChanges} />

      <TimeInRangeChart readings={readings} />

      <CorrelationView meals={meals} exercise={exercise} sleep={sleep} readings={readings} />
    </div>
  )
}
