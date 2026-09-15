import { useEffect, useState } from 'react'
import { db, saveSettings } from '../db/db'
import { exportAllDataAsJson, exportGlucoseReadingsAsCsv } from '../lib/exportAll'
import { useSettings } from '../hooks/data'

export function SettingsPage() {
  const settings = useSettings()
  const [targetLow, setTargetLow] = useState('')
  const [targetHigh, setTargetHigh] = useState('')
  const [goal, setGoal] = useState('')
  const [labHbA1c, setLabHbA1c] = useState('')
  const [labDate, setLabDate] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setTargetLow(String(settings.targetRangeLow))
      setTargetHigh(String(settings.targetRangeHigh))
      setGoal(String(settings.goalHbA1c))
      setLabHbA1c(settings.labHbA1c != null ? String(settings.labHbA1c) : '')
      setLabDate(settings.labHbA1cDate ?? '')
    }
  }, [settings?.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!settings?.id) return
    await saveSettings({
      id: settings.id,
      targetRangeLow: Number(targetLow),
      targetRangeHigh: Number(targetHigh),
      goalHbA1c: Number(goal),
      labHbA1c: labHbA1c ? Number(labHbA1c) : undefined,
      labHbA1cDate: labDate || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  async function handleWipe() {
    if (!confirm('Delete ALL locally stored data? This cannot be undone. Export first if you want a backup.')) {
      return
    }
    await Promise.all([
      db.readings.clear(),
      db.meals.clear(),
      db.fastingWindows.clear(),
      db.exercise.clear(),
      db.sleep.clear(),
      db.protocols.clear(),
      db.adherence.clear(),
    ])
  }

  if (!settings) return <p>Loading…</p>

  return (
    <div className="page">
      <section className="card">
        <h2>Targets</h2>
        <form className="entry-form" onSubmit={handleSave}>
          <div className="field-row">
            <label>Time-in-range: low (mg/dL)</label>
            <input type="number" value={targetLow} onChange={(e) => setTargetLow(e.target.value)} />
          </div>
          <div className="field-row">
            <label>Time-in-range: high (mg/dL)</label>
            <input type="number" value={targetHigh} onChange={(e) => setTargetHigh(e.target.value)} />
          </div>
          <div className="field-row">
            <label>Goal HbA1c (%)</label>
            <input type="number" step="0.1" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="field-row">
            <label>Most recent lab-drawn HbA1c (%, optional)</label>
            <input type="number" step="0.1" value={labHbA1c} onChange={(e) => setLabHbA1c(e.target.value)} />
          </div>
          <div className="field-row">
            <label>Lab HbA1c date (optional)</label>
            <input type="date" value={labDate} onChange={(e) => setLabDate(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">
            Save settings
          </button>
          {saved && <span className="save-toast">Saved</span>}
        </form>
      </section>

      <section className="card">
        <h2>Export your data</h2>
        <p className="hint">
          Everything is stored locally in this browser only — nothing is sent anywhere. Export
          regularly if you want a backup.
        </p>
        <div className="btn-row">
          <button className="btn-ghost" onClick={() => exportAllDataAsJson()}>
            Export all data (JSON)
          </button>
          <button className="btn-ghost" onClick={() => exportGlucoseReadingsAsCsv()}>
            Export glucose readings (CSV)
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Danger zone</h2>
        <button className="btn-ghost" style={{ color: 'var(--status-critical)' }} onClick={handleWipe}>
          Delete all local data
        </button>
      </section>
    </div>
  )
}
