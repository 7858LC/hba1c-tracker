import { useState } from 'react'
import { db } from '../db/db'
import type { ExerciseIntensity, ExerciseModality } from '../types'

const MODALITIES: ExerciseModality[] = ['aerobic', 'resistance', 'mixed', 'other']
const INTENSITIES: ExerciseIntensity[] = ['low', 'moderate', 'high']

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ExerciseForm() {
  const [activityType, setActivityType] = useState('')
  const [modality, setModality] = useState<ExerciseModality>('aerobic')
  const [intensity, setIntensity] = useState<ExerciseIntensity>('moderate')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [timestampStr, setTimestampStr] = useState(nowLocal())
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const duration = Number(durationMinutes)
    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Enter a duration in minutes.')
      return
    }
    const timestamp = new Date(timestampStr).getTime()
    const now = Date.now()
    await db.exercise.add({
      timestamp,
      activityType: activityType || modality,
      modality,
      durationMinutes: duration,
      intensity,
      createdAt: now,
      updatedAt: now,
    })
    setActivityType('')
    setDurationMinutes('')
    setTimestampStr(nowLocal())
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label htmlFor="exercise-activity">Activity</label>
        <input
          id="exercise-activity"
          type="text"
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          placeholder="e.g. walk, weights, cycling"
        />
      </div>
      <div className="field-row">
        <label id="exercise-modality-label">Modality</label>
        <div className="chip-group" role="group" aria-labelledby="exercise-modality-label">
          {MODALITIES.map((m) => (
            <button
              type="button"
              key={m}
              className={`chip ${modality === m ? 'chip-active' : ''}`}
              onClick={() => setModality(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <label id="exercise-intensity-label">Intensity</label>
        <div className="chip-group" role="group" aria-labelledby="exercise-intensity-label">
          {INTENSITIES.map((i) => (
            <button
              type="button"
              key={i}
              className={`chip ${intensity === i ? 'chip-active' : ''}`}
              onClick={() => setIntensity(i)}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <label htmlFor="exercise-duration">Duration (min)</label>
        <input
          id="exercise-duration"
          type="number"
          inputMode="numeric"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          placeholder="e.g. 30"
          required
        />
      </div>
      <div className="field-row">
        <label htmlFor="exercise-when">When</label>
        <input
          id="exercise-when"
          type="datetime-local"
          value={timestampStr}
          onChange={(e) => setTimestampStr(e.target.value)}
          required
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save exercise
      </button>
    </form>
  )
}
