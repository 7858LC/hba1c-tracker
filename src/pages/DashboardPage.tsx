import { CorrelationView } from '../components/dashboard/CorrelationView'
import { DaysMaintainedCard } from '../components/dashboard/DaysMaintainedCard'
import { EA1CCard } from '../components/dashboard/EA1CCard'
import { FastingTrendChart } from '../components/dashboard/FastingTrendChart'
import { TimeInRangeChart } from '../components/dashboard/TimeInRangeChart'
import { TrendChart } from '../components/dashboard/TrendChart'
import { VariabilityCard } from '../components/dashboard/VariabilityCard'
import { useAllExercise, useAllMeals, useAllReadings, useAllSleep, useSettings } from '../hooks/data'

export function DashboardPage() {
  const readings = useAllReadings()
  const meals = useAllMeals()
  const exercise = useAllExercise()
  const sleep = useAllSleep()
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

      <TrendChart readings={readings} goal={settings.goalHbA1c} labHbA1c={settings.labHbA1c} />

      <FastingTrendChart readings={readings} target={settings.targetFastingGlucose} />

      <TimeInRangeChart
        readings={readings}
        low={settings.targetRangeLow}
        high={settings.targetRangeHigh}
      />

      <CorrelationView meals={meals} exercise={exercise} sleep={sleep} readings={readings} />
    </div>
  )
}
