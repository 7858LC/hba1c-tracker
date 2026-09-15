import { AdherenceChecklist } from '../components/protocol/AdherenceChecklist'
import { AdherenceVsEA1C } from '../components/protocol/AdherenceVsEA1C'
import { ProtocolEditor } from '../components/protocol/ProtocolEditor'
import { useAllReadings } from '../hooks/data'

export function ProtocolPage() {
  const readings = useAllReadings()

  return (
    <div className="page">
      <ProtocolEditor />
      <AdherenceChecklist />
      <AdherenceVsEA1C readings={readings} />
    </div>
  )
}
