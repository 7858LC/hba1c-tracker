import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { computeStreak } from '../../lib/streaks'

export function StreakCard({ protocolId }: { protocolId: number }) {
  const adherence = useLiveQuery(
    () => db.adherence.where('protocolId').equals(protocolId).toArray(),
    [protocolId],
  )

  if (!adherence) return null

  const { currentStreak, longestStreak, loggedToday } = computeStreak(adherence, protocolId)

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Streak</h2>
        <span
          className={`status-pill ${currentStreak > 0 ? 'good' : 'warning'}`}
        >
          {currentStreak} day{currentStreak === 1 ? '' : 's'}
        </span>
      </div>
      {!loggedToday && (
        <p className="form-error">
          Nothing logged for today yet — check off today's adherence to keep the streak going.
        </p>
      )}
      {longestStreak > currentStreak && (
        <p className="stat-caveat">Best streak so far: {longestStreak} days.</p>
      )}
    </div>
  )
}
