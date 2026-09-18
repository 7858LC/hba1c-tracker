import { useState } from 'react'
import { db } from '../db/db'

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function SleepForm() {
  const [date, setDate] = useState(today())
  const [durationHours, setDurationHours] = useState('')
  const [durationMinutesPart, setDurationMinutesPart] = useState('')
  const [wasoMinutes, setWasoMinutes] = useState('')
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
    await db.sleep.add({ date, durationMinutes, wasoMinutes: waso, createdAt: now, updatedAt: now })
    setDurationHours('')
    setDurationMinutesPart('')
    setWasoMinutes('')
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

      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save sleep
      </button>
    </form>
  )
}
