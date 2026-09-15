import { useState } from 'react'
import { db } from '../db/db'

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function SleepForm() {
  const [date, setDate] = useState(today())
  const [hours, setHours] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const numeric = Number(hours)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 24) {
      setError('Enter hours slept (0-24).')
      return
    }
    const now = Date.now()
    await db.sleep.add({ date, hours: numeric, createdAt: now, updatedAt: now })
    setHours('')
    setDate(today())
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label htmlFor="sleep-date">Date</label>
        <input
          id="sleep-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div className="field-row">
        <label htmlFor="sleep-hours">Hours slept</label>
        <input
          id="sleep-hours"
          type="number"
          step="0.25"
          inputMode="decimal"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="e.g. 7.5"
          required
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save sleep
      </button>
    </form>
  )
}
