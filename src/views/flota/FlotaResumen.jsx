import { useState, useEffect, useMemo } from 'react'
import { getActivos, getMatafuegos, getPoes } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'

const DOC_FIELDS = ['vencimiento_seguro','vencimiento_vtv','vencimiento_senasa','vencimiento_rmtsa']

function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:3, padding:'1rem 1.2rem', flex:1, minWidth:120 }}>
      <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.35rem' }}>{label}</p>
      <p style={{ color:color||'var(--text)', fontWeight:800, fontSize:'2rem', lineHeight:1 }}>{value??'—'}</p>
      {sub && <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:3 }}>{sub}</p>}
    </div>
  )
}

export default function FlotaResumen({ onGoTab }) {
  const [vehiculos, setVehiculos]   = useState([])
  const [matafuegos, setMatafuegos] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [tickets, setTickets]       = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getActivos({ tipo:'VEHICULO' }).catch(() => []),
      getMatafuegos().catch(() => []),
      getPoes().catch(() => []),
      supabase.schema('mantenimiento').from('tickets').select('id,estado').eq('categoria','Vehiculos')
        .then(r => r.data || []).catch(() => []),
    ]).then(([v, m, d, t]) => {
      setVehiculos(v); setMatafuegos(m); setDocumentos(d); setTickets(t)
    }).finally(() => setLoading(false))
  }, [])

  const hoy = new Date().toISOString().split('T')[0]

  const vehiculosDocVencida = useMemo(() =>
    vehiculos.filter(v => DOC_FIELDS.some(f => v[f] && v[f] < hoy)).length
  , [vehiculos, hoy])

  const matafuegosFlota   = useMemo(() => matafuegos.filter(m => m.activo_id), [matafuegos])
  const matafuegosVencidos = matafuegosFlota.filter(m => m.vencimiento && m.vencimiento < hoy).length

  const documentosVencidos = documentos.filter(d => d.vencimiento && d.vencimiento < hoy).length
  const documentosPorVencer = documentos.filter(d => {
    if (!d.vencimiento) return false
    const diff = (new Date(d.vencimiento) - new Date()) / 86400000
    return diff >= 0 && diff <= 30
  }).length

  const ticketsAbiertos = tickets.filter(t => t.estado !== 'resuelto' && t.estado !== 'rechazado').length

  const accesos = [
    { label:'Vehículos',  tab:'vehiculos',  icon:'🚚' },
    { label:'Tickets',    tab:'tickets',    icon:'🎫' },
    { label:'Preventivo', tab:'preventivo', icon:'📋' },
    { label:'Matafuegos', tab:'matafuegos', icon:'🧯' },
    { label:'Documentos', tab:'documentos', icon:'📄' },
  ]

  return (
    <div style={{ padding:'1.5rem 2rem', overflowY:'auto', height:'100%' }}>
      <PageHeader title="Flota" subtitle="Vehículos, matafuegos, documentación y mantenimiento preventivo" />

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
          <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
        </div>
      ) : (<>
        <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', marginBottom:'0.6rem' }}>
          <KPI label="Vehículos"            value={vehiculos.length}      color="var(--phosphor)" />
          <KPI label="Tickets abiertos"     value={ticketsAbiertos}       color="#F97316" />
          <KPI label="Doc. vehículo vencida" value={vehiculosDocVencida}  sub="seguro / VTV / SENASA / RTO" color="#FF2A2A" />
          <KPI label="Matafuegos vencidos"  value={matafuegosVencidos}    sub={`de ${matafuegosFlota.length} en flota`} color="#FF2A2A" />
          <KPI label="POEs/doc. vencidos"   value={documentosVencidos}    sub={`${documentosPorVencer} por vencer (30d)`} color="#F59E0B" />
        </div>

        <div style={{ display:'flex', gap:'0.55rem', flexWrap:'wrap', marginTop:'1.25rem' }}>
          {accesos.map(a => (
            <button key={a.tab} onClick={() => onGoTab?.(a.tab)}
              style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.05)', borderRadius:3,
                padding:'0.75rem 1rem', cursor:'pointer', textAlign:'left', minWidth:90 }}>
              <p style={{ fontSize:'1.2rem', marginBottom:2 }}>{a.icon}</p>
              <p style={{ color:'var(--text)', fontWeight:600, fontSize:'0.75rem' }}>{a.label}</p>
            </button>
          ))}
        </div>
      </>)}
    </div>
  )
}
