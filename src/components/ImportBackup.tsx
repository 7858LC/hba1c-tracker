import { useState } from 'react'
import { parseBackupFile, restoreBackup, type BackupPayload, type RestoreCounts } from '../lib/importBackup'

type Stage = 'pick_file' | 'confirm' | 'done'

const LABELS: Record<keyof RestoreCounts, string> = {
  readings: 'glucose readings',
  meals: 'meals',
  fastingWindows: 'fasting windows',
  exercise: 'exercise entries',
  sleep: 'sleep entries',
  protocols: 'protocols',
  adherence: 'adherence entries',
  settings: 'settings records',
}

export function ImportBackup() {
  const [stage, setStage] = useState<Stage>('pick_file')
  const [payload, setPayload] = useState<BackupPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState<RestoreCounts | null>(null)

  async function handleFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      const parsed = parseBackupFile(text)
      setPayload(parsed)
      setStage('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  async function handleRestore() {
    if (!payload) return
    const result = await restoreBackup(payload)
    setCounts(result)
    setStage('done')
  }

  function reset() {
    setStage('pick_file')
    setPayload(null)
    setError(null)
    setCounts(null)
  }

  if (stage === 'pick_file') {
    return (
      <div className="csv-import">
        <p className="hint">
          Restores from a JSON file exported via "Export all data (JSON)" above. This{' '}
          <strong>replaces everything currently stored on this device</strong> — it's a
          restore, not a merge.
        </p>
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }

  if (stage === 'confirm' && payload) {
    return (
      <div className="csv-import">
        <p className="form-error">
          This will permanently delete everything currently stored on this device and
          replace it with this backup{payload.exportedAt ? ` (exported ${new Date(payload.exportedAt).toLocaleString()})` : ''}
          . This cannot be undone.
        </p>
        <ul>
          {(Object.keys(LABELS) as (keyof RestoreCounts)[]).map((key) => (
            <li key={key}>
              {payload[key].length} {LABELS[key]}
            </li>
          ))}
        </ul>
        <div className="btn-row">
          <button
            className="btn-ghost"
            style={{ color: 'var(--status-critical)' }}
            onClick={handleRestore}
          >
            Replace local data with this backup
          </button>
          <button className="btn-ghost" onClick={reset}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'done' && counts) {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    return (
      <div className="csv-import">
        <p>Restored {total} records. This device's data now matches the backup.</p>
        <button className="btn-primary" onClick={reset}>
          Import another file
        </button>
      </div>
    )
  }

  return null
}
