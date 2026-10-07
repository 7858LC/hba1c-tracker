import { computePostMealAnalytics } from '../../lib/analyticsPostMeal'
import type { GlucoseReading, MealEntry } from '../../types'

const BUCKET_LABELS: Record<string, string> = {
  '0-90': 'Actual 0-90 min',
  '90-150': 'Actual 90-150 min',
  '150-180': 'Actual 150-180 min',
  '180+': 'Actual 180+ min',
}

export function MealResponseCard({ readings, meals }: { readings: GlucoseReading[]; meals: MealEntry[] }) {
  const result = computePostMealAnalytics(readings, meals)

  return (
    <div className="card">
      <h2>Meal response</h2>
      <p className="hint">
        Grouped by ACTUAL elapsed minutes from the linked meal, not the "1hr"/"2hr" label — a
        reading logged late is bucketed where it actually falls. Only readings explicitly linked
        to a meal are included; nothing here guesses which meal a reading belongs to.
      </p>
      <table className="log-table">
        <thead>
          <tr>
            <th>Window</th>
            <th>n</th>
            <th>Mean</th>
            <th>Median</th>
            <th>Range</th>
            <th>SD</th>
          </tr>
        </thead>
        <tbody>
          {result.buckets.map((b) => (
            <tr key={b.bucket}>
              <td>{BUCKET_LABELS[b.bucket]}</td>
              <td>{b.readingCount}</td>
              <td>{b.eligible ? b.mean?.toFixed(0) : '—'}</td>
              <td>{b.eligible ? b.median?.toFixed(0) : '—'}</td>
              <td>{b.eligible && b.range ? `${b.range.min}-${b.range.max}` : '—'}</td>
              <td>{b.eligible ? b.sd?.toFixed(1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="stat-caveat">
        {result.linkedReadingCount} meal-linked readings analyzed.
        {result.unlinkedPostMealCount > 0 &&
          ` ${result.unlinkedPostMealCount} post-meal readings have no linked meal and aren't included anywhere above — link a meal when logging to make them countable.`}
        {' '}Buckets with too few readings show "—" rather than a number built on a thin sample.
        See the Glucose Protocols tab for guided, per-meal response tracking.
      </p>
    </div>
  )
}
