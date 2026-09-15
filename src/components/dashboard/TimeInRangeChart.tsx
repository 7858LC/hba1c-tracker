import { useMemo, useState } from 'react'
import { daysAgo } from '../../lib/dates'
import { timeInRange } from '../../lib/stats'
import type { GlucoseReading } from '../../types'

const WINDOWS = [14, 30, 90] as const

export function TimeInRangeChart({
  readings,
  low,
  high,
}: {
  readings: GlucoseReading[]
  low: number
  high: number
}) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30)

  const result = useMemo(() => {
    const since = daysAgo(windowDays)
    const values = readings.filter((r) => r.timestamp >= since).map((r) => r.value)
    return timeInRange(values, low, high)
  }, [readings, windowDays, low, high])

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Time in range</h2>
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

      {!result ? (
        <p className="empty-state">No readings in this window yet.</p>
      ) : (
        <>
          <div className="tir-bar">
            <div
              style={{
                width: `${result.belowRangePct}%`,
                background: 'var(--status-critical)',
              }}
              title={`Below ${low}: ${result.belowRangePct.toFixed(0)}%`}
            />
            <div
              style={{ width: `${result.inRangePct}%`, background: 'var(--status-good)' }}
              title={`In range: ${result.inRangePct.toFixed(0)}%`}
            />
            <div
              style={{
                width: `${result.aboveRangePct}%`,
                background: 'var(--status-serious)',
              }}
              title={`Above ${high}: ${result.aboveRangePct.toFixed(0)}%`}
            />
          </div>
          <div className="tir-legend">
            <span>
              <span className="tir-legend-swatch" style={{ background: 'var(--status-critical)' }} />
              Below {low}: {result.belowRangePct.toFixed(0)}%
            </span>
            <span>
              <span className="tir-legend-swatch" style={{ background: 'var(--status-good)' }} />
              In range {low}-{high}: {result.inRangePct.toFixed(0)}%
            </span>
            <span>
              <span className="tir-legend-swatch" style={{ background: 'var(--status-serious)' }} />
              Above {high}: {result.aboveRangePct.toFixed(0)}%
            </span>
          </div>
          <p className="stat-caveat">Based on {result.readingCount} readings.</p>
        </>
      )}
    </div>
  )
}
