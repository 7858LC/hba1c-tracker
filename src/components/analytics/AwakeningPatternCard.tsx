import { useMemo } from 'react'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { computeAwakeningAnalytics, MIN_AWAKENING_DAYS } from '../../lib/analyticsAwakening'
import { findRelevantWake, minutesAfterWaking } from '../../lib/elapsedTime'
import type { GlucoseReading, SleepEntry } from '../../types'

function interpretR(r: number | null, n: number): string {
  if (r == null || n < 3) return 'not enough paired readings yet'
  const abs = Math.abs(r)
  const strength = abs >= 0.5 ? 'moderate-to-strong' : abs >= 0.3 ? 'weak-to-moderate' : 'weak'
  const direction = r > 0 ? 'positive' : 'negative'
  return `${strength} ${direction} association (r = ${r.toFixed(2)}, n=${n})`
}

export function AwakeningPatternCard({
  readings,
  sleepEntries,
}: {
  readings: GlucoseReading[]
  sleepEntries: SleepEntry[]
}) {
  const a = computeAwakeningAnalytics(readings, sleepEntries)

  const scatterPoints = useMemo(() => {
    const points: { minutes: number; value: number }[] = []
    for (const r of readings) {
      const wake = findRelevantWake(r, sleepEntries)
      if (!wake) continue
      const m = minutesAfterWaking(r, wake)
      if (m != null && m >= 0 && m <= 180) points.push({ minutes: m, value: r.value })
    }
    return points
  }, [readings, sleepEntries])

  return (
    <div className="card">
      <h2>Awakening pattern</h2>
      <p className="hint">
        Not labeled as dawn phenomenon or any other condition — this characterizes awakening
        glucose behavior from your own data. "Immediately on waking," "30 minutes after," and "60
        minutes after" are treated as distinct observations, never collapsed into one "fasting"
        number.
      </p>

      {!a.eligible ? (
        <p className="empty-state">
          Insufficient data — need T0/T30/T60 readings (within a few minutes of each target) on
          at least {MIN_AWAKENING_DAYS} days with a known wake time. Have {a.daysWithTriple} so
          far. Use the Awakening Glucose Profile in Glucose Protocols to collect these.
        </p>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="stat-tile">
              <span className="stat-value">{a.t0Mean?.toFixed(0)}</span>
              <span className="stat-label">T0 mean (n={a.t0Count})</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{a.t30Mean?.toFixed(0)}</span>
              <span className="stat-label">T30 mean (n={a.t30Count})</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{a.t60Mean?.toFixed(0)}</span>
              <span className="stat-label">T60 mean (n={a.t60Count})</span>
            </div>
          </div>
          <p className="stat-caveat">
            Mean rise T0→T30: {a.meanRiseT0ToT30?.toFixed(1)} mg/dL. Mean rise T0→T60:{' '}
            {a.meanRiseT0ToT60?.toFixed(1)} mg/dL. Based on {a.daysWithTriple} days with all
            three observations.
          </p>
        </>
      )}

      {scatterPoints.length >= 3 && (
        <>
          <h3>Glucose vs. minutes after waking</h3>
          <ResponsiveContainer width="100%" height={180}>
            <ScatterChart margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--gridline)" />
              <XAxis
                type="number"
                dataKey="minutes"
                name="Minutes after waking"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                stroke="var(--axis)"
              />
              <YAxis
                type="number"
                dataKey="value"
                name="Glucose (mg/dL)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                stroke="var(--axis)"
                width={40}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Scatter data={scatterPoints} fill="var(--series-5)" />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="stat-caveat">{interpretR(a.minutesVsGlucoseR, a.minutesVsGlucoseN)}</p>
        </>
      )}
    </div>
  )
}
