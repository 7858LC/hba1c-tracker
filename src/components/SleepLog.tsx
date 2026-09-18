import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function SleepLog({ limit = 10 }: { limit?: number }) {
  const entries = useLiveQuery(
    () => db.sleep.orderBy('date').reverse().limit(limit).toArray(),
    [limit],
  )

  if (!entries) return <p>Loading…</p>
  if (entries.length === 0) return <p className="empty-state">No sleep logged yet.</p>

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>Night of</th>
          <th>Duration</th>
          <th>WASO</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {entries.map((s) => (
          <tr key={s.id}>
            <td>{s.date}</td>
            <td>{formatDuration(s.durationMinutes)}</td>
            <td>{s.wasoMinutes} min</td>
            <td>
              <button className="btn-small btn-ghost" onClick={() => db.sleep.delete(s.id!)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
