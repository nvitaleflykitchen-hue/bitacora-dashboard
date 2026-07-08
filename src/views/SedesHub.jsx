import { useState } from 'react'
import { useAuth } from '../lib/auth'
import WorkspaceTabs from '../components/WorkspaceTabs'
import PorSede from './PorSede'
import SedeFicha from './SedeFicha'
import SedeResponsables from './SedeResponsables'
import ComedoresMetricas from './ComedoresMetricas'

const TABS = [
  { id:'estado', label:'Estado por sede' },
  { id:'comedores', label:'Comedores' },
  { id:'ficha', label:'Ficha de unidad' },
  { id:'responsables', label:'Responsables', hideFor:['sede'] },
]

export default function SedesHub({ onNavigate, focusId, focusType }) {
  const { rol } = useAuth()
  const tabs = TABS.filter(tab => !tab.hideFor?.includes(rol))
  const [activeTab, setActiveTab] = useState(() => {
    const requested = sessionStorage.getItem('bitacora:sedesTab')
    if (requested) sessionStorage.removeItem('bitacora:sedesTab')
    if (focusType === 'sede' && tabs.some(tab => tab.id === 'ficha')) return 'ficha'
    return tabs.some(tab => tab.id === requested) ? requested : tabs[0].id
  })
  const ActiveView = activeTab === 'ficha'
    ? SedeFicha
    : activeTab === 'responsables'
      ? SedeResponsables
      : activeTab === 'comedores'
        ? ComedoresMetricas
        : PorSede

  return (
    <WorkspaceTabs title="Sedes" subtitle="Operación, comedores, ficha y responsables en un solo lugar" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
      <ActiveView onNavigate={onNavigate} focusId={focusId} />
    </WorkspaceTabs>
  )
}
