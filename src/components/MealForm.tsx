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
  const [showMore, setShowMore] = useState(false)
  const [fiber, setFiber] = useState('')
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')
  const [calories, setCalories] = useState('')
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
      fiberGrams: fiber ? Number(fiber) : undefined,
      proteinGrams: protein ? Number(protein) : undefined,
      fatGrams: fat ? Number(fat) : undefined,
      calories: calories ? Number(calories) : undefined,
      createdAt: now,
      updatedAt: now,
    })
    setCarbs('')
    setDescription('')
    setFiber('')
    setProtein('')
    setFat('')
    setCalories('')
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
          placeholder="e.g. eggs, avocado, spinach"
        />
      </div>

      <button type="button" className="btn-ghost btn-small" onClick={() => setShowMore((s) => !s)}>
        {showMore ? 'Hide macros' : 'Add macros (optional)'}
      </button>

      {showMore && (
        <div className="entry-form-nested">
          <div className="field-row">
            <label htmlFor="meal-fiber">Fiber (g, optional)</label>
            <input id="meal-fiber" type="number" inputMode="numeric" value={fiber} onChange={(e) => setFiber(e.target.value)} />
          </div>
          <div className="field-row">
            <label htmlFor="meal-protein">Protein (g, optional)</label>
            <input id="meal-protein" type="number" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>
          <div className="field-row">
            <label htmlFor="meal-fat">Fat (g, optional)</label>
            <input id="meal-fat" type="number" inputMode="numeric" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
          <div className="field-row">
            <label htmlFor="meal-calories">Calories (optional)</label>
            <input id="meal-calories" type="number" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save meal
      </button>
    </form>
  )
}
