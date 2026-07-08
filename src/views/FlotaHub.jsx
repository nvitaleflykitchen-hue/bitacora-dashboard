import { useState } from 'react'
import { useAuth } from '../lib/auth'
import WorkspaceTabs from '../components/WorkspaceTabs'
import FlotaResumen from './flota/FlotaResumen'
import MntFlotaGestion from './mantenimiento/MntFlotaGestion'
import MntVehiculos from './mantenimiento/MntVehiculos'
import MntPlanes from './mantenimiento/MntPlanes'
import FlotaMatafuegos from './flota/FlotaMatafuegos'
import FlotaDocumentos from './flota/FlotaDocumentos'
import ContactosTab from '../components/ContactosTab'
import ContactosQuickBtn from '../components/ContactosQuickBtn'

const VIEWS = {
  resumen: FlotaResumen,
  vehiculos: MntFlotaGestion,
  tickets: MntVehiculos,
  preventivo: (props) => <MntPlanes defaultTipo="VEHICULO" {...props} />,
  matafuegos: FlotaMatafuegos,
  documentos: FlotaDocumentos,
  contactos: () => <ContactosTab modulo="flota" />,
}

const TABS = [
  { id:'resumen', label:'Resumen' },
  { id:'vehiculos', label:'Vehículos' },
  { id:'tickets', label:'Tickets' },
  { id:'preventivo', label:'Preventivo', hideFor:['consultor'] },
  { id:'matafuegos', label:'Matafuegos', hideFor:['consultor'] },
  { id:'documentos', label:'Documentos', hideFor:['consultor'] },
  { id:'contactos', label:'Contactos' },
]

export default function FlotaHub({ onNavigate, focusId, focusType }) {
  const { rol } = useAuth()
  const tabs = TABS.filter(tab => !tab.hideFor?.includes(rol))
  const [activeTab, setActiveTab] = useState(() => ({
    activo:'vehiculos',
    ticket:'tickets',
    plan:'preventivo',
    documento_flota:'documentos',
  }[focusType] || 'resumen'))
  const ActiveView = VIEWS[activeTab] || FlotaResumen

  return (
    <WorkspaceTabs title="Flota" subtitle="Vehículos, matafuegos, documentación y mantenimiento preventivo" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} rightSlot={<ContactosQuickBtn modulo="flota" />}>
      <ActiveView onNavigate={onNavigate} onGoTab={setActiveTab} focusId={focusId} />
    </WorkspaceTabs>
  )
}
