import { useState, useEffect, useCallback } from 'react'
import { getSedes, getVuelosPlantilla, crearVueloPlantilla, actualizarVueloPlantilla, eliminarVueloPlantilla } from '../lib/queries'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
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

  const vuelosDia = vuelos.filter(v => v.dia_semana === diaSel).sort((a,b)=>a.orden-b.orden)

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
      <PageHeader title="Plantilla de Vuelos" subtitle="Cronograma semanal por escala">
        <button onClick={loadVuelos} className="btn-ghost" style={{ padding:'0.4rem' }}>
          <RefreshCw size={13}/>
        </button>
      </PageHeader>

      {sedes.length === 0 ? (
        <p style={{ color:'var(--text-dim)', fontSize:'0.8rem' }}>No hay sedes tipo Aeropuerto configuradas.</p>
      ) : (
        <>
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

          <div className="glass rounded" style={{ borderRadius:3, padding:'1rem 1.25rem' }}>
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
          </div>
        </>
      )}
    </div>
  )
}
