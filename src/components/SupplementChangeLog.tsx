import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function SupplementChangeLog({ limit = 20 }: { limit?: number }) {
  const entries = useLiveQuery(
    () => db.supplementChanges.orderBy('date').reverse().limit(limit).toArray(),
    [limit],
  )

  if (!entries) return <p>Loading…</p>
  if (entries.length === 0) return <p className="empty-state">No supplement changes logged yet.</p>

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Supplement</th>
          <th>Change</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {entries.map((s) => (
          <tr key={s.id}>
            <td>{s.date}</td>
            <td>{s.supplementName}</td>
            <td>
              {s.priorState} → {s.newState}
            </td>
            <td>
              <button
                className="btn-small btn-ghost"
                onClick={() => db.supplementChanges.delete(s.id!)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
