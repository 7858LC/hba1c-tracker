import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  computeGlucoseByWakeRegularity,
  computeGlucoseByWaso,
  computeGlucoseBySleepDuration,
  computeGlucoseBySleepQuality,
  computeSleepDisruptionFlags,
  computeSleepDurationFastingCorrelation,
} from '../../lib/analyticsSleep'
import type { GlucoseReading, SleepEntry } from '../../types'

function signalLabels(flag: { shortDuration: boolean; highWaso: boolean; wakeIrregular: boolean }): string {
  const labels: string[] = []
  if (flag.shortDuration) labels.push('short sleep')
  if (flag.highWaso) labels.push('fragmented')
  if (flag.wakeIrregular) labels.push('irregular wake')
  return labels.join(', ')
}

function interpretR(r: number | null, n: number): string {
  if (r == null || n < 3) return 'not enough paired nights yet'
  const abs = Math.abs(r)
  const strength = abs >= 0.5 ? 'moderate-to-strong' : abs >= 0.3 ? 'weak-to-moderate' : 'weak'
  const direction = r > 0 ? 'positive' : 'negative'
  return `${strength} ${direction} association (r = ${r.toFixed(2)}, n=${n})`
}

export function SleepRelationshipCard({
  readings,
  sleepEntries,
  targetFastingGlucose,
}: {
  readings: GlucoseReading[]
  sleepEntries: SleepEntry[]
  targetFastingGlucose: number
}) {
  const [showFlags, setShowFlags] = useState(false)

  const duration = useMemo(() => computeGlucoseBySleepDuration(readings, sleepEntries), [readings, sleepEntries])
  const quality = useMemo(() => computeGlucoseBySleepQuality(readings, sleepEntries), [readings, sleepEntries])
  const waso = useMemo(() => computeGlucoseByWaso(readings, sleepEntries), [readings, sleepEntries])
  const wakeRegularity = useMemo(
    () => computeGlucoseByWakeRegularity(readings, sleepEntries),
    [readings, sleepEntries],
  )
  const correlation = useMemo(
    () => computeSleepDurationFastingCorrelation(sleepEntries, readings),
    [readings, sleepEntries],
  )
  const flags = useMemo(
    () => computeSleepDisruptionFlags(readings, sleepEntries, targetFastingGlucose),
    [readings, sleepEntries, targetFastingGlucose],
  )

  const durationData = duration.map((b) => ({
    label: b.label,
    mean: b.eligible ? Number(b.mean!.toFixed(1)) : null,
    readingCount: b.readingCount,
  }))
  const anyDurationEligible = duration.some((b) => b.eligible)
  const anyQualityEligible = quality.some((b) => b.eligible)

  return (
    <div className="card">
      <h2>Sleep relationship</h2>
      <p className="hint">
        Next-morning fasting glucose grouped by the preceding night's sleep — specifically
        looking at whether sleep duration relates to next-morning fasting glucose.
      </p>

      {!anyDurationEligible ? (
        <p className="empty-state">Not enough paired nights yet by sleep duration.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={durationData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" width={40} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, _n, p) => [`${v} mg/dL fasting`, `n=${p.payload.readingCount}`]}
            />
            <Bar dataKey="mean" fill="var(--series-4)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="stat-caveat">Sleep duration vs. next-morning fasting: {interpretR(correlation.r, correlation.n)}</p>

      {anyQualityEligible && (
        <>
          <h3>By sleep quality</h3>
          <div className="tir-legend">
            {quality.filter((q) => q.eligible).map((q) => (
              <span key={q.label}>
                {q.label}: {q.mean?.toFixed(0)} mg/dL (n={q.readingCount})
              </span>
            ))}
          </div>
        </>
      )}

      {waso.some((b) => b.eligible) && (
        <>
          <h3>By sleep fragmentation (WASO)</h3>
          <div className="tir-legend">
            {waso.filter((b) => b.eligible).map((b) => (
              <span key={b.label}>
                {b.label}: {b.mean?.toFixed(0)} mg/dL (n={b.readingCount})
              </span>
            ))}
          </div>
          <p className="stat-caveat">
            Minutes awake during the sleep period, independent of total duration — a long but
            broken-up night and a short unbroken one can land in different buckets here even with
            similar durationMinutes.
          </p>
        </>
      )}

      {wakeRegularity.some((b) => b.eligible) && (
        <>
          <h3>By wake-time regularity</h3>
          <div className="tir-legend">
            {wakeRegularity.filter((b) => b.eligible).map((b) => (
              <span key={b.label}>
                {b.label}: {b.mean?.toFixed(0)} mg/dL (n={b.readingCount})
              </span>
            ))}
          </div>
          <p className="stat-caveat">
            How far that morning's wake time deviated from your own recent usual wake time,
            regardless of how long you slept — scored only once enough recent nights exist to
            establish what "usual" means for you.
          </p>
        </>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <button className="btn-small btn-ghost" onClick={() => setShowFlags((v) => !v)}>
        {showFlags ? 'Hide' : 'Show'} flagged mornings ({flags.length})
      </button>
      <p className="stat-caveat" style={{ marginTop: 4 }}>
        Specific nights where sleep looked disrupted (short, fragmented, or an irregular wake
        time) AND the next morning's fasting average came in above your target — the "go look
        here" list behind the three charts above, not another average.
      </p>

      {showFlags &&
        (flags.length === 0 ? (
          <p className="empty-state">No flagged mornings in your current data.</p>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Night</th>
                <th>Fasting next morning</th>
                <th>Over target by</th>
                <th>Duration</th>
                <th>WASO</th>
                <th>Wake deviation</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.date}>
                  <td>{f.date}</td>
                  <td>
                    {f.fastingValue.toFixed(0)} mg/dL (target {f.target})
                  </td>
                  <td>+{f.exceedBy.toFixed(0)}</td>
                  <td>{f.durationHours.toFixed(1)}h</td>
                  <td>{f.wasoMinutes}m</td>
                  <td>{f.wakeDeviationMinutes != null ? `${f.wakeDeviationMinutes.toFixed(0)}m` : 'n/a'}</td>
                  <td>{signalLabels(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      <p className="stat-caveat">
        This is an observed-data list, not a diagnosis: it flags where a disruption signal and an
        above-target morning co-occurred, not that one caused the other. A short list here from a
        few weeks of data is still a reasonable, honest basis to bring to a clinician when asking
        about cortisol testing — it just isn't proof of the mechanism itself.
      </p>
    </div>
  )
}
