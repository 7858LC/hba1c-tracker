import {
  computeFastingAnalytics,
  computePreMealAnalytics,
  MIN_FASTING_READINGS,
  MIN_PRE_MEAL_READINGS,
  type TrendResult,
} from '../../lib/analyticsFastingPreMeal'
import type { GlucoseReading, SleepEntry } from '../../types'

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function TrendLine({ trend }: { trend: TrendResult | null }) {
  if (!trend) return <span className="stat-caveat">Not enough points for a trend.</span>
  return (
    <span className="stat-caveat">
      Trend: {trend.direction} ({trend.slopePerDay >= 0 ? '+' : ''}
      {trend.slopePerDay.toFixed(2)} mg/dL/day, r²={trend.r2.toFixed(2)})
    </span>
  )
}

export function FastingPreMealCard({
  readings,
  sleepEntries,
}: {
  readings: GlucoseReading[]
  sleepEntries: SleepEntry[]
}) {
  const fasting = computeFastingAnalytics(readings, sleepEntries)
  const preMeal = computePreMealAnalytics(readings)

  return (
    <div className="card">
      <h2>Fasting pattern</h2>
      {fasting.readingCount === 0 ? (
        <p className="empty-state">No fasting readings yet.</p>
      ) : (
        <>
          {!fasting.eligible && (
            <p className="form-error">
              Fewer than {MIN_FASTING_READINGS} fasting readings ({fasting.readingCount}) —
              preliminary only.
            </p>
          )}
          <div className="dashboard-grid">
            <div className="stat-tile">
              <span className="stat-value">{fasting.mean?.toFixed(0)}</span>
              <span className="stat-label">mean mg/dL</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{fasting.median?.toFixed(0)}</span>
              <span className="stat-label">median mg/dL</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">
                {fasting.range?.min}-{fasting.range?.max}
              </span>
              <span className="stat-label">range mg/dL</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{fasting.sd?.toFixed(1)}</span>
              <span className="stat-label">SD mg/dL</span>
            </div>
          </div>
          <TrendLine trend={fasting.trend} />
          <div className="tir-legend" style={{ marginTop: 8 }}>
            <span>≥100: {fasting.pctAtOrAbove100?.toFixed(0)}%</span>
            <span>≥110: {fasting.pctAtOrAbove110?.toFixed(0)}%</span>
            <span>≥126: {fasting.pctAtOrAbove126?.toFixed(0)}%</span>
          </div>
          <p className="stat-caveat">
            {fasting.readingCount} fasting readings.
            {fasting.earliestOfDayCount > 0 &&
              ` Earliest-of-day mean: ${fasting.earliestOfDayMean?.toFixed(0)} mg/dL across ${fasting.earliestOfDayCount} days.`}
            {fasting.avgTimeOfDayMinutes != null &&
              ` Average time of day: ${formatMinutes(fasting.avgTimeOfDayMinutes)} after midnight.`}
            {fasting.minutesAfterWakingCount > 0 &&
              ` Average ${fasting.avgMinutesAfterWaking?.toFixed(0)} min after waking, based on ${fasting.minutesAfterWakingCount} readings with a known wake time.`}
          </p>
        </>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <h3>Pre-meal pattern</h3>
      {preMeal.readingCount === 0 ? (
        <p className="empty-state">No pre-meal readings yet.</p>
      ) : (
        <>
          {!preMeal.eligible && (
            <p className="form-error">
              Fewer than {MIN_PRE_MEAL_READINGS} pre-meal readings ({preMeal.readingCount}) —
              preliminary only.
            </p>
          )}
          <div className="dashboard-grid">
            <div className="stat-tile">
              <span className="stat-value">{preMeal.mean?.toFixed(0)}</span>
              <span className="stat-label">mean mg/dL</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{preMeal.median?.toFixed(0)}</span>
              <span className="stat-label">median mg/dL</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">
                {preMeal.range?.min}-{preMeal.range?.max}
              </span>
              <span className="stat-label">range mg/dL</span>
            </div>
          </div>
          <TrendLine trend={preMeal.trend} />
        </>
      )}
    </div>
  )
}
