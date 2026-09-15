import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/db'

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function AdherenceChecklist() {
  const active = useLiveQuery(() => db.protocols.filter((p) => p.active).first(), [])
  const [date] = useState(today())

  const entry = useLiveQuery(async () => {
    if (active?.id == null) return undefined
    return db.adherence.where('[protocolId+date]').equals([active.id, date]).first()
  }, [active?.id, date])

  if (!active) return null

  const metRuleIds = entry?.metRuleIds ?? []

  async function toggle(ruleId: string) {
    if (active?.id == null) return
    const now = Date.now()
    const nextMet = metRuleIds.includes(ruleId)
      ? metRuleIds.filter((id) => id !== ruleId)
      : [...metRuleIds, ruleId]

    if (entry?.id != null) {
      await db.adherence.update(entry.id, { metRuleIds: nextMet, updatedAt: now })
    } else {
      await db.adherence.add({
        date,
        protocolId: active.id,
        metRuleIds: nextMet,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  const pct = active.rules.length > 0 ? (metRuleIds.length / active.rules.length) * 100 : 0

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Today's adherence</h2>
        <span className="stat-label">{pct.toFixed(0)}%</span>
      </div>
      <div className="checklist">
        {active.rules.map((rule) => (
          <label key={rule.id} className="checklist-item">
            <input
              type="checkbox"
              checked={metRuleIds.includes(rule.id)}
              onChange={() => toggle(rule.id)}
            />
            {rule.label}
          </label>
        ))}
      </div>
    </div>
  )
}
