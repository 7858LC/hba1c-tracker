import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  computeDayOfWeekAnalytics,
  computeTimeOfDayAnalytics,
} from '../../lib/analyticsTimePatterns'
import type { GlucoseReading } from '../../types'

export function TimePatternsCard({ readings }: { readings: GlucoseReading[] }) {
  const bands = useMemo(() => computeTimeOfDayAnalytics(readings), [readings])
  const days = useMemo(() => computeDayOfWeekAnalytics(readings), [readings])

  const bandData = bands.map((b) => ({
    label: b.label,
    mean: b.eligible ? Number(b.mean!.toFixed(1)) : null,
    readingCount: b.readingCount,
  }))
  const dayData = days.map((d) => ({
    label: d.day.slice(0, 3),
    mean: d.eligible ? Number(d.mean!.toFixed(1)) : null,
    readingCount: d.readingCount,
  }))

  const anyBandEligible = bands.some((b) => b.eligible)
  const anyDayEligible = days.some((d) => d.eligible)

  return (
    <div className="card">
      <h2>Time-of-day pattern</h2>

      {!anyBandEligible ? (
        <p className="empty-state">Not enough readings per time band yet to chart this.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bandData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} stroke="var(--axis)" />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" width={40} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, _n, p) => [`${v} mg/dL`, `n=${p.payload.readingCount}`]}
            />
            <Bar dataKey="mean" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="stat-caveat">
        Bands below {5} readings are omitted from the chart rather than shown with a thin
        average.
      </p>

      <h3>Day-of-week pattern</h3>
      {!anyDayEligible ? (
        <p className="empty-state">Not enough readings per weekday yet to chart this.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dayData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" width={40} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, _n, p) => [`${v} mg/dL`, `n=${p.payload.readingCount}`]}
            />
            <Bar dataKey="mean" fill="var(--series-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
