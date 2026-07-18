import { useState } from 'react'
import WorkspaceTabs from '../components/WorkspaceTabs'
import ContactosQuickBtn from '../components/ContactosQuickBtn'
import ContactosTab from '../components/ContactosTab'
import NoConformidades from './NoConformidades'
import CAPA from './CAPA'
import Indicadores from './Indicadores'
import ComedoresMetricas from './ComedoresMetricas'
import ISO9001Dashboard from './ISO9001Dashboard'
import AuditoriasInternas from './AuditoriasInternas'

const TABS = [
  { id:'iso9001', label:'ISO 9001' },
  { id:'nc', label:'No conformidades' },
  { id:'capa', label:'CAPA' },
  { id:'auditorias', label:'Auditorías internas' },
  { id:'comedores', label:'Comedores' },
  { id:'indicadores', label:'Indicadores' },
  { id:'contactos', label:'Contactos' },
]

export default function CalidadHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('iso9001')
  const ActiveView = activeTab === 'iso9001' ? ISO9001Dashboard
    : activeTab === 'capa' ? CAPA
    : activeTab === 'auditorias' ? AuditoriasInternas
    : activeTab === 'indicadores' ? Indicadores
    : activeTab === 'comedores' ? ComedoresMetricas
    : activeTab === 'contactos' ? () => <ContactosTab modulo="calidad" />
    : NoConformidades

  return (
    <WorkspaceTabs title="Calidad" subtitle="Auditorías, no conformidades, acciones e indicadores" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} rightSlot={<ContactosQuickBtn modulo="calidad" />}>
      <ActiveView onNavigate={onNavigate} onOpenTab={setActiveTab} />
    </WorkspaceTabs>
  )
}
