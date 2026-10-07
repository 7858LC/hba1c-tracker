import { useState } from 'react'
import { db } from '../db/db'
import type { StressLevel } from '../types'

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Defaults the wake-time picker to the morning after `dateStr`, 06:30. */
function defaultWakeTimeFor(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T06:30`
}

export function SleepForm() {
  const [date, setDate] = useState(today())
  const [durationHours, setDurationHours] = useState('')
  const [durationMinutesPart, setDurationMinutesPart] = useState('')
  const [wasoMinutes, setWasoMinutes] = useState('')
  const [wakeTimeStr, setWakeTimeStr] = useState('')
  const [sleepQuality, setSleepQuality] = useState('')
  const [sleepScore, setSleepScore] = useState('')
  const [awakeningsCount, setAwakeningsCount] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const h = durationHours ? Number(durationHours) : 0
    const m = durationMinutesPart ? Number(durationMinutesPart) : 0
    const waso = wasoMinutes ? Number(wasoMinutes) : 0

    if (!Number.isFinite(h) || h < 0 || h > 24) {
      setError('Enter sleep duration hours (0-24).')
      return
    }
    if (!Number.isFinite(m) || m < 0 || m > 59) {
      setError('Enter sleep duration minutes (0-59).')
      return
    }
    const durationMinutes = h * 60 + m
    if (durationMinutes <= 0) {
      setError('Enter a total sleep duration.')
      return
    }
    if (!Number.isFinite(waso) || waso < 0 || waso > durationMinutes) {
      setError('Minutes awake during sleep must be 0 or more, and less than total duration.')
      return
    }

    const now = Date.now()
    await db.sleep.add({
      date,
      durationMinutes,
      wasoMinutes: waso,
      wakeTimestamp: wakeTimeStr ? new Date(wakeTimeStr).getTime() : undefined,
      sleepQuality: sleepQuality ? (Number(sleepQuality) as StressLevel) : undefined,
      sleepScore: sleepScore ? Number(sleepScore) : undefined,
      awakeningsCount: awakeningsCount ? Number(awakeningsCount) : undefined,
      createdAt: now,
      updatedAt: now,
    })
    setDurationHours('')
    setDurationMinutesPart('')
    setWasoMinutes('')
    setWakeTimeStr('')
    setSleepQuality('')
    setSleepScore('')
    setAwakeningsCount('')
    setDate(today())
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label htmlFor="sleep-date">Night of</label>
        <input
          id="sleep-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <span className="hint">
          The date you went to sleep — e.g. for the night of Sept 16 into Sept 17, enter Sept
          16. This is what pairs the entry with the next morning's fasting reading.
        </span>
      </div>

      <div className="field-row">
        <label id="sleep-duration-label">Total sleep duration</label>
        <div className="btn-row" aria-labelledby="sleep-duration-label">
          <input
            id="sleep-duration-hours"
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            placeholder="h"
            aria-label="Sleep duration hours"
            style={{ width: '5rem' }}
          />
          <span style={{ alignSelf: 'center' }}>h</span>
          <input
            id="sleep-duration-minutes"
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={durationMinutesPart}
            onChange={(e) => setDurationMinutesPart(e.target.value)}
            placeholder="m"
            aria-label="Sleep duration minutes"
            style={{ width: '5rem' }}
          />
          <span style={{ alignSelf: 'center' }}>m</span>
        </div>
      </div>

      <div className="field-row">
        <label htmlFor="sleep-waso">Minutes awake during sleep (WASO)</label>
        <input
          id="sleep-waso"
          type="number"
          inputMode="numeric"
          min={0}
          value={wasoMinutes}
          onChange={(e) => setWasoMinutes(e.target.value)}
          placeholder="e.g. 15"
        />
      </div>

      <div className="field-row">
        <label htmlFor="sleep-wake-time">Wake time (optional, but needed for waking-glucose analysis)</label>
        <input
          id="sleep-wake-time"
          type="datetime-local"
          value={wakeTimeStr}
          onChange={(e) => setWakeTimeStr(e.target.value)}
          onFocus={() => {
            if (!wakeTimeStr) setWakeTimeStr(defaultWakeTimeFor(date))
          }}
        />
        <span className="hint">
          The actual moment you woke up — this is what "minutes after waking" is calculated
          against for T0/T30/T60 readings. Without it, waking-relative analysis isn't possible
          for this night.
        </span>
      </div>

      <div className="field-row">
        <label htmlFor="sleep-quality">Sleep quality (1-5, optional)</label>
        <select id="sleep-quality" value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)}>
          <option value="">Not recorded</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <label htmlFor="sleep-score">Device/app sleep score (optional)</label>
        <input
          id="sleep-score"
          type="number"
          inputMode="numeric"
          value={sleepScore}
          onChange={(e) => setSleepScore(e.target.value)}
          placeholder="e.g. 82"
        />
      </div>

      <div className="field-row">
        <label htmlFor="sleep-awakenings">Awakenings count (optional)</label>
        <input
          id="sleep-awakenings"
          type="number"
          inputMode="numeric"
          min={0}
          value={awakeningsCount}
          onChange={(e) => setAwakeningsCount(e.target.value)}
        />
      </div>

      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save sleep
      </button>
    </form>
  )
}
