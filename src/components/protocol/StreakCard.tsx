import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { computeDurability, DEGRADATION_ALERT_THRESHOLD } from '../../lib/durability'
import { computeStreak } from '../../lib/streaks'
import type { Protocol } from '../../types'

export function StreakCard({ protocol }: { protocol: Protocol }) {
  const adherence = useLiveQuery(
    () => db.adherence.where('protocolId').equals(protocol.id!).toArray(),
    [protocol.id],
  )

  if (!adherence) return null

  const { currentStreak, longestStreak, loggedToday } = computeStreak(adherence, protocol.id!)
  const durability = computeDurability(adherence, protocol)

  return (
    <div className="card">
      <h2>Consistency</h2>

      <div className="dashboard-grid">
        <div className="stat-tile">
          <span className="stat-label">Current streak (14-day)</span>
          <span className={`status-pill ${currentStreak > 0 ? 'good' : 'warning'}`}>
            {currentStreak} day{currentStreak === 1 ? '' : 's'}
          </span>
          {!loggedToday && (
            <span className="form-error">Nothing logged for today yet.</span>
          )}
          {longestStreak > currentStreak && (
            <span className="stat-caveat">Best streak so far: {longestStreak} days.</span>
          )}
        </div>

        <div className="stat-tile">
          <span className="stat-label">90-day consistency floor</span>
          {durability.ninetyDayFloor != null ? (
            <>
              <span className={`status-pill ${durability.ninetyDayFloor >= 50 ? 'good' : 'warning'}`}>
                {Math.round(durability.ninetyDayFloor)}%
              </span>
              <span className="stat-caveat">
                Lowest 14-day adherence average over the trailing {durability.floorWindowDays}{' '}
                days — the worst stretch, not the average. Current 14-day score:{' '}
                {Math.round(durability.rolling14Score)}%.
              </span>
            </>
          ) : (
            <span className="stat-caveat">
              Needs 14+ days of protocol history before a floor can be computed.
            </span>
          )}
        </div>
      </div>

      {durability.degradationAlert && (
        <p className="form-error">
          Adherence has dropped below {DEGRADATION_ALERT_THRESHOLD}% over the last 14 days — this is an early-warning
          signal for drift, worth a look before it becomes a longer slide.
        </p>
      )}

      {durability.burnoutRisk && (
        <p className="stat-caveat" style={{ marginTop: 8 }}>
          Sustained high intensity (90%+) for {durability.burnoutStreakDays}+ days —
          historically this preceded a drop-off. Not a problem by itself, but worth checking
          whether the current pace is actually sustainable.
        </p>
      )}
    </div>
  )
}
