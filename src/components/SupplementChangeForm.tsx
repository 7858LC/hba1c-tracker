import { useState } from 'react'
import { db } from '../db/db'

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function SupplementChangeForm() {
  const [date, setDate] = useState(today())
  const [supplementName, setSupplementName] = useState('')
  const [priorState, setPriorState] = useState('')
  const [newState, setNewState] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!supplementName.trim()) {
      setError('Enter the supplement name.')
      return
    }
    if (!priorState.trim() || !newState.trim()) {
      setError('Enter both the prior state and the new state, e.g. "not taking" → "500mg 1x/day".')
      return
    }

    const now = Date.now()
    await db.supplementChanges.add({
      date,
      supplementName: supplementName.trim(),
      priorState: priorState.trim(),
      newState: newState.trim(),
      createdAt: now,
      updatedAt: now,
    })
    setSupplementName('')
    setPriorState('')
    setNewState('')
    setDate(today())
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label htmlFor="supp-date">Date of change</label>
        <input
          id="supp-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="field-row">
        <label htmlFor="supp-name">Supplement name</label>
        <input
          id="supp-name"
          type="text"
          value={supplementName}
          onChange={(e) => setSupplementName(e.target.value)}
          placeholder="e.g. Berberine"
        />
      </div>

      <div className="field-row">
        <label htmlFor="supp-prior">Prior state</label>
        <input
          id="supp-prior"
          type="text"
          value={priorState}
          onChange={(e) => setPriorState(e.target.value)}
          placeholder="e.g. not taking, or 500mg 1x/day"
        />
      </div>

      <div className="field-row">
        <label htmlFor="supp-new">New state</label>
        <input
          id="supp-new"
          type="text"
          value={newState}
          onChange={(e) => setNewState(e.target.value)}
          placeholder="e.g. 500mg 2x/day, or discontinued"
        />
        <span className="hint">
          Not a daily field — log this only when something actually changes. It shows up as a
          marker on the trend charts so a later shift in the data has a reason attached.
        </span>
      </div>

      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary">
        Save change
      </button>
    </form>
  )
}
