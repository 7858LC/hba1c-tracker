import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { DAY_MS } from '../lib/dates'
import { calculateGatedEA1C } from '../lib/ea1c'
import type { GlucoseReading } from '../types'

export function LabA1cLog({ readings }: { readings: GlucoseReading[] }) {
  const entries = useLiveQuery(() => db.labA1cEntries.orderBy('labDate').reverse().toArray(), [])

  if (!entries) return <p>Loading…</p>
  if (entries.length === 0) return <p className="empty-state">No lab A1c results logged yet.</p>

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>Lab date</th>
          <th>Lab A1c</th>
          <th>GMI (90d, ending that date)</th>
          <th>Difference</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const asOf = Date.parse(`${e.labDate}T23:59:59`)
          const gated = calculateGatedEA1C(readings, 90, asOf)
          const daysAgo = Math.max(0, Math.floor((Date.now() - asOf) / DAY_MS))
          return (
            <tr key={e.id}>
              <td>{e.labDate} ({daysAgo === 0 ? 'today' : `${daysAgo}d ago`})</td>
              <td>{e.a1cPercent.toFixed(1)}%</td>
              <td>
                {gated.value != null
                  ? `${gated.value.toFixed(2)}%`
                  : `insufficient data (${gated.readingCount} readings)`}
              </td>
              <td>
                {gated.value != null ? (
                  <span title="A difference here does not by itself prove altered red blood cell lifespan or any other condition — it may also reflect limited meter-reading density, timing, or normal estimate variance.">
                    {(e.a1cPercent - gated.value).toFixed(2)}%
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td>
                <button
                  className="btn-small btn-ghost"
                  onClick={() => db.labA1cEntries.delete(e.id!)}
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
