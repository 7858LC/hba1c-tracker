import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import type { GlucoseContext, HydrationStatus, StressLevel } from '../types'

const CONTEXT_OPTIONS: { value: GlucoseContext; label: string }[] = [
  { value: 'fasting', label: 'Fasting' },
  { value: 'pre_meal', label: 'Pre-meal' },
  { value: 'post_meal_1h', label: 'Post-meal (1h)' },
  { value: 'post_meal_2h', label: 'Post-meal (2h)' },
  { value: 'post_meal', label: 'Post-meal (timing unsure)' },
  { value: 'waking', label: 'Waking' },
  { value: 'bedtime', label: 'Bedtime' },
  { value: 'overnight', label: 'Overnight' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'random', label: 'Random' },
  { value: 'symptom_driven', label: 'Symptom-driven' },
]

const POST_MEAL_CONTEXTS: GlucoseContext[] = ['post_meal_1h', 'post_meal_2h', 'post_meal']

function toLocalDatetimeValue(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatMealLabel(m: { timestamp: number; mealType: string; description?: string; carbsGrams: number }): string {
  const when = new Date(m.timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const desc = m.description ? ` — ${m.description}` : ''
  return `${when} · ${m.mealType}${desc} (${m.carbsGrams}g carbs)`
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
  const [mealId, setMealId] = useState('')
  const [targetPostMealMinutes, setTargetPostMealMinutes] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const [caffeine, setCaffeine] = useState(false)
  const [alcohol, setAlcohol] = useState(false)
  const [stressLevel, setStressLevel] = useState('')
  const [illness, setIllness] = useState(false)
  const [medications, setMedications] = useState('')
  const [supplements, setSupplements] = useState('')
  const [hydration, setHydration] = useState<HydrationStatus | ''>('')
  const [symptoms, setSymptoms] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const recentMeals = useLiveQuery(
    () => db.meals.orderBy('timestamp').reverse().limit(15).toArray(),
    [],
  )

  const isPostMeal = POST_MEAL_CONTEXTS.includes(context)

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
      // Minutes EAST of UTC, captured once now — never recomputed later.
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      value: numeric,
      context,
      note: note || undefined,
      source: 'manual',
      deviceId: deviceId || undefined,
      mealId: mealId ? Number(mealId) : undefined,
      targetPostMealMinutes: targetPostMealMinutes ? Number(targetPostMealMinutes) : undefined,
      caffeineBeforeMeasurement: caffeine || undefined,
      alcoholPrevious24h: alcohol || undefined,
      stressLevel: stressLevel ? (Number(stressLevel) as StressLevel) : undefined,
      illnessFlag: illness || undefined,
      medicationsTaken: medications || undefined,
      supplementsTaken: supplements || undefined,
      hydrationStatus: hydration || undefined,
      symptoms: symptoms || undefined,
      createdAt: now,
      updatedAt: now,
    })
    setValue('')
    setNote('')
    setMealId('')
    setTargetPostMealMinutes('')
    setDeviceId('')
    setCaffeine(false)
    setAlcohol(false)
    setStressLevel('')
    setIllness(false)
    setMedications('')
    setSupplements('')
    setHydration('')
    setSymptoms('')
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
        <span className="hint">
          "Post-meal (timing unsure)" is fine when you're not sure which bucket this falls
          in — link the meal below and actual elapsed time is calculated for you.
        </span>
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

      {isPostMeal && (
        <>
          <div className="field-row">
            <label htmlFor="glucose-meal">Which meal? (optional, but recommended)</label>
            <select id="glucose-meal" value={mealId} onChange={(e) => setMealId(e.target.value)}>
              <option value="">Not linked</option>
              {recentMeals?.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatMealLabel(m)}
                </option>
              ))}
            </select>
            <span className="hint">
              Linking a meal lets the app calculate the ACTUAL elapsed time from that meal to
              this reading, instead of trusting the "1h"/"2h" label alone.
            </span>
          </div>
          <div className="field-row">
            <label htmlFor="glucose-target-minutes">Intended timing (minutes after the meal, optional)</label>
            <input
              id="glucose-target-minutes"
              type="number"
              inputMode="numeric"
              value={targetPostMealMinutes}
              onChange={(e) => setTargetPostMealMinutes(e.target.value)}
              placeholder="e.g. 60"
            />
          </div>
        </>
      )}

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

      <button type="button" className="btn-ghost btn-small" onClick={() => setShowMore((s) => !s)}>
        {showMore ? 'Hide more details' : 'More details (optional)'}
      </button>

      {showMore && (
        <div className="entry-form-nested">
          <div className="field-row">
            <label htmlFor="glucose-device">Device/app (optional)</label>
            <input
              id="glucose-device"
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. Contour Next"
            />
          </div>
          <div className="btn-row">
            <label>
              <input type="checkbox" checked={caffeine} onChange={(e) => setCaffeine(e.target.checked)} />{' '}
              Caffeine before this
            </label>
            <label>
              <input type="checkbox" checked={alcohol} onChange={(e) => setAlcohol(e.target.checked)} />{' '}
              Alcohol in last 24h
            </label>
            <label>
              <input type="checkbox" checked={illness} onChange={(e) => setIllness(e.target.checked)} />{' '}
              Feeling ill
            </label>
          </div>
          <div className="field-row">
            <label htmlFor="glucose-stress">Stress level (1-5, optional)</label>
            <select id="glucose-stress" value={stressLevel} onChange={(e) => setStressLevel(e.target.value)}>
              <option value="">Not recorded</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <label htmlFor="glucose-hydration">Hydration (optional)</label>
            <select
              id="glucose-hydration"
              value={hydration}
              onChange={(e) => setHydration(e.target.value as HydrationStatus | '')}
            >
              <option value="">Not recorded</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="field-row">
            <label htmlFor="glucose-meds">Medications taken (optional)</label>
            <input
              id="glucose-meds"
              type="text"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label htmlFor="glucose-supplements">Supplements taken (optional)</label>
            <input
              id="glucose-supplements"
              type="text"
              value={supplements}
              onChange={(e) => setSupplements(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label htmlFor="glucose-symptoms">Symptoms (optional)</label>
            <input
              id="glucose-symptoms"
              type="text"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. lightheaded, shaky"
            />
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="btn-primary">
        Save reading
      </button>
      {status === 'saved' && <span className="save-toast">Saved</span>}
    </form>
  )
}
