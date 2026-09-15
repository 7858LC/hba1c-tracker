import { db } from '../db/db'
import { downloadTextFile, readingsToCsv } from './csv'

export async function exportAllDataAsJson(): Promise<void> {
  const [readings, meals, fastingWindows, exercise, sleep, protocols, adherence, settings] =
    await Promise.all([
      db.readings.toArray(),
      db.meals.toArray(),
      db.fastingWindows.toArray(),
      db.exercise.toArray(),
      db.sleep.toArray(),
      db.protocols.toArray(),
      db.adherence.toArray(),
      db.settings.toArray(),
    ])
  const payload = {
    exportedAt: new Date().toISOString(),
    readings,
    meals,
    fastingWindows,
    exercise,
    sleep,
    protocols,
    adherence,
    settings,
  }
  downloadTextFile(
    `hba1c-tracker-export-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  )
}

export async function exportGlucoseReadingsAsCsv(): Promise<void> {
  const readings = await db.readings.orderBy('timestamp').toArray()
  downloadTextFile(
    `hba1c-tracker-glucose-${new Date().toISOString().slice(0, 10)}.csv`,
    readingsToCsv(readings),
    'text/csv',
  )
}
