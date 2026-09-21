import { computeDaysMaintained, SUSTAINED_BREAK_DAYS } from '../../lib/daysMaintained'
import type { GlucoseReading } from '../../types'

export function DaysMaintainedCard({
  readings,
  target,
}: {
  readings: GlucoseReading[]
  target: number
}) {
  const result = computeDaysMaintained(readings, target)

  return (
    <div className="card">
      <h2>Days maintained</h2>
      <div className="stat-tile">
        {result.daysMaintained != null ? (
          <>
            <span className="stat-value estimate">{result.daysMaintained}</span>
            <span className="stat-label">
              days with fasting glucose under {target} mg/dL, since {result.regimeStartDate}
            </span>
            {result.daysCurrentlyOver > 0 && (
              <span className="form-error">
                {result.daysCurrentlyOver} consecutive day{result.daysCurrentlyOver === 1 ? '' : 's'} over
                target — {SUSTAINED_BREAK_DAYS - result.daysCurrentlyOver} more resets this count.
              </span>
            )}
          </>
        ) : (
          <>
            <span className="stat-value estimate">—</span>
            <span className="stat-label">No fasting readings logged yet.</span>
          </>
        )}
        <span className="stat-caveat">
          Counts calendar days since the last {SUSTAINED_BREAK_DAYS}+ consecutive over-target
          fasting readings — a single bad day doesn't reset it, only a sustained break does.
          Durability, not a single low reading, is the goal.
        </span>
      </div>
    </div>
  )
}
