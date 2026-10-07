import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { toDateKey } from '../lib/dates'
import { summarizeAwakeningRun } from '../lib/protocolSummary'
import type { GlucoseReading } from '../types'

const TARGET_RUN_DAYS = 14

function today(): string {
  return toDateKey(Date.now())
}

function dayNumber(startDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00`)
  return Math.floor((Date.now() - start) / (24 * 3600_000)) + 1
}

function RoleLogger({
  role,
  label,
  runId,
  alreadyLogged,
}: {
  role: 'T0' | 'T30' | 'T60'
  label: string
  runId: number
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
      context: 'waking',
      source: 'manual',
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
            Log {label} now
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

export function AwakeningProtocolPage() {
  const activeRun = useLiveQuery(
    () => db.protocolRuns.filter((r) => r.type === 'awakening' && r.active).first(),
    [],
  )
  const runReadings = useLiveQuery(
    () =>
      activeRun?.id != null
        ? db.readings.where('protocolRunId').equals(activeRun.id).toArray()
        : Promise.resolve<GlucoseReading[]>([]),
    [activeRun?.id],
  ) ?? []

  async function startRun() {
    const now = Date.now()
    await db.protocolRuns.add({
      type: 'awakening',
      startDate: today(),
      active: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  async function endRun() {
    if (activeRun?.id == null) return
    if (!confirm('End this Awakening Glucose Profile run? You can start a new one anytime.')) return
    await db.protocolRuns.update(activeRun.id, { active: false, updatedAt: Date.now() })
  }

  const summary = activeRun?.id != null ? summarizeAwakeningRun(runReadings, activeRun.id) : []
  const todayKey = today()
  const todayRow = summary.find((s) => s.date === todayKey)

  return (
    <div className="page">
      <section className="card">
        <h2>Awakening Glucose Profile</h2>
        <p className="hint">
          For 10-14 days, log glucose immediately upon waking (T0), 30 minutes after (T30), and
          60 minutes after (T60) — no food, exercise, caffeine, or supplements between
          measurements. This characterizes your awakening glucose pattern; it does not diagnose
          dawn phenomenon or anything else.
        </p>

        {!activeRun ? (
          <button className="btn-primary" onClick={startRun}>
            Start a {TARGET_RUN_DAYS}-day run
          </button>
        ) : (
          <>
            <p>
              <strong>
                Day {dayNumber(activeRun.startDate)} of ~{TARGET_RUN_DAYS}
              </strong>{' '}
              (started {activeRun.startDate})
            </p>
            <RoleLogger role="T0" label="T0 (immediately on waking)" runId={activeRun.id!} alreadyLogged={todayRow?.t0 ?? null} />
            <RoleLogger role="T30" label="T30 (30 min after waking)" runId={activeRun.id!} alreadyLogged={todayRow?.t30 ?? null} />
            <RoleLogger role="T60" label="T60 (60 min after waking)" runId={activeRun.id!} alreadyLogged={todayRow?.t60 ?? null} />
            <button className="btn-ghost" onClick={endRun} style={{ marginTop: 8 }}>
              End this run
            </button>
          </>
        )}
      </section>

      {summary.length > 0 && (
        <section className="card">
          <h2>Run data</h2>
          <table className="log-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>T0</th>
                <th>T30</th>
                <th>T60</th>
                <th>Rise T0→T30</th>
                <th>Rise T0→T60</th>
                <th>% rise</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.date}>
                  <td>{s.date}</td>
                  <td>{s.t0 ?? '—'}</td>
                  <td>{s.t30 ?? '—'}</td>
                  <td>{s.t60 ?? '—'}</td>
                  <td>{s.riseT0ToT30 ?? '—'}</td>
                  <td>{s.riseT0ToT60 ?? '—'}</td>
                  <td>{s.pctRiseT0ToT60 != null ? `${s.pctRiseT0ToT60.toFixed(0)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="stat-caveat">
            Observed data only. Whether a pattern here is worth discussing with a clinician is a
            judgment call for you and them, not something this app determines.
          </p>
        </section>
      )}
    </div>
  )
}
