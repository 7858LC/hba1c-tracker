import { useState } from 'react'
import { db } from '../db/db'
import {
  buildReadingsFromRows,
  detectColumnMapping,
  parseCsvFile,
  type ColumnMapping,
  type ImportRowResult,
  type ParsedCsv,
} from '../lib/csv'

type Stage = 'pick_file' | 'map_columns' | 'done'

export function CsvImport() {
  const [stage, setStage] = useState<Stage>('pick_file')
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({})
  const [preview, setPreview] = useState<ImportRowResult[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      const result = parseCsvFile(text)
      if (result.rows.length === 0) {
        setError('No rows found in that file.')
        return
      }
      setParsed(result)
      setMapping(detectColumnMapping(result.headers))
      setStage('map_columns')
    } catch {
      setError('Could not read that file as CSV.')
    }
  }

  function updatePreview(nextMapping: Partial<ColumnMapping>) {
    if (!parsed || !nextMapping.dateColumn || !nextMapping.valueColumn) {
      setPreview([])
      return
    }
    const full: ColumnMapping = {
      dateColumn: nextMapping.dateColumn,
      timeColumn: nextMapping.timeColumn,
      valueColumn: nextMapping.valueColumn,
      contextColumn: nextMapping.contextColumn,
    }
    setPreview(buildReadingsFromRows(parsed.rows.slice(0, 5), full))
  }

  function onMappingChange(field: keyof ColumnMapping, value: string) {
    const next = { ...mapping, [field]: value || undefined }
    setMapping(next)
    updatePreview(next)
  }

  async function handleImport() {
    if (!parsed || !mapping.dateColumn || !mapping.valueColumn) return
    const full: ColumnMapping = {
      dateColumn: mapping.dateColumn,
      timeColumn: mapping.timeColumn,
      valueColumn: mapping.valueColumn,
      contextColumn: mapping.contextColumn,
    }
    const results = buildReadingsFromRows(parsed.rows, full)
    const valid = results.filter((r) => r.reading != null).map((r) => r.reading!)
    if (valid.length > 0) {
      await db.readings.bulkAdd(valid)
    }
    setImportedCount(valid.length)
    setStage('done')
  }

  function reset() {
    setStage('pick_file')
    setParsed(null)
    setMapping({})
    setPreview([])
    setError(null)
  }

  if (stage === 'pick_file') {
    return (
      <div className="csv-import">
        <p className="hint">
          Import a CSV exported from the Contour app or meter software. Export formats vary
          by device/app version, so you'll confirm which columns map to date, time, and
          glucose value before anything is imported.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }

  if (stage === 'map_columns' && parsed) {
    return (
      <div className="csv-import">
        <h4>Map columns</h4>
        <div className="field-row">
          <label>Date column</label>
          <select
            value={mapping.dateColumn ?? ''}
            onChange={(e) => onMappingChange('dateColumn', e.target.value)}
          >
            <option value="">Select…</option>
            {parsed.headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label>Time column (optional, if separate from date)</label>
          <select
            value={mapping.timeColumn ?? ''}
            onChange={(e) => onMappingChange('timeColumn', e.target.value)}
          >
            <option value="">None</option>
            {parsed.headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label>Glucose value column (mg/dL)</label>
          <select
            value={mapping.valueColumn ?? ''}
            onChange={(e) => onMappingChange('valueColumn', e.target.value)}
          >
            <option value="">Select…</option>
            {parsed.headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        {preview.length > 0 && (
          <div className="csv-preview">
            <h5>Preview (first {preview.length} rows)</h5>
            <table className="log-table">
              <thead>
                <tr>
                  <th>Parsed date/time</th>
                  <th>Parsed value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i}>
                    <td>{p.reading ? new Date(p.reading.timestamp).toLocaleString() : '—'}</td>
                    <td>{p.reading ? p.reading.value : '—'}</td>
                    <td>{p.reading ? 'OK' : p.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="btn-row">
          <button
            className="btn-primary"
            disabled={!mapping.dateColumn || !mapping.valueColumn}
            onClick={handleImport}
          >
            Import {parsed.rows.length} rows
          </button>
          <button className="btn-ghost" onClick={reset}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <div className="csv-import">
        <p>Imported {importedCount} readings.</p>
        <button className="btn-primary" onClick={reset}>
          Import another file
        </button>
      </div>
    )
  }

  return null
}
