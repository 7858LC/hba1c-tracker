import { useMemo } from 'react'
import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ResponsiveContainer } from 'recharts'
import { carbsVsNextDayGlucose, exerciseVsNextDayGlucose } from '../../lib/correlation'
import type { ExerciseEntry, GlucoseReading, MealEntry } from '../../types'

function interpretR(r: number | null): string {
  if (r == null) return 'not enough paired days yet'
  const abs = Math.abs(r)
  const strength = abs >= 0.5 ? 'moderate-to-strong' : abs >= 0.3 ? 'weak-to-moderate' : 'weak'
  const direction = r > 0 ? 'positive' : 'negative'
  return `${strength} ${direction} correlation (r = ${r.toFixed(2)})`
}

function MiniScatter({
  points,
  xLabel,
  yLabel,
  color,
}: {
  points: { x: number; y: number; date: string }[]
  xLabel: string
  yLabel: string
  color: string
}) {
  if (points.length === 0) return <p className="empty-state">Not enough paired days yet.</p>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ScatterChart margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          stroke="var(--axis)"
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          stroke="var(--axis)"
          width={40}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, name) => [value, name]}
        />
        <Scatter data={points} fill={color} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export function CorrelationView({
  meals,
  exercise,
  readings,
}: {
  meals: MealEntry[]
  exercise: ExerciseEntry[]
  readings: GlucoseReading[]
}) {
  const carbsCorr = useMemo(() => carbsVsNextDayGlucose(meals, readings), [meals, readings])
  const exerciseCorr = useMemo(
    () => exerciseVsNextDayGlucose(exercise, readings),
    [exercise, readings],
  )

  return (
    <div className="card">
      <h2>Diet/exercise vs next-day glucose</h2>
      <p className="hint">
        Plain paired-day correlation, not a model — every point below is a real day's data so
        you can audit it yourself.
      </p>

      <div className="dashboard-grid">
        <div>
          <h3>Carbs → next-day avg glucose</h3>
          <MiniScatter
            points={carbsCorr.points}
            xLabel={carbsCorr.xLabel}
            yLabel={carbsCorr.yLabel}
            color="var(--series-1)"
          />
          <p className="stat-caveat">
            n={carbsCorr.n} paired days — {interpretR(carbsCorr.r)}
          </p>
        </div>
        <div>
          <h3>Exercise → next-day avg glucose</h3>
          <MiniScatter
            points={exerciseCorr.points}
            xLabel={exerciseCorr.xLabel}
            yLabel={exerciseCorr.yLabel}
            color="var(--series-2)"
          />
          <p className="stat-caveat">
            n={exerciseCorr.n} paired days — {interpretR(exerciseCorr.r)}
          </p>
        </div>
      </div>
    </div>
  )
}
