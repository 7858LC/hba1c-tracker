import { describe, expect, it } from 'vitest'
import type { GlucoseReading } from '../../types'
import { buildReadingsFromRows, detectColumnMapping, parseCsvFile, readingsToCsv } from '../csv'

describe('parseCsvFile + detectColumnMapping', () => {
  it('detects date/time/value columns from a typical export header', () => {
    const csv = 'Date,Time,Glucose (mg/dL)\n2025-01-01,08:00,110\n2025-01-01,20:00,145\n'
    const { headers, rows } = parseCsvFile(csv)
    expect(rows).toHaveLength(2)
    const mapping = detectColumnMapping(headers)
    expect(mapping.dateColumn).toBe('Date')
    expect(mapping.timeColumn).toBe('Time')
    expect(mapping.valueColumn).toBe('Glucose (mg/dL)')
  })

  it('detects a combined datetime column', () => {
    const csv = 'Timestamp,Result\n2025-01-01 08:00,110\n'
    const { headers } = parseCsvFile(csv)
    const mapping = detectColumnMapping(headers)
    expect(mapping.dateColumn).toBe('Timestamp')
    expect(mapping.valueColumn).toBe('Result')
  })
})

describe('buildReadingsFromRows', () => {
  it('parses valid rows into readings', () => {
    const rows = [
      { Date: '2025-01-01', Time: '08:00', Value: '110' },
      { Date: '2025-01-01', Time: '20:00', Value: '145' },
    ]
    const results = buildReadingsFromRows(rows, {
      dateColumn: 'Date',
      timeColumn: 'Time',
      valueColumn: 'Value',
    })
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.reading != null)).toBe(true)
    expect(results[0].reading!.value).toBe(110)
    expect(results[0].reading!.source).toBe('csv_import')
  })

  it('flags rows with unparseable values instead of silently dropping them', () => {
    const rows = [{ Date: '2025-01-01', Time: '08:00', Value: 'n/a' }]
    const results = buildReadingsFromRows(rows, {
      dateColumn: 'Date',
      timeColumn: 'Time',
      valueColumn: 'Value',
    })
    expect(results[0].reading).toBeNull()
    expect(results[0].error).toBeTruthy()
  })

  it('flags rows with missing required fields', () => {
    const rows = [{ Date: '', Time: '08:00', Value: '110' }]
    const results = buildReadingsFromRows(rows, {
      dateColumn: 'Date',
      timeColumn: 'Time',
      valueColumn: 'Value',
    })
    expect(results[0].reading).toBeNull()
  })

  it('imports an old-format 5-column export unchanged (backward compatibility)', () => {
    const csv = 'timestamp,value_mgdl,context,source,note\n2025-01-01T08:00:00.000Z,110,fasting,manual,\n'
    const { headers, rows } = parseCsvFile(csv)
    const mapping = detectColumnMapping(headers)
    expect(mapping.dateColumn).toBe('timestamp')
    expect(mapping.valueColumn).toBe('value_mgdl')
    const results = buildReadingsFromRows(rows, {
      dateColumn: mapping.dateColumn!,
      valueColumn: mapping.valueColumn!,
    })
    expect(results[0].reading).not.toBeNull()
    expect(results[0].reading!.value).toBe(110)
  })
})

describe('readingsToCsv', () => {
  function reading(overrides: Partial<GlucoseReading> = {}): GlucoseReading {
    const t = Date.parse('2025-09-20T12:00:00.000Z')
    return {
      id: 1,
      timestamp: t,
      value: 110,
      context: 'fasting',
      source: 'manual',
      createdAt: t,
      updatedAt: t,
      ...overrides,
    }
  }

  it('keeps the original 5 column names present for backward compatibility', () => {
    const csv = readingsToCsv([reading()])
    const header = csv.split('\n')[0]
    for (const col of ['timestamp', 'value_mgdl', 'context', 'source', 'note']) {
      expect(header).toContain(col)
    }
  })

  it('includes the new v2 columns', () => {
    const csv = readingsToCsv([reading({ mealId: 7, deviceId: 'Contour7', stressLevel: 3 })])
    const [header, row] = csv.split('\n')
    expect(header).toContain('meal_id')
    expect(header).toContain('device_id')
    expect(header).toContain('stress_level_1_5')
    expect(row).toContain('7')
    expect(row).toContain('Contour7')
  })

  it('reconstructs local time from the stored UTC timestamp and offset, leaving it blank when unknown', () => {
    // UTC noon, offset -300 (UTC-5, e.g. US Eastern) -> local 07:00
    const withOffset = readingsToCsv([reading({ timezoneOffsetMinutes: -300 })])
    expect(withOffset.split('\n')[1]).toContain('2025-09-20T07:00:00')

    const withoutOffset = readingsToCsv([reading({ timezoneOffsetMinutes: undefined })])
    const cols = withoutOffset.split('\n')[1].split(',')
    // timestamp_local is the 3rd column (measurement_id, timestamp, timestamp_local, ...)
    expect(cols[2]).toBe('')
  })
})
