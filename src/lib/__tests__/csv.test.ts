import { describe, expect, it } from 'vitest'
import { buildReadingsFromRows, detectColumnMapping, parseCsvFile } from '../csv'

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
})
