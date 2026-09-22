import { describe, expect, it } from 'vitest'
import type { SupplementChangeEntry } from '../../types'
import { visibleSupplementMarkers } from '../supplementMarkers'

function change(date: string, name: string): SupplementChangeEntry {
  return {
    date,
    supplementName: name,
    priorState: 'not taking',
    newState: '500mg 1x/day',
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('visibleSupplementMarkers', () => {
  it('returns no markers when the chart has no data', () => {
    expect(visibleSupplementMarkers([change('2025-09-16', 'Berberine')], [])).toEqual([])
  })

  it('keeps a change that lands exactly on a chart date', () => {
    const result = visibleSupplementMarkers(
      [change('2025-09-16', 'Berberine')],
      ['2025-09-15', '2025-09-16', '2025-09-17'],
    )
    expect(result).toEqual([{ date: '2025-09-16', label: 'Berberine' }])
  })

  it('picks the strictly nearer date when distances differ', () => {
    const result = visibleSupplementMarkers(
      [change('2025-09-15', 'Berberine')],
      ['2025-09-10', '2025-09-16'],
    )
    expect(result).toEqual([{ date: '2025-09-16', label: 'Berberine' }])
  })

  it('drops a change that falls before the chart window', () => {
    const result = visibleSupplementMarkers(
      [change('2025-08-01', 'Berberine')],
      ['2025-09-10', '2025-09-16'],
    )
    expect(result).toEqual([])
  })

  it('drops a change that falls after the chart window', () => {
    const result = visibleSupplementMarkers(
      [change('2025-12-01', 'Berberine')],
      ['2025-09-10', '2025-09-16'],
    )
    expect(result).toEqual([])
  })

  it('maps multiple changes independently', () => {
    const result = visibleSupplementMarkers(
      [change('2025-09-10', 'Berberine'), change('2025-09-16', 'Metformin')],
      ['2025-09-10', '2025-09-11', '2025-09-16'],
    )
    expect(result).toEqual([
      { date: '2025-09-10', label: 'Berberine' },
      { date: '2025-09-16', label: 'Metformin' },
    ])
  })
})
