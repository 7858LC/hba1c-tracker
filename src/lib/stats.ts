export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

/** Sample standard deviation (n-1 denominator). */
export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null
  const m = mean(values)!
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Coefficient of variation, as a percentage. ADA/AGP guidance targets <36%. */
export function coefficientOfVariation(values: number[]): number | null {
  const m = mean(values)
  const sd = standardDeviation(values)
  if (m == null || sd == null || m === 0) return null
  return (sd / m) * 100
}

export interface TimeInRangeResult {
  low: number
  high: number
  belowRangePct: number
  inRangePct: number
  aboveRangePct: number
  readingCount: number
}

export function timeInRange(
  values: number[],
  low: number,
  high: number,
): TimeInRangeResult | null {
  if (values.length === 0) return null
  let below = 0
  let inRange = 0
  let above = 0
  for (const v of values) {
    if (v < low) below++
    else if (v > high) above++
    else inRange++
  }
  const n = values.length
  return {
    low,
    high,
    belowRangePct: (below / n) * 100,
    inRangePct: (inRange / n) * 100,
    aboveRangePct: (above / n) * 100,
    readingCount: n,
  }
}
