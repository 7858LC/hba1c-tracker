import { useState } from 'react'
import { ADAG_ERROR_MARGIN, calculateRollingEA1C } from '../../lib/ea1c'
import type { GlucoseReading } from '../../types'

const WINDOWS = [30, 60, 90] as const

export function EA1CCard({ readings }: { readings: GlucoseReading[] }) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(90)
  const result = calculateRollingEA1C(readings, windowDays)

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Estimated A1C</h2>
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

      <div className="stat-tile">
        {result.value != null ? (
          <>
            <span
              className="stat-value estimate"
              title={`Estimated from ${result.readingCount} glucose readings over ${result.daysWithData} day(s). ADAG formula, known error margin ≈ ±${ADAG_ERROR_MARGIN}%. This is an estimate, not a diagnostic HbA1c.`}
            >
              {result.value.toFixed(1)}% eA1C ⓘ
            </span>
            <span className="stat-label">
              from {result.readingCount} readings over {result.daysWithData} of the last{' '}
              {windowDays} days
              {!result.isFullWindow ? ' — limited data, treat as a rough estimate' : ''}
            </span>
          </>
        ) : (
          <>
            <span className="stat-value estimate">—</span>
            <span className="stat-label">
              Need at least 5 readings in the last {windowDays} days to estimate.
            </span>
          </>
        )}
        <span className="stat-caveat">
          Estimated, not diagnostic. ADAG formula (avg glucose + 46.7) / 28.7, error margin ≈
          ±{ADAG_ERROR_MARGIN}%. Only a lab-drawn HbA1c is clinically definitive.
        </span>
      </div>
    </div>
  )
}
