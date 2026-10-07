import { computeDataQuality } from '../../lib/dataQuality'
import type { ExerciseEntry, GlucoseReading, MealEntry, SleepEntry } from '../../types'

export function DataQualityCard({
  readings,
  meals,
  sleepEntries,
  exerciseEntries,
}: {
  readings: GlucoseReading[]
  meals: MealEntry[]
  sleepEntries: SleepEntry[]
  exerciseEntries: ExerciseEntry[]
}) {
  const items = computeDataQuality({ readings, meals, sleepEntries, exerciseEntries })

  return (
    <div className="card">
      <h2>Data quality — what's ready to analyze</h2>
      <p className="hint">
        Prevents the dashboard from showing confident-looking statistics built on too little (or
        the wrong kind of) data.
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <span className={`status-pill ${item.status === 'good' ? 'good' : 'warning'}`}>
              {item.status === 'good' ? 'Good' : 'Insufficient'}
            </span>{' '}
            <strong>{item.label}:</strong> {item.detail}
          </li>
        ))}
      </ul>
    </div>
  )
}
