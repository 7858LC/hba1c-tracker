import { useState } from 'react'
import { ExerciseForm } from '../components/ExerciseForm'
import { ExerciseLog } from '../components/ExerciseLog'
import { FastingWindowForm } from '../components/FastingWindowForm'
import { FastingWindowLog } from '../components/FastingWindowLog'
import { MealForm } from '../components/MealForm'
import { MealLog } from '../components/MealLog'
import { SleepForm } from '../components/SleepForm'
import { SleepLog } from '../components/SleepLog'

type SubTab = 'meals' | 'fasting' | 'exercise' | 'sleep'

const TABS: { id: SubTab; label: string }[] = [
  { id: 'meals', label: 'Meals / carbs' },
  { id: 'fasting', label: 'Fasting window' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'sleep', label: 'Sleep' },
]

export function LifestylePage() {
  const [tab, setTab] = useState<SubTab>('meals')

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

      {tab === 'meals' && (
        <>
          <section className="card">
            <h2>Log a meal</h2>
            <MealForm />
          </section>
          <section className="card">
            <h2>Recent meals</h2>
            <MealLog />
          </section>
        </>
      )}

      {tab === 'fasting' && (
        <>
          <section className="card">
            <h2>Log fasting window</h2>
            <FastingWindowForm />
          </section>
          <section className="card">
            <h2>Recent fasting windows</h2>
            <FastingWindowLog />
          </section>
        </>
      )}

      {tab === 'exercise' && (
        <>
          <section className="card">
            <h2>Log exercise</h2>
            <ExerciseForm />
          </section>
          <section className="card">
            <h2>Recent exercise</h2>
            <ExerciseLog />
          </section>
        </>
      )}

      {tab === 'sleep' && (
        <>
          <section className="card">
            <h2>Log sleep</h2>
            <SleepForm />
          </section>
          <section className="card">
            <h2>Recent sleep</h2>
            <SleepLog />
          </section>
        </>
      )}
    </div>
  )
}
