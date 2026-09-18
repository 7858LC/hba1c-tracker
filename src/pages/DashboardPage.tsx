import { CorrelationView } from '../components/dashboard/CorrelationView'
import { EA1CCard } from '../components/dashboard/EA1CCard'
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
      <div className="dashboard-grid">
        <EA1CCard readings={readings} />
        <VariabilityCard readings={readings} />
      </div>

      <TrendChart readings={readings} goal={settings.goalHbA1c} labHbA1c={settings.labHbA1c} />

      <TimeInRangeChart
        readings={readings}
        low={settings.targetRangeLow}
        high={settings.targetRangeHigh}
      />

      <CorrelationView meals={meals} exercise={exercise} sleep={sleep} readings={readings} />
    </div>
  )
}
