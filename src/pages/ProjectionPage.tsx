import { ProjectionCard } from '../components/ProjectionCard'
import { useAllReadings, useSettings } from '../hooks/data'

export function ProjectionPage() {
  const readings = useAllReadings()
  const settings = useSettings()

  if (!settings) return <p>Loading…</p>

  return (
    <div className="page">
      <ProjectionCard readings={readings} goal={settings.goalHbA1c} />
    </div>
  )
}
