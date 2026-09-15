import { useState } from 'react'
import { db } from '../db/db'

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function FastingWindowForm() {
  const [date, setDate] = useState(today())
  const [start, setStart] = useState('12:00')
  const [end, setEnd] = useState('20:00')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const eatingStart = new Date(`${date}T${start}`).getTime()
    const eatingEnd = new Date(`${date}T${end}`).getTime()
    if (eatingEnd <= eatingStart) {
      setError('Eating window end must be after start.')
      return
    }
    const now = Date.now()
    await db.fastingWindows.add({ date, eatingStart, eatingEnd, createdAt: now, updatedAt: now })
    setDate(today())
  }

  const windowHours = (new Date(`${date}T${end}`).getTime() - new Date(`${date}T${start}`).getTime()) / 3_600_000
  const fastingHours = 24 - windowHours

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label htmlFor="fasting-date">Date</label>
        <input
          id="fasting-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div className="field-row">
        <label htmlFor="fasting-start">Eating window start</label>
        <input
          id="fasting-start"
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
      </div>
      <div className="field-row">
        <label htmlFor="fasting-end">Eating window end</label>
        <input
          id="fasting-end"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          required
        />
      </div>
      <p className="hint">
        {Number.isFinite(fastingHours) && fastingHours > 0
          ? `≈ ${fastingHours.toFixed(1)}h fasting / ${windowHours.toFixed(1)}h eating window`
          : ''}
      </p>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save fasting window
      </button>
    </form>
  )
}
