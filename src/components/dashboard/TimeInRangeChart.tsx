import { useMemo, useState } from 'react'
import { daysAgo } from '../../lib/dates'
import { timeInTargetByContext } from '../../lib/glycemicTargets'
import type { GlucoseReading } from '../../types'

const WINDOWS = [14, 30, 90] as const

export function TimeInRangeChart({ readings }: { readings: GlucoseReading[] }) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30)

  const { groups, untargetedCount } = useMemo(() => {
    const since = daysAgo(windowDays)
    const inWindow = readings.filter((r) => r.timestamp >= since)
    return {
      groups: timeInTargetByContext(inWindow),
      untargetedCount: inWindow.filter((r) => r.context === 'random').length,
    }
  }, [readings, windowDays])

  const hasAnyReadings = groups.some((g) => g.readingCount > 0)

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Time in target</h2>
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

      {!hasAnyReadings ? (
        <p className="empty-state">No readings in this window yet.</p>
      ) : (
        <>
          {groups.map((g) =>
            g.readingCount === 0 ? null : (
              <div key={g.context} style={{ marginBottom: 14 }}>
                <div className="tir-bar">
                  {g.belowPct != null && (
                    <div
                      style={{ width: `${g.belowPct}%`, background: 'var(--status-critical)' }}
                      title={`Below ${g.band.low}: ${g.belowPct.toFixed(0)}%`}
                    />
                  )}
                  <div
                    style={{ width: `${g.inTargetPct}%`, background: 'var(--status-good)' }}
                    title={`In target: ${g.inTargetPct.toFixed(0)}%`}
                  />
                  <div
                    style={{ width: `${g.abovePct}%`, background: 'var(--status-serious)' }}
                    title={`Above ${g.band.high}: ${g.abovePct.toFixed(0)}%`}
                  />
                </div>
                <div className="tir-legend">
                  <span>
                    <strong>{g.label}</strong> — target{' '}
                    {g.band.low != null ? `${g.band.low}-${g.band.high}` : `<${g.band.high}`} mg/dL
                    {g.band.idealHigh != null && ` (ideal <${g.band.idealHigh})`}
                  </span>
                </div>
                <div className="tir-legend">
                  {g.belowPct != null && (
                    <span>
                      <span
                        className="tir-legend-swatch"
                        style={{ background: 'var(--status-critical)' }}
                      />
                      Below: {g.belowPct.toFixed(0)}%
                    </span>
                  )}
                  <span>
                    <span className="tir-legend-swatch" style={{ background: 'var(--status-good)' }} />
                    In target: {g.inTargetPct.toFixed(0)}%
                  </span>
                  <span>
                    <span
                      className="tir-legend-swatch"
                      style={{ background: 'var(--status-serious)' }}
                    />
                    Above: {g.abovePct.toFixed(0)}%
                  </span>
                </div>
                <p className="stat-caveat">
                  {g.readingCount} reading{g.readingCount === 1 ? '' : 's'}
                  {g.idealPct != null && ` · ${g.idealPct.toFixed(0)}% at the tighter ideal level`}
                </p>
              </div>
            ),
          )}
          <p className="stat-caveat">
            Optimal-metabolic-health targets, not standard ADA diabetic-management ranges — a
            prediabetic baseline is scored tighter than a diabetes treatment threshold would score
            it.
            {untargetedCount > 0 &&
              ` ${untargetedCount} reading${untargetedCount === 1 ? '' : 's'} tagged "random" aren't scored against a specific target.`}
          </p>
        </>
      )}
    </div>
  )
}
