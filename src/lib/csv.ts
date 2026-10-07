import Papa from 'papaparse'
import type { GlucoseContext, GlucoseReading } from '../types'

// Contour meters/apps (Contour Diabetes App, Contour7, Contour Next USB
// utilities) do not publish a single stable CSV schema — column names and
// layout vary by device, app version, and region. Rather than hard-code a
// guessed format, this module auto-detects likely columns by keyword and
// lets the user confirm/override the mapping before anything is imported.

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsvFile(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  }
}

export interface ColumnMapping {
  /** column holding a full timestamp, or just the date if timeColumn is set */
  dateColumn: string
  /** optional separate time-of-day column, combined with dateColumn */
  timeColumn?: string
  valueColumn: string
  contextColumn?: string
}

const DATE_KEYWORDS = ['date', 'timestamp', 'datetime', 'date/time']
const TIME_KEYWORDS = ['time']
const VALUE_KEYWORDS = ['glucose', 'reading', 'result', 'mg/dl', 'mmol/l', 'value', 'bg']
const CONTEXT_KEYWORDS = ['tag', 'context', 'event', 'marker', 'note']

function findColumn(headers: string[], keywords: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase())
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw))
    if (idx >= 0) return headers[idx]
  }
  return undefined
}

export function detectColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const dateColumn = findColumn(headers, DATE_KEYWORDS)
  const remaining = headers.filter((h) => h !== dateColumn)
  const timeColumn = findColumn(remaining, TIME_KEYWORDS)
  const valueColumn = findColumn(headers, VALUE_KEYWORDS)
  const contextColumn = findColumn(headers, CONTEXT_KEYWORDS)
  return { dateColumn, timeColumn, valueColumn, contextColumn }
}

function parseTimestamp(dateStr: string, timeStr?: string): number | null {
  const combined = timeStr ? `${dateStr} ${timeStr}` : dateStr
  const parsed = Date.parse(combined)
  if (!Number.isNaN(parsed)) return parsed
  // Fall back to common US format M/D/YYYY [H:MM AM/PM]
  const usMatch = combined.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ T]?(\d{1,2}:\d{2}(:\d{2})?\s*[APap]?[Mm]?)?/,
  )
  if (usMatch) {
    const [, m, d, y, t] = usMatch
    const year = y.length === 2 ? `20${y}` : y
    const iso = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${t ? ' ' + t : ''}`
    const retry = Date.parse(iso)
    if (!Number.isNaN(retry)) return retry
  }
  return null
}

function parseValue(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export interface ImportRowResult {
  reading: Omit<GlucoseReading, 'id'> | null
  error?: string
  raw: Record<string, string>
}

export function buildReadingsFromRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  now: number = Date.now(),
): ImportRowResult[] {
  return rows.map((raw) => {
    const dateStr = raw[mapping.dateColumn]
    const timeStr = mapping.timeColumn ? raw[mapping.timeColumn] : undefined
    const valueStr = raw[mapping.valueColumn]

    if (!dateStr || !valueStr) {
      return { reading: null, error: 'Missing date or value', raw }
    }
    const timestamp = parseTimestamp(dateStr, timeStr)
    if (timestamp == null) {
      return { reading: null, error: `Could not parse date "${dateStr}"`, raw }
    }
    const value = parseValue(valueStr)
    if (value == null || value <= 0) {
      return { reading: null, error: `Could not parse glucose value "${valueStr}"`, raw }
    }

    const context: GlucoseContext = 'random'

    return {
      reading: {
        timestamp,
        value,
        context,
        note: mapping.contextColumn ? raw[mapping.contextColumn] : undefined,
        source: 'csv_import',
        createdAt: now,
        updatedAt: now,
      },
      raw,
    }
  })
}

/**
 * A reading's local wall-clock time, formatted without a timezone suffix
 * (deliberately NOT a real UTC instant) — reconstructed from its stored
 * UTC timestamp plus the offset captured at entry time, so it reflects
 * where/when the reading was actually taken rather than whatever timezone
 * this export happens to run in. Blank when no offset was captured.
 */
function toLocalIsoString(timestamp: number, offsetMinutes: number | undefined): string {
  if (offsetMinutes == null) return ''
  const shifted = new Date(timestamp + offsetMinutes * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
}

/**
 * Column order mirrors the data model, but compatibility never depends on
 * order — Papa.parse/the importer are header-NAME keyed, not positional.
 * The original 5 columns (timestamp, value_mgdl, context, source, note)
 * keep their exact names so an old export of this file is still a valid
 * input anywhere that expects them; everything else is additive. See
 * DATA_DICTIONARY.md for what each column means.
 */
export function readingsToCsv(readings: GlucoseReading[]): string {
  return Papa.unparse(
    readings.map((r) => ({
      measurement_id: r.id ?? '',
      timestamp: new Date(r.timestamp).toISOString(),
      timestamp_local: toLocalIsoString(r.timestamp, r.timezoneOffsetMinutes),
      timezone_offset_minutes: r.timezoneOffsetMinutes ?? '',
      value_mgdl: r.value,
      context: r.context,
      source: r.source,
      device_id: r.deviceId ?? '',
      meal_id: r.mealId ?? '',
      target_post_meal_minutes: r.targetPostMealMinutes ?? '',
      protocol_run_id: r.protocolRunId ?? '',
      protocol_role: r.protocolRole ?? '',
      caffeine_before_measurement: r.caffeineBeforeMeasurement ?? '',
      alcohol_previous_24h: r.alcoholPrevious24h ?? '',
      stress_level_1_5: r.stressLevel ?? '',
      illness_flag: r.illnessFlag ?? '',
      medications_taken: r.medicationsTaken ?? '',
      supplements_taken: r.supplementsTaken ?? '',
      hydration_status: r.hydrationStatus ?? '',
      symptoms: r.symptoms ?? '',
      note: r.note ?? '',
    })),
  )
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
