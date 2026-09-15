import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import type { GlucoseContext, GlucoseReading } from '../types'

const CONTEXT_LABELS: Record<GlucoseContext, string> = {
  fasting: 'Fasting',
  pre_meal: 'Pre-meal',
  post_meal_1h: 'Post-meal (1h)',
  post_meal_2h: 'Post-meal (2h)',
  random: 'Random',
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function EditableRow({ reading }: { reading: GlucoseReading }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(reading.value))
  const [context, setContext] = useState<GlucoseContext>(reading.context)

  async function save() {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return
    await db.readings.update(reading.id!, {
      value: numeric,
      context,
      updatedAt: Date.now(),
    })
    setEditing(false)
  }

  async function remove() {
    if (!confirm('Delete this reading? This cannot be undone.')) return
    await db.readings.delete(reading.id!)
  }

  if (editing) {
    return (
      <tr>
        <td>{formatWhen(reading.timestamp)}</td>
        <td>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ width: '4.5rem' }}
          />
        </td>
        <td>
          <select value={context} onChange={(e) => setContext(e.target.value as GlucoseContext)}>
            {Object.entries(CONTEXT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </td>
        <td>
          <button onClick={save} className="btn-small">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="btn-small btn-ghost">
            Cancel
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>{formatWhen(reading.timestamp)}</td>
      <td className={reading.value > 180 || reading.value < 70 ? 'value-flag' : ''}>
        {reading.value}
      </td>
      <td>{CONTEXT_LABELS[reading.context]}</td>
      <td>
        <button onClick={() => setEditing(true)} className="btn-small btn-ghost">
          Edit
        </button>
        <button onClick={remove} className="btn-small btn-ghost">
          Delete
        </button>
        {reading.source === 'csv_import' && <span className="badge">CSV</span>}
      </td>
    </tr>
  )
}

export function GlucoseLog({ limit = 25 }: { limit?: number }) {
  const readings = useLiveQuery(
    () => db.readings.orderBy('timestamp').reverse().limit(limit).toArray(),
    [limit],
  )

  if (!readings) return <p>Loading…</p>
  if (readings.length === 0) return <p className="empty-state">No readings logged yet.</p>

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>When</th>
          <th>mg/dL</th>
          <th>Context</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {readings.map((r) => (
          <EditableRow key={r.id} reading={r} />
        ))}
      </tbody>
    </table>
  )
}
