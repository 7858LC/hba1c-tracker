import { useState } from 'react'
import { ADAG_ERROR_MARGIN, calculateGatedEA1C } from '../../lib/ea1c'
import type { GlucoseReading } from '../../types'

const WINDOWS = [30, 60, 90] as const

function eligibilityReason(eligibility: {
  daysWithData: number
  requiredDays: number
  windowDays: number
  hasFastingReading: boolean
  hasMealRelativeReading: boolean
}): string {
  const missing: string[] = []
  if (eligibility.daysWithData < eligibility.requiredDays) {
    missing.push(
      `only ${eligibility.daysWithData} of the last ${eligibility.windowDays} days logged (need ${eligibility.requiredDays}+)`,
    )
  }
  if (!eligibility.hasFastingReading) missing.push('no fasting reading yet')
  if (!eligibility.hasMealRelativeReading) missing.push('no pre/post-meal reading yet')
  return missing.join('; ')
}

export function EA1CCard({ readings }: { readings: GlucoseReading[] }) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(90)
  const result = calculateGatedEA1C(readings, windowDays)

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
        ) : result.avgGlucose != null ? (
          <>
            <span className="stat-value" title="Plain average — not converted to an eA1C estimate.">
              {result.avgGlucose.toFixed(0)} mg/dL avg
            </span>
            <span className="stat-label">
              from {result.readingCount} readings over {result.daysWithData} of the last{' '}
              {windowDays} days
            </span>
            <span className="form-error">
              Insufficient data for reliable eA1C — showing raw glucose averages only (
              {eligibilityReason(result.eligibility)}).
            </span>
          </>
        ) : (
          <>
            <span className="stat-value estimate">—</span>
            <span className="stat-label">No readings logged yet.</span>
          </>
        )}
        <span className="stat-caveat">
          Estimated, not diagnostic. ADAG formula (avg glucose + 46.7) / 28.7, error margin ≈
          ±{ADAG_ERROR_MARGIN}%. Only a lab-drawn HbA1c is clinically definitive. eA1C only
          shown once the last {result.eligibility.windowDays} days have data on{' '}
          {result.eligibility.requiredDays}+ days, including both a fasting and a pre/post-meal
          reading.
        </span>
      </div>
    </div>
  )
}
