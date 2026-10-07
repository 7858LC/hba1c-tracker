import { useState } from 'react'
import { AwakeningProtocolPage } from './AwakeningProtocolPage'
import { MealResponseProtocolPage } from './MealResponseProtocolPage'

type SubTab = 'awakening' | 'meal_response'

const TABS: { id: SubTab; label: string }[] = [
  { id: 'awakening', label: 'Awakening profile' },
  { id: 'meal_response', label: 'Meal response' },
]

export function GlucoseProtocolsPage() {
  const [tab, setTab] = useState<SubTab>('awakening')

  return (
    <div className="page">
      <div className="subtab-row">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`subtab ${tab === t.id ? 'subtab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'awakening' && <AwakeningProtocolPage />}
      {tab === 'meal_response' && <MealResponseProtocolPage />}
    </div>
  )
}
