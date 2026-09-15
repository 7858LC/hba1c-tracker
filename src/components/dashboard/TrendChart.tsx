import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { rollingEA1CSeries } from '../../lib/ea1c'
import type { GlucoseReading } from '../../types'

const WINDOWS = [30, 60, 90] as const

export function TrendChart({
  readings,
  goal,
  labHbA1c,
}: {
  readings: GlucoseReading[]
  goal: number
  labHbA1c?: number
}) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30)

  const data = useMemo(
    () =>
      rollingEA1CSeries(readings, windowDays).map((p) => ({
        date: p.date,
        value: p.value != null ? Number(p.value.toFixed(2)) : null,
      })),
    [readings, windowDays],
  )

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Rolling eA1C trend</h2>
        <div className="window-tabs">
          {WINDOWS.map((w) => (
            <button
              key={w}
              className={`window-tab ${windowDays === w ? 'window-tab-active' : ''}`}
              onClick={() => setWindowDays(w)}
            >
              {w}d window
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <p className="empty-state">Not enough data yet to chart a trend.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              stroke="var(--axis)"
              minTickGap={30}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              stroke="var(--axis)"
              domain={['dataMin - 0.2', 'dataMax + 0.2']}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [`${v}%`, `eA1C (${windowDays}d)`]}
            />
            <ReferenceLine
              y={goal}
              stroke="var(--status-good)"
              strokeDasharray="4 4"
              label={{ value: `Goal ${goal}%`, position: 'insideTopRight', fill: 'var(--status-good)', fontSize: 11 }}
            />
            {labHbA1c != null && (
              <ReferenceLine
                y={labHbA1c}
                stroke="var(--series-2)"
                strokeDasharray="2 2"
                label={{ value: `Lab HbA1c ${labHbA1c}%`, position: 'insideBottomRight', fill: 'var(--series-2)', fontSize: 11 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="stat-caveat">
        Each point is a {windowDays}-day trailing eA1C estimate, not a daily lab value — HbA1c
        cannot be measured day to day.
      </p>
    </div>
  )
}
