import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  computeGlucoseBySleepDuration,
  computeGlucoseBySleepQuality,
  computeSleepDurationFastingCorrelation,
} from '../../lib/analyticsSleep'
import type { GlucoseReading, SleepEntry } from '../../types'

function interpretR(r: number | null, n: number): string {
  if (r == null || n < 3) return 'not enough paired nights yet'
  const abs = Math.abs(r)
  const strength = abs >= 0.5 ? 'moderate-to-strong' : abs >= 0.3 ? 'weak-to-moderate' : 'weak'
  const direction = r > 0 ? 'positive' : 'negative'
  return `${strength} ${direction} association (r = ${r.toFixed(2)}, n=${n})`
}

export function SleepRelationshipCard({
  readings,
  sleepEntries,
}: {
  readings: GlucoseReading[]
  sleepEntries: SleepEntry[]
}) {
  const duration = useMemo(() => computeGlucoseBySleepDuration(readings, sleepEntries), [readings, sleepEntries])
  const quality = useMemo(() => computeGlucoseBySleepQuality(readings, sleepEntries), [readings, sleepEntries])
  const correlation = useMemo(
    () => computeSleepDurationFastingCorrelation(sleepEntries, readings),
    [readings, sleepEntries],
  )

  const durationData = duration.map((b) => ({
    label: b.label,
    mean: b.eligible ? Number(b.mean!.toFixed(1)) : null,
    readingCount: b.readingCount,
  }))
  const anyDurationEligible = duration.some((b) => b.eligible)
  const anyQualityEligible = quality.some((b) => b.eligible)

  return (
    <div className="card">
      <h2>Sleep relationship</h2>
      <p className="hint">
        Next-morning fasting glucose grouped by the preceding night's sleep — specifically
        looking at whether sleep duration relates to next-morning fasting glucose.
      </p>

      {!anyDurationEligible ? (
        <p className="empty-state">Not enough paired nights yet by sleep duration.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={durationData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" width={40} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, _n, p) => [`${v} mg/dL fasting`, `n=${p.payload.readingCount}`]}
            />
            <Bar dataKey="mean" fill="var(--series-4)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="stat-caveat">Sleep duration vs. next-morning fasting: {interpretR(correlation.r, correlation.n)}</p>

      {anyQualityEligible && (
        <>
          <h3>By sleep quality</h3>
          <div className="tir-legend">
            {quality.filter((q) => q.eligible).map((q) => (
              <span key={q.label}>
                {q.label}: {q.mean?.toFixed(0)} mg/dL (n={q.readingCount})
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
