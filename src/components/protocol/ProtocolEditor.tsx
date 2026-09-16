import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import { PROTOCOL_TEMPLATES, type ProtocolTemplate } from '../../lib/protocolTemplates'
import type { ProtocolRule } from '../../types'

function newRuleId(): string {
  return `r${Date.now()}${Math.floor(Math.random() * 1000)}`
}

function rulesFromTemplate(template: ProtocolTemplate): ProtocolRule[] {
  return template.rules.map((label) => ({ id: newRuleId(), label }))
}

export function ProtocolEditor() {
  const active = useLiveQuery(() => db.protocols.filter((p) => p.active).first(), [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState<ProtocolRule[]>([])
  const [newRuleLabel, setNewRuleLabel] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (active) {
      setName(active.name)
      setDescription(active.description ?? '')
      setRules(active.rules)
    }
  }, [active?.id])

  function addRule() {
    if (!newRuleLabel.trim()) return
    setRules((r) => [...r, { id: newRuleId(), label: newRuleLabel.trim() }])
    setNewRuleLabel('')
  }

  function removeRule(id: string) {
    setRules((r) => r.filter((rule) => rule.id !== id))
  }

  function applyTemplate(template: ProtocolTemplate) {
    setName(template.name)
    setDescription(template.description)
    setRules(rulesFromTemplate(template))
  }

  async function save() {
    const now = Date.now()
    if (active?.id != null) {
      await db.protocols.update(active.id, { name, description, rules, updatedAt: now })
    } else {
      await db.protocols.add({ name, description, rules, active: true, createdAt: now, updatedAt: now })
    }
    setEditing(false)
  }

  async function startNewProtocol() {
    if (active?.id != null) {
      await db.protocols.update(active.id, { active: false, updatedAt: Date.now() })
    }
    setName('')
    setDescription('')
    setRules([])
    setEditing(true)
  }

  if (!active && !editing) {
    return (
      <div className="card">
        <h2>Active protocol</h2>
        <p className="empty-state">No protocol defined yet.</p>
        <button className="btn-primary" onClick={() => setEditing(true)}>
          Create a protocol
        </button>
      </div>
    )
  }

  if (active && !editing) {
    return (
      <div className="card">
        <div className="card-header-row">
          <h2>{active.name}</h2>
          <div className="btn-row">
            <button className="btn-ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn-ghost" onClick={startNewProtocol}>
              Start new protocol
            </button>
          </div>
        </div>
        {active.description && <p>{active.description}</p>}
        <ul>
          {active.rules.map((r) => (
            <li key={r.id}>{r.label}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>{active ? 'Edit protocol' : 'New protocol'}</h2>
      <div className="entry-form">
        {!active && (
          <div className="field-row">
            <label id="protocol-template-label">
              Start from a template (optional — generic starting points, not
              recommendations; edit anything after)
            </label>
            <div className="chip-group" role="group" aria-labelledby="protocol-template-label">
              {PROTOCOL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="chip"
                  title={t.description}
                  onClick={() => applyTemplate(t)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field-row">
          <label>Protocol name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 16:8 + walks + low carb"
          />
        </div>
        <div className="field-row">
          <label>Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 16:8 fasting + 30min post-meal walk + <130g carbs/day"
          />
        </div>
        <div className="field-row">
          <label>Checklist rules</label>
          {rules.map((r) => (
            <div key={r.id} className="checklist-item">
              <span>{r.label}</span>
              <button className="btn-small btn-ghost" onClick={() => removeRule(r.id)}>
                Remove
              </button>
            </div>
          ))}
          <div className="btn-row">
            <input
              type="text"
              value={newRuleLabel}
              onChange={(e) => setNewRuleLabel(e.target.value)}
              placeholder="e.g. 30 min post-meal walk"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
            />
            <button type="button" className="btn-ghost" onClick={addRule}>
              Add rule
            </button>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn-primary" onClick={save} disabled={!name.trim()}>
            Save protocol
          </button>
          {active && (
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
