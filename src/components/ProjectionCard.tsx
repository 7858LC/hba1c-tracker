import { MIN_DAYS_FOR_PROJECTION, projectTargetDate } from '../lib/projection'
import type { GlucoseReading } from '../types'

export function ProjectionCard({
  readings,
  goal,
}: {
  readings: GlucoseReading[]
  goal: number
}) {
  const result = projectTargetDate(readings, goal)

  return (
    <div className="card">
      <h2>Target projection</h2>
      <p className="hint">
        A straight-line fit through your recent rolling eA1C, solved for when it crosses your
        goal — not a promise, just where the current trend points.
      </p>

      {result.status === 'insufficient_data' && (
        <>
          <span className="status-pill warning">Not enough data</span>
          <p style={{ marginTop: 8 }}>
            {result.daysOfData} day(s) of readings so far. Need at least{' '}
            {MIN_DAYS_FOR_PROJECTION} days of glucose data before a projection is reliable
            enough to show — a short line here would be false confidence.
          </p>
        </>
      )}

      {result.status === 'goal_met' && (
        <>
          <span className="status-pill good">Goal already met</span>
          <p style={{ marginTop: 8 }}>
            Your current eA1C estimate ({result.currentEA1C?.toFixed(2)}%) is already at or
            below your {goal}% goal. Keep logging to confirm this holds — one estimate isn't a
            trend.
          </p>
        </>
      )}

      {result.status === 'not_on_track' && (
        <>
          <span className="status-pill critical">Not on track</span>
          <p style={{ marginTop: 8 }}>
            Current eA1C ({result.currentEA1C?.toFixed(2)}%) trend over the last{' '}
            {result.daysOfData} days is flat or moving away from your {goal}% goal, so no
            target date is projected.
          </p>
        </>
      )}

      {result.status === 'projected' && (
        <>
          <span className="status-pill good">On track</span>
          <p style={{ marginTop: 8 }}>
            At the current trend ({result.slopePerDay!.toFixed(3)}%/day), your eA1C is
            projected to cross {goal}% around{' '}
            <strong>{result.projectedDate}</strong> (~{result.projectedDaysRemaining} days from
            now).
          </p>
          <p className="stat-caveat">
            Current eA1C: {result.currentEA1C?.toFixed(2)}% · fit quality r² ={' '}
            {result.r2?.toFixed(2)} · based on {result.daysOfData} days of readings. This is a
            projection from daily leading indicators, not a lab result or medical guidance.
          </p>
        </>
      )}
    </div>
  )
}
