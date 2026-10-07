import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { detectPotentialDuplicates, type DuplicateCandidate } from '../lib/duplicates'
import { actualMinutesSinceMeal, findRelevantWake, minutesAfterWaking, postMealBucket } from '../lib/elapsedTime'
import { evaluateReading, hasExplicitTarget } from '../lib/glycemicTargets'
import type { GlucoseContext, GlucoseReading, MealEntry, SleepEntry } from '../types'

function isOutOfTarget(reading: GlucoseReading): boolean {
  return hasExplicitTarget(reading.context) && !evaluateReading(reading.value, reading.context).inTarget
}

const CONTEXT_LABELS: Record<GlucoseContext, string> = {
  fasting: 'Fasting',
  pre_meal: 'Pre-meal',
  post_meal_1h: 'Post-meal (1h)',
  post_meal_2h: 'Post-meal (2h)',
  post_meal: 'Post-meal',
  waking: 'Waking',
  bedtime: 'Bedtime',
  overnight: 'Overnight',
  exercise: 'Exercise',
  symptom_driven: 'Symptom-driven',
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

/**
 * The actual-elapsed-time badge — computed from real timestamps, never
 * from the reading's context label. Shows nothing when neither a linked
 * meal nor a relevant wake time can be found, rather than guessing.
 */
function ElapsedBadge({
  reading,
  meals,
  sleepEntries,
}: {
  reading: GlucoseReading
  meals: MealEntry[]
  sleepEntries: SleepEntry[]
}) {
  if (reading.mealId != null) {
    const meal = meals.find((m) => m.id === reading.mealId)
    if (meal) {
      const actual = actualMinutesSinceMeal(reading, meal)
      const bucket = postMealBucket(actual)
      const mismatch =
        reading.targetPostMealMinutes != null && Math.abs(actual - reading.targetPostMealMinutes) > 20
      return (
        <span className="stat-caveat" title={bucket ? `bucket: ${bucket}` : 'before the linked meal'}>
          {actual}min after meal
          {mismatch && ' ⚠'}
        </span>
      )
    }
  }
  const wake = findRelevantWake(reading, sleepEntries)
  if (wake) {
    const m = minutesAfterWaking(reading, wake)
    if (m != null) return <span className="stat-caveat">{m}min after waking</span>
  }
  return null
}

function EditableRow({
  reading,
  meals,
  sleepEntries,
}: {
  reading: GlucoseReading
  meals: MealEntry[]
  sleepEntries: SleepEntry[]
}) {
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
        <td></td>
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
      <td className={isOutOfTarget(reading) ? 'value-flag' : ''}>{reading.value}</td>
      <td>{CONTEXT_LABELS[reading.context]}</td>
      <td>
        <ElapsedBadge reading={reading} meals={meals} sleepEntries={sleepEntries} />
      </td>
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

function DuplicatePanel({ candidates }: { candidates: DuplicateCandidate[] }) {
  async function markNotDuplicate(c: DuplicateCandidate) {
    const now = Date.now()
    await db.duplicateReviews.add({
      pairKey: c.pairKey,
      readingIdA: c.a.id!,
      readingIdB: c.b.id!,
      notDuplicate: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  async function deleteOne(reading: GlucoseReading) {
    if (!confirm('Delete this reading as a duplicate? This cannot be undone.')) return
    await db.readings.delete(reading.id!)
  }

  if (candidates.length === 0) return null

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>Potential duplicate readings</h3>
      <p className="hint">
        These pairs are within 2 minutes of each other with the same value and context. Nothing
        is merged or deleted automatically — confirm whether each pair is a real duplicate.
      </p>
      {candidates.map((c) => (
        <div key={c.pairKey} className="field-row" style={{ marginBottom: 8 }}>
          <span>
            {formatWhen(c.a.timestamp)} and {formatWhen(c.b.timestamp)} — {c.a.value} mg/dL,{' '}
            {CONTEXT_LABELS[c.a.context]}
          </span>
          <div className="btn-row">
            <button className="btn-small btn-ghost" onClick={() => markNotDuplicate(c)}>
              Not a duplicate
            </button>
            <button className="btn-small btn-ghost" onClick={() => deleteOne(c.b)}>
              Delete the later one
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function GlucoseLog({ limit = 25 }: { limit?: number }) {
  const readings = useLiveQuery(
    () => db.readings.orderBy('timestamp').reverse().limit(limit).toArray(),
    [limit],
  )
  const meals = useLiveQuery(() => db.meals.toArray(), []) ?? []
  const sleepEntries = useLiveQuery(() => db.sleep.toArray(), []) ?? []
  const duplicateReviews = useLiveQuery(() => db.duplicateReviews.toArray(), []) ?? []

  if (!readings) return <p>Loading…</p>
  if (readings.length === 0) return <p className="empty-state">No readings logged yet.</p>

  const duplicateCandidates = detectPotentialDuplicates(readings, duplicateReviews)

  return (
    <>
      <table className="log-table">
        <thead>
          <tr>
            <th>When</th>
            <th>mg/dL</th>
            <th>Context</th>
            <th>Elapsed</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r) => (
            <EditableRow key={r.id} reading={r} meals={meals} sleepEntries={sleepEntries} />
          ))}
        </tbody>
      </table>
      <DuplicatePanel candidates={duplicateCandidates} />
    </>
  )
}
