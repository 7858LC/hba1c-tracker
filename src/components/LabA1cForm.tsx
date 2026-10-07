import { useState } from 'react'
import { db } from '../db/db'

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function LabA1cForm() {
  const [labDate, setLabDate] = useState(today())
  const [a1cPercent, setA1cPercent] = useState('')
  const [labFastingGlucose, setLabFastingGlucose] = useState('')
  const [labSource, setLabSource] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const a1c = Number(a1cPercent)
    if (!Number.isFinite(a1c) || a1c <= 0 || a1c > 20) {
      setError('Enter a valid A1c percentage.')
      return
    }
    const now = Date.now()
    await db.labA1cEntries.add({
      labDate,
      a1cPercent: a1c,
      labFastingGlucose: labFastingGlucose ? Number(labFastingGlucose) : undefined,
      labSource: labSource || undefined,
      notes: notes || undefined,
      createdAt: now,
      updatedAt: now,
    })
    setA1cPercent('')
    setLabFastingGlucose('')
    setLabSource('')
    setNotes('')
    setLabDate(today())
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label htmlFor="lab-date">Lab date</label>
        <input id="lab-date" type="date" value={labDate} onChange={(e) => setLabDate(e.target.value)} required />
      </div>
      <div className="field-row">
        <label htmlFor="lab-a1c">A1c (%)</label>
        <input
          id="lab-a1c"
          type="number"
          step="0.1"
          value={a1cPercent}
          onChange={(e) => setA1cPercent(e.target.value)}
          placeholder="e.g. 5.7"
          required
        />
      </div>
      <div className="field-row">
        <label htmlFor="lab-fasting">Lab fasting glucose (mg/dL, optional)</label>
        <input
          id="lab-fasting"
          type="number"
          value={labFastingGlucose}
          onChange={(e) => setLabFastingGlucose(e.target.value)}
        />
      </div>
      <div className="field-row">
        <label htmlFor="lab-source">Lab/source (optional)</label>
        <input
          id="lab-source"
          type="text"
          value={labSource}
          onChange={(e) => setLabSource(e.target.value)}
          placeholder="e.g. Quest Diagnostics"
        />
      </div>
      <div className="field-row">
        <label htmlFor="lab-notes">Notes (optional)</label>
        <input id="lab-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save lab result
      </button>
    </form>
  )
}
