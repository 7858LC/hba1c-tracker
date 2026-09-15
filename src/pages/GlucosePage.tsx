import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CsvImport } from '../components/CsvImport'
import { GlucoseEntryForm } from '../components/GlucoseEntryForm'
import { GlucoseLog } from '../components/GlucoseLog'
import { db } from '../db/db'

export function GlucosePage() {
  const [showImport, setShowImport] = useState(false)
  const lastReading = useLiveQuery(() => db.readings.orderBy('timestamp').last())

  return (
    <div className="page">
      <section className="card">
        <h2>Log a reading</h2>
        <GlucoseEntryForm lastContext={lastReading?.context} lastValue={lastReading?.value} />
      </section>

      <section className="card">
        <div className="card-header-row">
          <h2>Recent readings</h2>
          <button className="btn-ghost" onClick={() => setShowImport((s) => !s)}>
            {showImport ? 'Hide CSV import' : 'Import from Contour CSV'}
          </button>
        </div>
        {showImport && <CsvImport />}
        <GlucoseLog />
      </section>
    </div>
  )
}
