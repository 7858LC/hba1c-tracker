import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { computeExerciseEffectAnalytics } from '../../lib/analyticsExercise'
import type { ExerciseEntry, GlucoseReading } from '../../types'

export function ExerciseEffectCard({
  readings,
  exerciseEntries,
}: {
  readings: GlucoseReading[]
  exerciseEntries: ExerciseEntry[]
}) {
  const buckets = useMemo(
    () => computeExerciseEffectAnalytics(readings, exerciseEntries),
    [readings, exerciseEntries],
  )
  const anyEligible = buckets.some((b) => b.eligible)
  const data = buckets.map((b) => ({
    label: b.label,
    mean: b.eligible ? Number(b.mean!.toFixed(1)) : null,
    readingCount: b.readingCount,
  }))

  return (
    <div className="card">
      <h2>Exercise effect</h2>
      <p className="hint">
        An association between glucose and time since your most recent exercise event — not a
        claim that exercise caused any particular reading.
      </p>
      {!anyEligible ? (
        <p className="empty-state">
          Not enough exercise-linked readings yet. Log exercise events and keep logging glucose
          to build this out.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} stroke="var(--axis)" interval={0} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" width={40} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, _n, p) => [`${v} mg/dL`, `n=${p.payload.readingCount}`]}
            />
            <Bar dataKey="mean" fill="var(--series-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
