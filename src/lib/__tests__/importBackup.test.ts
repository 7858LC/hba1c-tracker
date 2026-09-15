import { describe, expect, it } from 'vitest'
import { parseBackupFile } from '../importBackup'

function validPayload() {
  return {
    exportedAt: '2025-01-01T00:00:00.000Z',
    readings: [],
    meals: [],
    fastingWindows: [],
    exercise: [],
    sleep: [],
    protocols: [],
    adherence: [],
    settings: [],
  }
}

describe('parseBackupFile', () => {
  it('parses a well-formed export', () => {
    const payload = parseBackupFile(JSON.stringify(validPayload()))
    expect(payload.readings).toEqual([])
  })

  it('rejects invalid JSON', () => {
    expect(() => parseBackupFile('{not json')).toThrow('not valid JSON')
  })

  it('rejects a file missing a required array field', () => {
    const bad = validPayload() as any
    delete bad.readings
    expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(/readings/)
  })

  it('rejects a file where a required field is not an array', () => {
    const bad = { ...validPayload(), meals: 'not an array' }
    expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(/meals/)
  })

  it('rejects a non-object JSON value', () => {
    expect(() => parseBackupFile('42')).toThrow('Unexpected backup format')
  })
})
