import { useState } from 'react'
import { useAllLabA1c } from '../hooks/data'
import { DAY_MS } from '../lib/dates'
import { computeLabForecast, FORECAST_RANGE, MIN_BASELINE_READINGS } from '../lib/labForecast'
import type { GlucoseReading } from '../types'

function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T12:00:00`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function LabForecastCard({ readings, goal }: { readings: GlucoseReading[]; goal: number }) {
  const labs = useAllLabA1c()
  const latestLab = labs.length > 0 ? labs[labs.length - 1] : undefined
  const [pickedDate, setPickedDate] = useState('')
  const labDate = pickedDate || (latestLab ? addDays(latestLab.labDate, 90) : '')

  const result = latestLab
    ? computeLabForecast(labs, readings, goal, Date.parse(`${labDate}T12:00:00`))
    : ({ status: 'no_lab' } as const)

  return (
    <div className="card">
      <h2>Next lab: scenarios</h2>
      <p className="hint">
        A scenario model, not a prediction. It starts from your latest real lab result and shifts
        it by how much your average glucose changes from your last 28 days, using the published
        GMI slope (0.02392 %/mg/dL). The averages are weighted by the clock time each reading
        context stands for, an assumption. The app's other &quot;GMI/eA1C&quot; numbers use the
        ADAG formula, which reads lower at normal glucose, so don't compare them directly.
      </p>

      {result.status === 'no_lab' && (
        <p className="empty-state">Log a lab A1c result to anchor the scenarios.</p>
      )}

      {result.status === 'insufficient_data' && (
        <>
          <span className="status-pill warning">Not enough data</span>
          <p style={{ marginTop: 8 }}>
            {result.readingsUsed} fasting / pre-meal / post-meal readings in the last 28 days. Need
            at least {MIN_BASELINE_READINGS}.
          </p>
        </>
      )}

      {result.status === 'ok' && (
        <>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Next lab date{' '}
            <input type="date" value={labDate} onChange={(e) => setPickedDate(e.target.value)} />
          </label>

          {result.shareAfter === 0 ? (
            <p className="stat-caveat">
              Pick a lab date after your latest reading; the window can't change before then.
            </p>
          ) : (
            <p>
              Latest lab {result.anchorPercent.toFixed(1)}% on {result.anchorDate}. Current
              weighted average {result.baselineMean.toFixed(1)} mg/dL from {result.readingsUsed}{' '}
              readings. About {Math.round(result.shareAfter * 100)}% of the next lab's window can
              still change.
            </p>
          )}

          <table className="log-table">
            <thead>
              <tr>
                <th>If your average glucose is…</th>
                <th>mg/dL</th>
                <th>Lab on {labDate}</th>
                <th>Held 90 days</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.meanGlucose.toFixed(1)}</td>
                  <td>
                    {row.labEstimate.toFixed(2)}% (±{FORECAST_RANGE})
                  </td>
                  <td>{row.heldNinetyDays.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="stat-caveat">
            To land on {goal}% over a full 90 days, your average would need to be about{' '}
            {result.meanNeededForGoal.toFixed(1)} mg/dL. The ± is a rough guess: GMI and lab HbA1c
            often differ by 0.5 or more in an individual, and a lab result itself varies by about
            0.1–0.2. Fingersticks are a weaker input than continuous monitoring. Not medical
            advice.
          </p>
        </>
      )}
    </div>
  )
}
