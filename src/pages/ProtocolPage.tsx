import { useLiveQuery } from 'dexie-react-hooks'
import { AdherenceChecklist } from '../components/protocol/AdherenceChecklist'
import { AdherenceVsEA1C } from '../components/protocol/AdherenceVsEA1C'
import { ProtocolEditor } from '../components/protocol/ProtocolEditor'
import { StreakCard } from '../components/protocol/StreakCard'
import { db } from '../db/db'
import { useAllReadings } from '../hooks/data'

export function ProtocolPage() {
  const readings = useAllReadings()
  const activeProtocol = useLiveQuery(() => db.protocols.filter((p) => p.active).first(), [])

  return (
    <div className="page">
      <ProtocolEditor />
      {activeProtocol?.id != null && <StreakCard protocolId={activeProtocol.id} />}
      <AdherenceChecklist />
      <AdherenceVsEA1C readings={readings} />
    </div>
  )
}
