import { computeOverallAnalytics } from '../../lib/analyticsOverall'
import { ADAG_ERROR_MARGIN } from '../../lib/ea1c'
import { GMI_INTERCEPT, GMI_SLOPE } from '../../lib/gmi'
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
          <span className="stat-value estimate" title={`eA1C from mean glucose, ADAG formula, error margin ≈ ±${ADAG_ERROR_MARGIN}%`}>
            {a.ea1c?.toFixed(2)}%
          </span>
          <span className="stat-label">eA1C (ADAG, meter-derived, not a lab A1c)</span>
        </div>
        <div className="stat-tile">
          <span
            className="stat-value estimate"
            title={`GMI from mean glucose: ${GMI_INTERCEPT} + ${GMI_SLOPE} × mean. A different published formula from ADAG; it reads higher at normal-range glucose. It was built from continuous monitoring, and in an individual it often differs from a lab HbA1c by 0.5 or more.`}
          >
            {a.gmi?.toFixed(2)}%
          </span>
          <span className="stat-label">GMI (published formula, meter-derived, not a lab A1c)</span>
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
        {a.totalReadings} readings, {a.dateRangeStart} to {a.dateRangeEnd}. The eA1C (ADAG) and GMI
        tiles come from the same unweighted mean of ALL readings in range, run through two
        different published formulas, so they differ by about half a point at normal-range
        glucose. Both are meter-derived estimates, distinct from the dashboard's gated eA1C, and
        neither is a substitute for a lab-drawn A1c; compare them against your lab results
        below.
      </p>
    </div>
  )
}
