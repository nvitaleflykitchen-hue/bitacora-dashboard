import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getSedes, getVuelosPlantilla, getVuelosCalendarioMes, getUltimoMesVuelosCalendario, crearVueloPlantilla, actualizarVueloPlantilla, eliminarVueloPlantilla } from '../lib/queries'
import { Plus, Trash2, RefreshCw, CalendarDays } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { confirmar } from '../lib/feedback'

// Misma convención que sedes.dias_operacion: 0=domingo..6=sábado.
// Se muestran en orden de semana laboral (Lunes primero).
const DIAS = [
  { v: 1, label: 'Lunes' },
  { v: 2, label: 'Martes' },
  { v: 3, label: 'Miércoles' },
  { v: 4, label: 'Jueves' },
  { v: 5, label: 'Viernes' },
  { v: 6, label: 'Sábado' },
  { v: 0, label: 'Domingo' },
]

const INP = {
  padding: '0.35rem 0.5rem', borderRadius: 4, background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', fontSize: '0.75rem',
  fontFamily: 'inherit', colorScheme: 'dark', width: '100%',
}

function VueloRow({ vuelo, onSave, onDelete }) {
  const [form, setForm] = useState({
    vuelo_codigo: vuelo.vuelo_codigo || '',
    destino: vuelo.destino || '',
    aerolinea: vuelo.aerolinea || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const dirty = form.vuelo_codigo !== (vuelo.vuelo_codigo || '')
    || form.destino !== (vuelo.destino || '')
    || form.aerolinea !== (vuelo.aerolinea || '')

  const handleBlurSave = () => {
    if (!dirty || !form.vuelo_codigo.trim()) return
    onSave(vuelo.id, form)
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'110px 1fr 1fr 32px', gap:8, alignItems:'center', padding:'0.4rem 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <input style={INP} value={form.vuelo_codigo} onChange={e=>set('vuelo_codigo', e.target.value.toUpperCase())} onBlur={handleBlurSave} placeholder="Código" />
      <input style={INP} value={form.destino} onChange={e=>set('destino', e.target.value.toUpperCase())} onBlur={handleBlurSave} placeholder="Destino" />
      <input style={INP} value={form.aerolinea} onChange={e=>set('aerolinea', e.target.value)} onBlur={handleBlurSave} placeholder="Aerolínea" />
      <button onClick={()=>onDelete(vuelo.id)} className="btn-ghost" style={{ padding:'0.3rem', color:'var(--alert)' }} title="Eliminar">
        <Trash2 size={13}/>
      </button>
    </div>
  )
}

export default function VuelosPlantilla() {
  const [sedes, setSedes]       = useState([])
  const [sedeId, setSedeId]     = useState(null)
  const [modo, setModo]         = useState('calendario')
  const [mes, setMes]           = useState(() => new Date().toISOString().slice(0, 7))
  const [diaMes, setDiaMes]     = useState(1)
  const [calendario, setCalendario] = useState([])
  const [calError, setCalError] = useState('')
  const [calLoading, setCalLoading] = useState(false)
  const calendarRequest = useRef(0)
  const [vuelos, setVuelos]     = useState([])
  const [diaSel, setDiaSel]     = useState(1)
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)

  const loadSedes = useCallback(async () => {
    const data = await getSedes()
    const aeropuertos = (data || []).filter(s => s.tipo === 'Aeropuerto')
    setSedes(aeropuertos)
    const requested = sessionStorage.getItem('bitacora:openSedeId')
    if (requested) sessionStorage.removeItem('bitacora:openSedeId')
    const target = aeropuertos.find(s => String(s.id) === String(requested))
    setSedeId(target ? target.id : (aeropuertos[0]?.id ?? null))
  }, [])

  useEffect(() => { loadSedes() }, [loadSedes])

  const loadVuelos = useCallback(async () => {
    if (!sedeId) { setVuelos([]); setLoading(false); return }
    setLoading(true)
    const data = await getVuelosPlantilla(sedeId)
    setVuelos(data)
    setLoading(false)
  }, [sedeId])

  useEffect(() => { loadVuelos() }, [loadVuelos])

  useEffect(() => {
    if (!sedeId) return
    let active = true
    getUltimoMesVuelosCalendario(sedeId).then(ultimo => {
      if (active && ultimo) setMes(ultimo)
    }).catch(error => {
      if (active) setCalError(error.message || 'No se pudo consultar el calendario.')
    })
    return () => { active = false }
  }, [sedeId])

  const loadCalendario = useCallback(async () => {
    if (!sedeId || modo !== 'calendario') return
    const request = ++calendarRequest.current
    setCalLoading(true)
    setCalError('')
    try {
      const data = await getVuelosCalendarioMes(sedeId, mes)
      if (request !== calendarRequest.current) return
      setCalendario(data)
      setDiaMes(Number(data[0]?.fecha?.slice(-2) || 1))
    } catch (error) {
      if (request !== calendarRequest.current) return
      setCalendario([])
      setCalError(error.message || 'No se pudieron cargar los vuelos del mes.')
    } finally {
      if (request === calendarRequest.current) setCalLoading(false)
    }
  }, [sedeId, mes, modo])

  useEffect(() => { loadCalendario() }, [loadCalendario])

  const vuelosDia = vuelos.filter(v => v.dia_semana === diaSel).sort((a,b)=>a.orden-b.orden)
  const fechaSel = `${mes}-${String(diaMes).padStart(2, '0')}`
  const vuelosFecha = calendario.filter(v => v.fecha === fechaSel)
  const diasDelMes = /^\d{4}-\d{2}$/.test(mes) ? new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate() : 0
  const counts = calendario.reduce((acc, vuelo) => {
    const dia = Number(vuelo.fecha.slice(-2))
    acc[dia] = (acc[dia] || 0) + 1
    return acc
  }, {})

  const handleSave = async (id, form) => {
    await actualizarVueloPlantilla(id, form)
    loadVuelos()
  }

  const handleDelete = async (id) => {
    if (!await confirmar({ mensaje: '¿Eliminar este vuelo de la plantilla?', peligro: true, confirmText: 'Eliminar' })) return
    await eliminarVueloPlantilla(id)
    loadVuelos()
  }

  const handleAdd = async () => {
    setAdding(true)
    try {
      await crearVueloPlantilla({ sede_id: sedeId, dia_semana: diaSel, vuelo_codigo: 'NUEVO', orden: vuelosDia.length })
      await loadVuelos()
    } finally { setAdding(false) }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 fade-in">
      <PageHeader title="Plantilla de Vuelos" subtitle="Calendario real por fecha y cronograma semanal por escala">
        <button onClick={modo === 'calendario' ? loadCalendario : loadVuelos} className="btn-ghost" style={{ padding:'0.4rem' }} title="Actualizar vuelos">
          <RefreshCw size={13}/>
        </button>
      </PageHeader>

      {sedes.length === 0 ? (
        <p style={{ color:'var(--text-dim)', fontSize:'0.8rem' }}>No hay sedes tipo Aeropuerto configuradas.</p>
      ) : (
        <>
          <div style={{ display:'flex', gap:6, marginBottom:'0.85rem' }}>
            <button type="button" onClick={() => setModo('calendario')} className={modo === 'calendario' ? 'btn-primary' : 'btn-ghost'}><CalendarDays size={13}/> Calendario mensual</button>
            <button type="button" onClick={() => setModo('semanal')} className={modo === 'semanal' ? 'btn-primary' : 'btn-ghost'}>Plantilla semanal</button>
          </div>
          {/* Selector de sede (escala) */}
          <div style={{ display:'flex', gap:6, marginBottom:'1rem', flexWrap:'wrap' }}>
            {sedes.map(s => (
              <button key={s.id} onClick={()=>setSedeId(s.id)}
                style={{
                  padding:'0.4rem 0.85rem', borderRadius:4, fontSize:'0.72rem', cursor:'pointer',
                  background: sedeId===s.id ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.04)',
                  border: sedeId===s.id ? '1px solid rgba(57,255,20,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: sedeId===s.id ? 'var(--phosphor)' : 'var(--text)',
                }}>
                {s.nombre}
              </button>
            ))}
          </div>

          {modo === 'calendario' ? (
            <div className="glass rounded" style={{ borderRadius:3, padding:'1rem 1.25rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:14 }}>
                <div>
                  <h2 style={{ color:'var(--text)', fontSize:'0.95rem', fontWeight:700, margin:0 }}>Vuelos por fecha</h2>
                  <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', margin:'3px 0 0' }}>Estos vuelos aparecen en “Vuelos del día” al crear el reporte de cada fecha.</p>
                </div>
                <label style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>Mes <input type="month" value={mes} onChange={event => setMes(event.target.value)} style={{ ...INP, width:165, marginLeft:6 }}/></label>
              </div>
              {calError && <p role="alert" style={{ color:'#ff7070', fontSize:'0.75rem', marginBottom:10 }}>{calError}</p>}
              {calLoading ? <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Cargando calendario…</p> : (
                <>
                  <p style={{ color:'var(--phosphor)', fontSize:'0.7rem', marginBottom:12 }}>{calendario.length} vuelos en {new Set(calendario.map(v => v.fecha)).size} días</p>
                  {calendario.length === 0 && <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>No hay vuelos diarios cargados para este mes. La plantilla semanal sigue disponible como referencia.</p>}
                  {calendario.length > 0 && <>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(57px, 1fr))', gap:5, marginBottom:16 }}>
                      {Array.from({ length:diasDelMes }, (_, index) => index + 1).map(day => <button type="button" key={day} onClick={() => setDiaMes(day)} style={{ padding:'6px 4px', borderRadius:4, cursor:'pointer', background:day === diaMes ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.04)', color:day === diaMes ? 'var(--phosphor)' : 'var(--text-dim)', border:day === diaMes ? '1px solid rgba(57,255,20,0.35)' : '1px solid rgba(255,255,255,0.08)', fontSize:'0.68rem' }}>{day}<span style={{ display:'block', fontSize:'0.59rem' }}>{counts[day] || '—'}</span></button>)}
                    </div>
                    <h3 style={{ color:'var(--text)', fontSize:'0.82rem', fontWeight:700, marginBottom:8 }}>{new Date(`${fechaSel}T00:00:00Z`).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', timeZone:'UTC' })} · {vuelosFecha.length} vuelos</h3>
                    {vuelosFecha.length ? vuelosFecha.map(v => <div key={v.id} style={{ display:'grid', gridTemplateColumns:'120px 1fr 1fr', gap:10, padding:'9px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', color:'var(--text)', fontSize:'0.75rem' }}><strong>{v.vuelo_codigo}</strong><span>{v.destino || '—'}</span><span>{v.aerolinea || '—'}</span></div>) : <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>No hay vuelos cargados para esta fecha.</p>}
                  </>}
                </>
              )}
            </div>
          ) : <div className="glass rounded" style={{ borderRadius:3, padding:'1rem 1.25rem' }}>
            {/* Tabs de día de la semana */}
            <div style={{ display:'flex', gap:4, marginBottom:'1rem', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'0.75rem', flexWrap:'wrap' }}>
              {DIAS.map(d => {
                const count = vuelos.filter(v=>v.dia_semana===d.v).length
                return (
                  <button key={d.v} onClick={()=>setDiaSel(d.v)}
                    style={{
                      padding:'0.35rem 0.6rem', borderRadius:3, fontSize:'0.68rem', cursor:'pointer',
                      background: diaSel===d.v ? 'rgba(57,255,20,0.1)' : 'transparent',
                      color: diaSel===d.v ? 'var(--phosphor)' : 'var(--text-dim)',
                      border: diaSel===d.v ? '1px solid rgba(57,255,20,0.25)' : '1px solid transparent',
                      fontWeight: diaSel===d.v ? 600 : 400,
                    }}>
                    {d.label}{count>0 ? ` (${count})` : ''}
                  </button>
                )
              })}
            </div>

            {loading ? (
              <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Cargando...</p>
            ) : (
              <>
                {vuelosDia.length === 0 ? (
                  <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', padding:'0.5rem 0' }}>Sin vuelos programados para este día.</p>
                ) : (
                  <div>
                    {vuelosDia.map(v => (
                      <VueloRow key={v.id} vuelo={v} onSave={handleSave} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
                <button onClick={handleAdd} disabled={adding} className="btn-primary"
                  style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.7rem', padding:'0.4rem 0.9rem', marginTop:'0.75rem' }}>
                  <Plus size={12}/> {adding ? 'Agregando...' : 'Agregar vuelo'}
                </button>
              </>
            )}
          </div>}
        </>
      )}
    </div>
  )
}
