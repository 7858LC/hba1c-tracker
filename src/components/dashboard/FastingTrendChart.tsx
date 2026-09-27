import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dailyFastingSeries } from '../../lib/daysMaintained'
import { FASTING_TARGET_HIGH, FASTING_TARGET_LOW } from '../../lib/glycemicTargets'
import { visibleSupplementMarkers } from '../../lib/supplementMarkers'
import type { GlucoseReading, SupplementChangeEntry } from '../../types'

const WINDOWS = [30, 60, 90] as const

export function FastingTrendChart({
  readings,
  target,
  supplementChanges = [],
}: {
  readings: GlucoseReading[]
  target: number
  supplementChanges?: SupplementChangeEntry[]
}) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30)

  const data = useMemo(
    () =>
      dailyFastingSeries(readings, windowDays).map((p) => ({
        date: p.date,
        value: Number(p.value.toFixed(0)),
      })),
    [readings, windowDays],
  )

  const markers = useMemo(
    () => visibleSupplementMarkers(supplementChanges, data.map((d) => d.date)),
    [supplementChanges, data],
  )

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Fasting glucose trend</h2>
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

      {data.length < 2 ? (
        <p className="empty-state">Not enough fasting readings yet to chart a trend.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
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
              domain={([dataMin, dataMax]: readonly [number, number]) => [
                Math.min(dataMin, FASTING_TARGET_LOW) - 5,
                Math.max(dataMax, FASTING_TARGET_HIGH) + 5,
              ]}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [`${v} mg/dL`, 'Fasting avg']}
            />
            <ReferenceArea
              y1={FASTING_TARGET_LOW}
              y2={FASTING_TARGET_HIGH}
              fill="var(--status-good)"
              fillOpacity={0.12}
              stroke="none"
            />
            <ReferenceLine
              y={target}
              stroke="var(--status-good)"
              strokeDasharray="4 4"
              label={{
                value: `Target ${target}`,
                position: 'insideTopRight',
                fill: 'var(--status-good)',
                fontSize: 11,
              }}
            />
            {markers.map((m, i) => (
              <ReferenceLine
                key={`${m.date}-${m.label}-${i}`}
                x={m.date}
                stroke="var(--series-3)"
                strokeDasharray="3 3"
                label={{ value: m.label, position: 'top', fill: 'var(--series-3)', fontSize: 10 }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--series-2)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="stat-caveat">
        Daily average of fasting-context readings only — a trend line, not a single number to
        chase. Shaded band is the optimal-metabolic-health fasting/pre-meal target ({FASTING_TARGET_LOW}
        -{FASTING_TARGET_HIGH} mg/dL), not the standard ADA diabetic-management range.
        {markers.length > 0 && ' Dashed vertical lines mark logged supplement changes.'}
      </p>
    </div>
  )
}
