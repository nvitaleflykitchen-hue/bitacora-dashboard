import { useState } from 'react'
import { useAuth } from '../lib/auth'
import WorkspaceTabs from '../components/WorkspaceTabs'
import MntDashboard from './mantenimiento/MntDashboard'
import MntTickets from './mantenimiento/MntTickets'
import MntActivos from './mantenimiento/MntActivos'
import MntPlanes from './mantenimiento/MntPlanes'
import MntProveedores from './mantenimiento/MntProveedores'
import MntMatafuegos from './mantenimiento/MntMatafuegos'
import MntInsumos from './mantenimiento/MntInsumos'
import MntKanban from './mantenimiento/MntKanban'
import MntResponsables from './mantenimiento/MntResponsables'
import ContactosTab from '../components/ContactosTab'
import ContactosQuickBtn from '../components/ContactosQuickBtn'

const VIEWS = {
  resumen:MntDashboard,
  tickets:MntTickets,
  tablero:MntKanban,
  activos:MntActivos,
  preventivo:MntPlanes,
  proveedores:MntProveedores,
  insumos:MntInsumos,
  matafuegos:MntMatafuegos,
  responsables:MntResponsables,
  contactos: () => <ContactosTab modulo="mantenimiento" />,
}

const TABS = [
  { id:'resumen', label:'Resumen' },
  { id:'tickets', label:'Tickets' },
  { id:'tablero', label:'Tablero', hideFor:['sede','consultor'] },
  { id:'activos', label:'Activos' },
  { id:'preventivo', label:'Preventivo', hideFor:['sede','consultor'] },
  { id:'proveedores', label:'Proveedores', hideFor:['sede','consultor'] },
  { id:'insumos', label:'Insumos', hideFor:['sede','consultor'] },
  { id:'matafuegos', label:'Matafuegos', hideFor:['sede','consultor'] },
  { id:'responsables', label:'Responsables', hideFor:['sede','consultor'] },
  { id:'contactos', label:'Contactos' },
]

export default function MantenimientoHub({ onNavigate }) {
  const { rol } = useAuth()
  const tabs = TABS.filter(tab => !tab.hideFor?.includes(rol))
  const [activeTab, setActiveTab] = useState('resumen')
  const ActiveView = VIEWS[activeTab] || MntDashboard

  return (
    <WorkspaceTabs title="Mantenimiento" subtitle="Todo el ciclo técnico, sin cambiar de módulo" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} rightSlot={<ContactosQuickBtn modulo="mantenimiento" />}>
      <ActiveView onNavigate={onNavigate} />
    </WorkspaceTabs>
  )
}
