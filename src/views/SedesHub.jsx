import { useState } from 'react'
import { useAuth } from '../lib/auth'
import WorkspaceTabs from '../components/WorkspaceTabs'
import PorSede from './PorSede'
import SedeFicha from './SedeFicha'
import SedeResponsables from './SedeResponsables'

const TABS = [
  { id:'estado', label:'Estado por sede' },
  { id:'ficha', label:'Ficha de unidad' },
  { id:'responsables', label:'Responsables', hideFor:['sede'] },
]

export default function SedesHub({ onNavigate }) {
  const { rol } = useAuth()
  const tabs = TABS.filter(tab => !tab.hideFor?.includes(rol))
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  const ActiveView = activeTab === 'ficha' ? SedeFicha : activeTab === 'responsables' ? SedeResponsables : PorSede

  return (
    <WorkspaceTabs title="Sedes" subtitle="Operación, ficha y responsables en un solo lugar" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
      <ActiveView onNavigate={onNavigate} />
    </WorkspaceTabs>
  )
}
