import type { SupplementChangeEntry } from '../types'

export interface SupplementMarker {
  /** a date guaranteed to be one of `chartDates`, so a category-axis chart can plot it */
  date: string
  label: string
}

/**
 * Maps supplement changes onto a chart's own date categories. A change's
 * date rarely lands on a category the chart actually has a data point for
 * (e.g. the fasting chart only has points on days with a fasting reading),
 * and a category-axis chart silently drops a ReferenceLine whose x doesn't
 * match an existing category — so each change is snapped to the nearest
 * date actually present. Changes outside the chart's visible date range are
 * dropped rather than snapped to an edge, since that would misrepresent
 * when the change happened.
 */
export function visibleSupplementMarkers(
  changes: SupplementChangeEntry[],
  chartDates: string[],
): SupplementMarker[] {
  if (chartDates.length === 0) return []
  const sortedDates = [...chartDates].sort()
  const minDate = sortedDates[0]
  const maxDate = sortedDates[sortedDates.length - 1]
  const dateSet = new Set(chartDates)

  function snap(target: string): string | null {
    if (target < minDate || target > maxDate) return null
    if (dateSet.has(target)) return target
    const targetTime = Date.parse(`${target}T00:00:00`)
    let nearest = sortedDates[0]
    let nearestDiff = Infinity
    for (const d of sortedDates) {
      const diff = Math.abs(Date.parse(`${d}T00:00:00`) - targetTime)
      if (diff < nearestDiff) {
        nearestDiff = diff
        nearest = d
      }
    }
    return nearest
  }

  const markers: SupplementMarker[] = []
  for (const change of changes) {
    const snapped = snap(change.date)
    if (snapped != null) markers.push({ date: snapped, label: change.supplementName })
  }
  return markers
}
