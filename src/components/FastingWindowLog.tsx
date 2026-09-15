import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function FastingWindowLog({ limit = 10 }: { limit?: number }) {
  const windows = useLiveQuery(
    () => db.fastingWindows.orderBy('date').reverse().limit(limit).toArray(),
    [limit],
  )

  if (!windows) return <p>Loading…</p>
  if (windows.length === 0) return <p className="empty-state">No fasting windows logged yet.</p>

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Fasting hours</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {windows.map((w) => {
          const fastingHours = 24 - (w.eatingEnd - w.eatingStart) / 3_600_000
          return (
            <tr key={w.id}>
              <td>{w.date}</td>
              <td>{fastingHours.toFixed(1)}h</td>
              <td>
                <button
                  className="btn-small btn-ghost"
                  onClick={() => db.fastingWindows.delete(w.id!)}
                >
                  Delete
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
