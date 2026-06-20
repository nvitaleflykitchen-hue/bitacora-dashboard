import { useState } from 'react'
import WorkspaceTabs from '../components/WorkspaceTabs'
import NoConformidades from './NoConformidades'
import CAPA from './CAPA'
import Indicadores from './Indicadores'

const TABS = [
  { id:'nc', label:'No conformidades' },
  { id:'capa', label:'CAPA' },
  { id:'indicadores', label:'Indicadores' },
]

export default function CalidadHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('nc')
  const ActiveView = activeTab === 'capa' ? CAPA : activeTab === 'indicadores' ? Indicadores : NoConformidades

  return (
    <WorkspaceTabs title="Calidad" subtitle="No conformidades, acciones e indicadores" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <ActiveView onNavigate={onNavigate} />
    </WorkspaceTabs>
  )
}
