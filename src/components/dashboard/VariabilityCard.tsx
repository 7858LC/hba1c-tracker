import { useMemo, useState } from 'react'
import { daysAgo } from '../../lib/dates'
import type { TargetContext } from '../../lib/glycemicTargets'
import { coefficientOfVariation, mean, standardDeviation } from '../../lib/stats'
import type { GlucoseReading } from '../../types'

const WINDOWS = [14, 30, 90] as const
const CV_TARGET = 36

const CONTEXT_GROUPS: { contexts: TargetContext[]; label: string }[] = [
  { contexts: ['fasting', 'pre_meal'], label: 'Fasting/pre-meal' },
  { contexts: ['post_meal_1h'], label: '1hr post-meal' },
  { contexts: ['post_meal_2h'], label: '2hr post-meal' },
]

export function VariabilityCard({ readings }: { readings: GlucoseReading[] }) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30)

  const { avg, sd, cv, n, perContext } = useMemo(() => {
    const since = daysAgo(windowDays)
    const inWindow = readings.filter((r) => r.timestamp >= since)
    const values = inWindow.map((r) => r.value)
    return {
      avg: mean(values),
      sd: standardDeviation(values),
      cv: coefficientOfVariation(values),
      n: values.length,
      perContext: CONTEXT_GROUPS.map((g) => {
        const groupValues = inWindow
          .filter((r) => g.contexts.includes(r.context as TargetContext))
          .map((r) => r.value)
        return { label: g.label, sd: standardDeviation(groupValues), n: groupValues.length }
      }),
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

      {n >= 2 && (
        <>
          <h3 style={{ marginTop: 12 }}>Where the variability comes from</h3>
          <div className="dashboard-grid">
            {perContext.map((g) => (
              <div className="stat-tile" key={g.label}>
                <span className="stat-value">{g.sd != null ? g.sd.toFixed(1) : '—'}</span>
                <span className="stat-label">{g.label} SD mg/dL</span>
                <span className="stat-caveat">n={g.n}</span>
              </div>
            ))}
          </div>
          <p className="stat-caveat">
            Pooling all contexts together (the SD/CV above) mixes true instability with the
            normal rise a meal is supposed to cause, which inflates the pooled number for reasons
            that have nothing to do with control. These per-context figures isolate where the
            spread is actually coming from — but they aren't benchmarked against the 36% CV
            target, which was validated against pooled/continuous CGM data, not a per-context
            split.
          </p>
        </>
      )}
    </div>
  )
}
