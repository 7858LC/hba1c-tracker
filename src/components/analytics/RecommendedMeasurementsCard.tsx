import { computeDataQuality } from '../../lib/dataQuality'
import type { ExerciseEntry, GlucoseReading, MealEntry, SleepEntry } from '../../types'

export function RecommendedMeasurementsCard({
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
  const insufficient = items.filter((i) => i.status === 'insufficient')

  return (
    <div className="card">
      <h2>Recommended next measurements</h2>
      {insufficient.length === 0 ? (
        <p>Every analysis category above has enough data to report on. Keep logging to deepen it.</p>
      ) : (
        <>
          <p className="hint">What would unlock the most additional analysis, in the same order as the sections above:</p>
          <ul>
            {insufficient.map((item) => (
              <li key={item.label}>
                <strong>{item.label}:</strong> {item.detail.replace('insufficient — need ', '')}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
