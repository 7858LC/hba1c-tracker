import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../../db/db'
import { rollingEA1CSeries } from '../../lib/ea1c'
import type { AdherenceEntry, GlucoseReading, Protocol } from '../../types'

function buildAdherenceSeries(adherence: AdherenceEntry[], protocol: Protocol) {
  const ruleCount = protocol.rules.length || 1
  return [...adherence]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({
      date: a.date,
      pct: Math.round((a.metRuleIds.length / ruleCount) * 100),
    }))
}

export function AdherenceVsEA1C({ readings }: { readings: GlucoseReading[] }) {
  const active = useLiveQuery(() => db.protocols.filter((p) => p.active).first(), [])
  const adherence = useLiveQuery(
    () => (active?.id != null ? db.adherence.where('protocolId').equals(active.id).toArray() : []),
    [active?.id],
  )

  const adherenceSeries = useMemo(
    () => (active && adherence ? buildAdherenceSeries(adherence, active) : []),
    [active, adherence],
  )

  const ea1cSeries = useMemo(
    () =>
      rollingEA1CSeries(readings, 14).map((p) => ({
        date: p.date,
        value: p.value != null ? Number(p.value.toFixed(2)) : null,
      })),
    [readings],
  )

  if (!active) return null

  return (
    <div className="card">
      <h2>Adherence vs eA1C trend</h2>
      <p className="hint">
        Two charts, same time axis, shown side by side rather than one chart with two scales —
        so you can eyeball whether adherence and eA1C actually move together.
      </p>
      <div className="dashboard-grid">
        <div>
          <h3>Daily adherence %</h3>
          {adherenceSeries.length === 0 ? (
            <p className="empty-state">No adherence entries yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={adherenceSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--gridline)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} stroke="var(--axis)" minTickGap={20} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" width={32} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v}%`, 'Adherence']}
                />
                <Bar dataKey="pct" fill="var(--series-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div>
          <h3>14d rolling eA1C</h3>
          {ea1cSeries.length < 2 ? (
            <p className="empty-state">Not enough glucose data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={ea1cSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--gridline)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} stroke="var(--axis)" minTickGap={20} />
                <YAxis domain={['dataMin - 0.2', 'dataMax + 0.2']} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--axis)" width={36} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v}%`, 'eA1C']}
                />
                <Line type="monotone" dataKey="value" stroke="var(--series-1)" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
