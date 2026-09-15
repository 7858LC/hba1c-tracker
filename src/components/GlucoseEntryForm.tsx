import { useState } from 'react'
import { db } from '../db/db'
import type { GlucoseContext } from '../types'

const CONTEXT_OPTIONS: { value: GlucoseContext; label: string }[] = [
  { value: 'fasting', label: 'Fasting' },
  { value: 'pre_meal', label: 'Pre-meal' },
  { value: 'post_meal_1h', label: 'Post-meal (1h)' },
  { value: 'post_meal_2h', label: 'Post-meal (2h)' },
  { value: 'random', label: 'Random' },
]

function toLocalDatetimeValue(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  lastContext?: GlucoseContext
  lastValue?: number
}

export function GlucoseEntryForm({ lastContext, lastValue }: Props) {
  const [value, setValue] = useState('')
  const [context, setContext] = useState<GlucoseContext>(lastContext ?? 'fasting')
  const [timestampStr, setTimestampStr] = useState(() => toLocalDatetimeValue(Date.now()))
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 700) {
      setError('Enter a glucose value in mg/dL (1-700).')
      return
    }
    const timestamp = new Date(timestampStr).getTime()
    if (!Number.isFinite(timestamp)) {
      setError('Invalid date/time.')
      return
    }
    const now = Date.now()
    await db.readings.add({
      timestamp,
      value: numeric,
      context,
      note: note || undefined,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    })
    setValue('')
    setNote('')
    setTimestampStr(toLocalDatetimeValue(Date.now()))
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 1200)
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label htmlFor="glucose-value">Glucose (mg/dL)</label>
        <input
          id="glucose-value"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder={lastValue ? String(lastValue) : 'e.g. 108'}
          required
        />
        {lastValue != null && !value && (
          <button
            type="button"
            className="autofill-btn"
            onClick={() => setValue(String(lastValue))}
          >
            Use last: {lastValue}
          </button>
        )}
      </div>

      <div className="field-row">
        <label id="glucose-context-label">Context</label>
        <div className="chip-group" role="group" aria-labelledby="glucose-context-label">
          {CONTEXT_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={`chip ${context === opt.value ? 'chip-active' : ''}`}
              onClick={() => setContext(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <label htmlFor="glucose-time">When</label>
        <input
          id="glucose-time"
          type="datetime-local"
          value={timestampStr}
          onChange={(e) => setTimestampStr(e.target.value)}
          required
        />
      </div>

      <div className="field-row">
        <label htmlFor="glucose-note">Note (optional)</label>
        <input
          id="glucose-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="optional"
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="btn-primary">
        Save reading
      </button>
      {status === 'saved' && <span className="save-toast">Saved</span>}
    </form>
  )
}
