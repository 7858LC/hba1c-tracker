import { useMemo, useState } from 'react'
import { daysAgo } from '../../lib/dates'
import { coefficientOfVariation, mean, standardDeviation } from '../../lib/stats'
import type { GlucoseReading } from '../../types'

const WINDOWS = [14, 30, 90] as const
const CV_TARGET = 36

export function VariabilityCard({ readings }: { readings: GlucoseReading[] }) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30)

  const { avg, sd, cv, n } = useMemo(() => {
    const since = daysAgo(windowDays)
    const values = readings.filter((r) => r.timestamp >= since).map((r) => r.value)
    return {
      avg: mean(values),
      sd: standardDeviation(values),
      cv: coefficientOfVariation(values),
      n: values.length,
    }
  }, [readings, windowDays])

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Glucose variability</h2>
        <div className="window-tabs">
          {WINDOWS.map((w) => (
            <button
              key={w}
              className={`window-tab ${windowDays === w ? 'window-tab-active' : ''}`}
              onClick={() => setWindowDays(w)}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {n < 2 ? (
        <p className="empty-state">Need at least 2 readings in this window.</p>
      ) : (
        <div className="dashboard-grid">
          <div className="stat-tile">
            <span className="stat-value">{avg?.toFixed(0)}</span>
            <span className="stat-label">avg mg/dL</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{sd?.toFixed(1)}</span>
            <span className="stat-label">SD mg/dL</span>
          </div>
          <div className="stat-tile">
            <span
              className="stat-value"
              style={{ color: cv != null && cv > CV_TARGET ? 'var(--status-serious)' : undefined }}
            >
              {cv?.toFixed(0)}%
            </span>
            <span className="stat-label">CV (target &lt;{CV_TARGET}%)</span>
          </div>
        </div>
      )}
      <p className="stat-caveat">Based on {n} readings in the selected window.</p>
    </div>
  )
}
