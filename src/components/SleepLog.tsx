import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

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
          <th>Date</th>
          <th>Hours</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {entries.map((s) => (
          <tr key={s.id}>
            <td>{s.date}</td>
            <td>{s.hours}</td>
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
