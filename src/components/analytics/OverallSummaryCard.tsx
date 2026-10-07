import { computeOverallAnalytics } from '../../lib/analyticsOverall'
import { ADAG_ERROR_MARGIN } from '../../lib/ea1c'
import type { GlucoseReading } from '../../types'

export function OverallSummaryCard({ readings }: { readings: GlucoseReading[] }) {
  const a = computeOverallAnalytics(readings)

  if (a.totalReadings === 0) {
    return (
      <div className="card">
        <h2>Current glucose status</h2>
        <p className="empty-state">No readings logged yet.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Current glucose status</h2>
      {!a.eligible && (
        <p className="form-error">
          Preliminary only — fewer than 10 readings total. Treat everything below as a rough
          sketch, not a stable pattern.
        </p>
      )}
      <div className="dashboard-grid">
        <div className="stat-tile">
          <span className="stat-value">{a.mean?.toFixed(0)}</span>
          <span className="stat-label">mean mg/dL</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{a.median?.toFixed(0)}</span>
          <span className="stat-label">median mg/dL</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">
            {a.range?.min}-{a.range?.max}
          </span>
          <span className="stat-label">range mg/dL</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{a.sd?.toFixed(1)}</span>
          <span className="stat-label">SD mg/dL</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{a.cv?.toFixed(0)}%</span>
          <span className="stat-label">CV</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value estimate" title={`GMI from mean glucose, ADAG formula, error margin ≈ ±${ADAG_ERROR_MARGIN}%`}>
            {a.gmi?.toFixed(2)}%
          </span>
          <span className="stat-label">GMI (meter-derived, not a lab A1c)</span>
        </div>
      </div>

      {a.distribution && (
        <>
          <h3>Distribution</h3>
          <div className="tir-legend">
            {a.distribution.map((d) => (
              <span key={d.label}>
                <strong>{d.label}:</strong> {d.pct.toFixed(0)}% ({d.count})
              </span>
            ))}
          </div>
        </>
      )}

      <p className="stat-caveat">
        {a.totalReadings} readings, {a.dateRangeStart} to {a.dateRangeEnd}. GMI is a meter-derived
        estimate from the mean of ALL readings in range — a different (unweighted-average)
        calculation from the dashboard's gated eA1C, and never a substitute for a lab-drawn A1c.
      </p>
    </div>
  )
}
