import { useState } from 'react'
import { DashboardPage } from './pages/DashboardPage'
import { GlucosePage } from './pages/GlucosePage'
import { LifestylePage } from './pages/LifestylePage'
import { ProjectionPage } from './pages/ProjectionPage'
import { ProtocolPage } from './pages/ProtocolPage'
import { SettingsPage } from './pages/SettingsPage'

type Tab = 'log' | 'lifestyle' | 'dashboard' | 'protocol' | 'projection' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'Log glucose' },
  { id: 'lifestyle', label: 'Diet / exercise / sleep' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'protocol', label: 'Protocol' },
  { id: 'projection', label: 'Projection' },
  { id: 'settings', label: 'Settings' },
]

function App() {
  const [tab, setTab] = useState<Tab>('log')

  return (
    <>
      <header className="app-header">
        <h1>HbA1c Tracker</h1>
        <span className="app-subtitle">
          Local-first · daily leading indicators → estimated A1C trend
        </span>
      </header>

      <nav className="nav-row">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-btn ${tab === t.id ? 'nav-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'log' && <GlucosePage />}
        {tab === 'lifestyle' && <LifestylePage />}
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'protocol' && <ProtocolPage />}
        {tab === 'projection' && <ProjectionPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </>
  )
}

export default App
