import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { summarizeMealResponse } from '../lib/protocolSummary'
import type { GlucoseReading } from '../types'

const ROLES: { role: string; label: string }[] = [
  { role: 'pre', label: 'Pre-meal (baseline)' },
  { role: '30min', label: '30 minutes' },
  { role: '60min', label: '60 minutes' },
  { role: '90min', label: '90 minutes' },
  { role: '120min', label: '120 minutes' },
]

function formatMealLabel(m: { timestamp: number; mealType: string; description?: string }): string {
  const when = new Date(m.timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${when} · ${m.mealType}${m.description ? ` — ${m.description}` : ''}`
}

function RoleLogger({
  role,
  label,
  runId,
  mealId,
  alreadyLogged,
}: {
  role: string
  label: string
  runId: number
  mealId: number
  alreadyLogged: number | null
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 700) {
      setError('Enter a glucose value in mg/dL.')
      return
    }
    const now = Date.now()
    await db.readings.add({
      timestamp: now,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      value: numeric,
      context: role === 'pre' ? 'pre_meal' : 'post_meal',
      source: 'manual',
      mealId,
      protocolRunId: runId,
      protocolRole: role,
      createdAt: now,
      updatedAt: now,
    })
    setValue('')
  }

  return (
    <div className="field-row">
      <label>{label}</label>
      {alreadyLogged != null ? (
        <span className="status-pill good">{alreadyLogged} mg/dL logged</span>
      ) : (
        <div className="btn-row">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="mg/dL"
            style={{ width: '6rem' }}
          />
          <button className="btn-primary btn-small" onClick={save}>
            Log now
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

export function MealResponseProtocolPage() {
  const activeRun = useLiveQuery(
    () => db.protocolRuns.filter((r) => r.type === 'meal_response' && r.active).first(),
    [],
  )
  const recentMeals = useLiveQuery(() => db.meals.orderBy('timestamp').reverse().limit(10).toArray(), [])
  const activeMeal = useLiveQuery(
    () => (activeRun?.mealId != null ? db.meals.get(activeRun.mealId) : undefined),
    [activeRun?.mealId],
  )
  const runReadings =
    useLiveQuery(
      () =>
        activeRun?.id != null
          ? db.readings.where('protocolRunId').equals(activeRun.id).toArray()
          : Promise.resolve<GlucoseReading[]>([]),
      [activeRun?.id],
    ) ?? []
  const [selectedMealId, setSelectedMealId] = useState('')

  async function startRun() {
    if (!selectedMealId) return
    const now = Date.now()
    await db.protocolRuns.add({
      type: 'meal_response',
      startDate: new Date().toISOString().slice(0, 10),
      mealId: Number(selectedMealId),
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    setSelectedMealId('')
  }

  async function endRun() {
    if (activeRun?.id == null) return
    if (!confirm('End this Meal Glucose Response run?')) return
    await db.protocolRuns.update(activeRun.id, { active: false, updatedAt: Date.now() })
  }

  const summary =
    activeRun?.id != null && activeMeal
      ? summarizeMealResponse(runReadings, activeRun.id, activeMeal)
      : null

  function loggedFor(role: string): number | null {
    return runReadings.find((r) => r.protocolRole === role)?.value ?? null
  }

  return (
    <div className="page">
      <section className="card">
        <h2>Meal Glucose Response</h2>
        <p className="hint">
          Pick a meal, then log pre-meal, 30, 60, 90, and 120-minute readings around it. Analysis
          uses the ACTUAL elapsed time from the meal to each reading, not the label — a "60
          minute" reading logged late is still correctly placed at its real elapsed time.
        </p>

        {!activeRun ? (
          <>
            <div className="field-row">
              <label htmlFor="meal-response-select">Meal</label>
              <select
                id="meal-response-select"
                value={selectedMealId}
                onChange={(e) => setSelectedMealId(e.target.value)}
              >
                <option value="">Select a recent meal…</option>
                {recentMeals?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatMealLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={startRun} disabled={!selectedMealId}>
              Start response tracking for this meal
            </button>
          </>
        ) : (
          <>
            {activeMeal && <p>Tracking: {formatMealLabel(activeMeal)}</p>}
            {ROLES.map((r) => (
              <RoleLogger
                key={r.role}
                role={r.role}
                label={r.label}
                runId={activeRun.id!}
                mealId={activeRun.mealId!}
                alreadyLogged={loggedFor(r.role)}
              />
            ))}
            <button className="btn-ghost" onClick={endRun} style={{ marginTop: 8 }}>
              End this run
            </button>
          </>
        )}
      </section>

      {summary && summary.points.length > 0 && (
        <section className="card">
          <h2>Response summary</h2>
          <p>
            Baseline: {summary.baseline ?? '—'} mg/dL · Peak: {summary.peak ?? '—'} mg/dL at{' '}
            {summary.timeToPeakMinutes ?? '—'} min (actual elapsed) · Excursion:{' '}
            {summary.peakExcursion ?? '—'} mg/dL
          </p>
          <table className="log-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Actual minutes since meal</th>
                <th>mg/dL</th>
              </tr>
            </thead>
            <tbody>
              {summary.points.map((p) => (
                <tr key={p.role}>
                  <td>{p.role}</td>
                  <td>{p.actualMinutes}</td>
                  <td>{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="stat-caveat">
            Observed data only — not a diagnosis of insulin resistance or anything else. Worth
            discussing patterns here with a clinician if they're a recurring concern.
          </p>
        </section>
      )}
    </div>
  )
}
