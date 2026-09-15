import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function ExerciseLog({ limit = 15 }: { limit?: number }) {
  const entries = useLiveQuery(
    () => db.exercise.orderBy('timestamp').reverse().limit(limit).toArray(),
    [limit],
  )

  if (!entries) return <p>Loading…</p>
  if (entries.length === 0) return <p className="empty-state">No exercise logged yet.</p>

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>When</th>
          <th>Activity</th>
          <th>Modality</th>
          <th>Intensity</th>
          <th>Min</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td>{new Date(e.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
            <td>{e.activityType}</td>
            <td>{e.modality}</td>
            <td>{e.intensity}</td>
            <td>{e.durationMinutes}</td>
            <td>
              <button className="btn-small btn-ghost" onClick={() => db.exercise.delete(e.id!)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
