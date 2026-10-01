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
import {
  POST_MEAL_1H_TARGET_HIGH,
  POST_MEAL_2H_TARGET_HIGH,
} from '../../lib/glycemicTargets'
import { dailyPostMealSeries } from '../../lib/postMealTrend'
import { visibleSupplementMarkers } from '../../lib/supplementMarkers'
import type { GlucoseReading, SupplementChangeEntry } from '../../types'

const WINDOWS = [30, 60, 90] as const

/**
 * Same chart prominence as FastingTrendChart (same card, same height) —
 * the postprandial-dominance evidence at this control level means these
 * two lines earn equal billing with the fasting trend, not a secondary
 * or smaller chart tucked below it.
 */
export function PostMealTrendChart({
  readings,
  supplementChanges = [],
}: {
  readings: GlucoseReading[]
  supplementChanges?: SupplementChangeEntry[]
}) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30)

  const data = useMemo(
    () =>
      dailyPostMealSeries(readings, windowDays).map((p) => ({
        date: p.date,
        value1h: p.value1h != null ? Number(p.value1h.toFixed(0)) : null,
        value2h: p.value2h != null ? Number(p.value2h.toFixed(0)) : null,
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
        <h2>Post-meal glucose trend</h2>
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

      <div className="tir-legend" style={{ marginBottom: 4 }}>
        <span>
          <span className="tir-legend-swatch" style={{ background: 'var(--series-4)' }} />
          1hr post-meal
        </span>
        <span>
          <span className="tir-legend-swatch" style={{ background: 'var(--series-5)' }} />
          2hr post-meal
        </span>
      </div>

      {data.length < 2 ? (
        <p className="empty-state">Not enough post-meal readings yet to chart a trend.</p>
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
                Math.min(dataMin, POST_MEAL_2H_TARGET_HIGH) - 5,
                Math.max(dataMax, POST_MEAL_1H_TARGET_HIGH) + 5,
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
              formatter={(v, name) => [
                `${v} mg/dL`,
                name === 'value1h' ? '1hr post-meal' : '2hr post-meal',
              ]}
            />
            <ReferenceLine
              y={POST_MEAL_1H_TARGET_HIGH}
              stroke="var(--series-4)"
              strokeDasharray="4 4"
              label={{
                value: `1hr target <${POST_MEAL_1H_TARGET_HIGH}`,
                position: 'insideTopRight',
                fill: 'var(--series-4)',
                fontSize: 11,
              }}
            />
            <ReferenceLine
              y={POST_MEAL_2H_TARGET_HIGH}
              stroke="var(--series-5)"
              strokeDasharray="4 4"
              label={{
                value: `2hr target <${POST_MEAL_2H_TARGET_HIGH}`,
                position: 'insideBottomRight',
                fill: 'var(--series-5)',
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
              dataKey="value1h"
              stroke="var(--series-4)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="value2h"
              stroke="var(--series-5)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="stat-caveat">
        Daily average of post-meal readings — published research (Monnier et al.) found
        postprandial glucose is the dominant contributor to HbA1c at good-to-moderate control,
        which is why this chart carries the same weight as the fasting trend above, not a smaller
        secondary view.
        {markers.length > 0 && ' Dashed vertical lines mark logged supplement changes.'}
      </p>
    </div>
  )
}
