/**
 * GMI (Glucose Management Indicator), the published CGM-derived mapping from
 * mean glucose to an HbA1c-equivalent:
 *   GMI(%) = 3.31 + 0.02392 × mean glucose (mg/dL)
 * Source: Bergenstal RM et al., Diabetes Care 2018;41(11):2275-80.
 *
 * This is NOT the ADAG formula in ea1c.ts. The two differ by roughly half a
 * point near normal-range glucose (mean 100 mg/dL: GMI 5.70%, ADAG 5.11%),
 * so a number from one must never be labeled as the other. GMI was derived
 * from continuous monitoring (>=14 days); fingerstick data is a weaker input.
 */
export const GMI_INTERCEPT = 3.31
/** HbA1c percentage points per mg/dL of mean glucose. */
export const GMI_SLOPE = 0.02392

export function glucoseToGMI(avgGlucoseMgDl: number): number {
  return GMI_INTERCEPT + GMI_SLOPE * avgGlucoseMgDl
}

export function gmiToGlucose(gmi: number): number {
  return (gmi - GMI_INTERCEPT) / GMI_SLOPE
}
