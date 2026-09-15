import { useState } from 'react'
import { db } from '../db/db'
import type { MealType } from '../types'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MealForm() {
  const [carbs, setCarbs] = useState('')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [description, setDescription] = useState('')
  const [timestampStr, setTimestampStr] = useState(nowLocal())
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const numeric = Number(carbs)
    if (!Number.isFinite(numeric) || numeric < 0) {
      setError('Enter carb grams (0 or more).')
      return
    }
    const timestamp = new Date(timestampStr).getTime()
    const now = Date.now()
    await db.meals.add({
      timestamp,
      carbsGrams: numeric,
      mealType,
      description: description || undefined,
      createdAt: now,
      updatedAt: now,
    })
    setCarbs('')
    setDescription('')
    setTimestampStr(nowLocal())
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label htmlFor="meal-carbs">Carbs (g)</label>
        <input
          id="meal-carbs"
          type="number"
          inputMode="numeric"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
          placeholder="e.g. 45"
          required
        />
      </div>
      <div className="field-row">
        <label id="meal-type-label">Meal</label>
        <div className="chip-group" role="group" aria-labelledby="meal-type-label">
          {MEAL_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              className={`chip ${mealType === t ? 'chip-active' : ''}`}
              onClick={() => setMealType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <label htmlFor="meal-when">When</label>
        <input
          id="meal-when"
          type="datetime-local"
          value={timestampStr}
          onChange={(e) => setTimestampStr(e.target.value)}
          required
        />
      </div>
      <div className="field-row">
        <label htmlFor="meal-description">Description (optional)</label>
        <input
          id="meal-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. oatmeal + berries"
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save meal
      </button>
    </form>
  )
}
