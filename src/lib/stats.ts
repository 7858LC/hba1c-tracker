export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export interface Range {
  min: number
  max: number
}

export function range(values: number[]): Range | null {
  if (values.length === 0) return null
  return { min: Math.min(...values), max: Math.max(...values) }
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

export interface DistributionBand {
  label: string
  /** inclusive */
  min: number
  /** inclusive; null means no upper bound */
  max: number | null
}

export interface DistributionResult {
  label: string
  pct: number
  count: number
}

/**
 * Partitions values into non-overlapping, exhaustive bands (each value
 * falls in exactly one) and reports each band's share. Used for the
 * standard glucose distribution (<70 / 70-99 / 100-125 / >=126).
 */
export function bandDistribution(
  values: number[],
  bands: DistributionBand[],
): DistributionResult[] | null {
  if (values.length === 0) return null
  return bands.map((band) => {
    const count = values.filter(
      (v) => v >= band.min && (band.max == null || v <= band.max),
    ).length
    return { label: band.label, pct: (count / values.length) * 100, count }
  })
}

/** % of values at or above each threshold — overlapping/cumulative, unlike bandDistribution. */
export function thresholdPercentages(
  values: number[],
  thresholds: number[],
): { threshold: number; pct: number }[] | null {
  if (values.length === 0) return null
  return thresholds.map((threshold) => ({
    threshold,
    pct: (values.filter((v) => v >= threshold).length / values.length) * 100,
  }))
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
