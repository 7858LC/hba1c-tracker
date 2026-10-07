import type { GlucoseReading } from '../types'
import { mean, standardDeviation } from './stats'

export const MIN_BAND_READINGS = 5
export const MIN_HOURLY_READINGS = 5
export const MIN_DOW_READINGS = 5

export interface TimeOfDayBand {
  label: string
  /** inclusive */
  startHour: number
  /** exclusive */
  endHour: number
}

export const TIME_OF_DAY_BANDS: TimeOfDayBand[] = [
  { label: '12AM-6AM', startHour: 0, endHour: 6 },
  { label: '6AM-9AM', startHour: 6, endHour: 9 },
  { label: '9AM-12PM', startHour: 9, endHour: 12 },
  { label: '12PM-3PM', startHour: 12, endHour: 15 },
  { label: '3PM-6PM', startHour: 15, endHour: 18 },
  { label: '6PM-9PM', startHour: 18, endHour: 21 },
  { label: '9PM-12AM', startHour: 21, endHour: 24 },
]

export interface BandStats {
  label: string
  eligible: boolean
  readingCount: number
  mean: number | null
  sd: number | null
}

/** Section F (Time-of-day), 7-band grouping. Local (browser) clock hour, same convention as the rest of the app's displays. */
export function computeTimeOfDayAnalytics(readings: GlucoseReading[]): BandStats[] {
  return TIME_OF_DAY_BANDS.map((band) => {
    const values = readings
      .filter((r) => {
        const h = new Date(r.timestamp).getHours()
        return h >= band.startHour && h < band.endHour
      })
      .map((r) => r.value)
    return {
      label: band.label,
      eligible: values.length >= MIN_BAND_READINGS,
      readingCount: values.length,
      mean: mean(values),
      sd: standardDeviation(values),
    }
  })
}

export interface HourlyStats {
  hour: number
  eligible: boolean
  readingCount: number
  mean: number | null
}

/** Section F, hourly detail — only meaningful where there are enough observations per hour. */
export function computeHourlyAnalytics(readings: GlucoseReading[]): HourlyStats[] {
  const out: HourlyStats[] = []
  for (let h = 0; h < 24; h++) {
    const values = readings.filter((r) => new Date(r.timestamp).getHours() === h).map((r) => r.value)
    out.push({
      hour: h,
      eligible: values.length >= MIN_HOURLY_READINGS,
      readingCount: values.length,
      mean: mean(values),
    })
  }
  return out
}

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface DayOfWeekStats {
  day: string
  dayIndex: number
  eligible: boolean
  readingCount: number
  mean: number | null
}

/** Section G (Day-of-week). Each day suppressed independently when its own sample is inadequate. */
export function computeDayOfWeekAnalytics(readings: GlucoseReading[]): DayOfWeekStats[] {
  return DOW_LABELS.map((day, dayIndex) => {
    const values = readings
      .filter((r) => new Date(r.timestamp).getDay() === dayIndex)
      .map((r) => r.value)
    return {
      day,
      dayIndex,
      eligible: values.length >= MIN_DOW_READINGS,
      readingCount: values.length,
      mean: mean(values),
    }
  })
}
