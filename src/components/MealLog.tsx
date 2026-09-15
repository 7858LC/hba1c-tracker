import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function MealLog({ limit = 15 }: { limit?: number }) {
  const meals = useLiveQuery(
    () => db.meals.orderBy('timestamp').reverse().limit(limit).toArray(),
    [limit],
  )

  if (!meals) return <p>Loading…</p>
  if (meals.length === 0) return <p className="empty-state">No meals logged yet.</p>

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>When</th>
          <th>Meal</th>
          <th>Carbs (g)</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {meals.map((m) => (
          <tr key={m.id}>
            <td>{new Date(m.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
            <td>{m.mealType}{m.description ? ` · ${m.description}` : ''}</td>
            <td>{m.carbsGrams}</td>
            <td>
              <button className="btn-small btn-ghost" onClick={() => db.meals.delete(m.id!)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
