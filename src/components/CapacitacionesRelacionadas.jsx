import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CapacitacionesRelacionadas({ sedeId = null, personaId = null, title = 'Capacitaciones' }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    let cancelled = false
    async function load() {
      let rows = []
      if (personaId) {
        const { data } = await supabase.schema('bitacora').from('capacitacion_asistentes')
          .select('estado, capacitacion:capacitaciones(id,titulo,fecha,estado,sede_id,instructor_nombre,sedes(nombre))')
          .eq('persona_id', personaId).eq('estado', 'presente')
        rows = (data || []).map(row => ({ ...row.capacitacion, asistencia:row.estado }))
      } else if (sedeId) {
        const { data } = await supabase.schema('bitacora').from('capacitaciones')
          .select('id,titulo,fecha,estado,instructor_nombre,capacitacion_asistentes(estado)')
          .eq('sede_id', sedeId).order('fecha', { ascending:false })
        rows = data || []
      }
      if (!cancelled) setItems(rows)
    }
    load().catch(console.error)
    return () => { cancelled = true }
  }, [personaId, sedeId])

  if (!items.length) return null
  return <section className="glass p-4" style={{ marginTop:16 }}>
    <h3 style={{ color:'var(--phosphor)', fontSize:'.8rem', textTransform:'uppercase', marginBottom:10 }}>{title}</h3>
    <div style={{ display:'grid', gap:8 }}>
      {items.map(item => {
        const attendance = item.capacitacion_asistentes || []
        const present = attendance.filter(row => row.estado === 'presente').length
        const total = attendance.length
        return <div key={item.id} style={{ border:'1px solid var(--line)', padding:'10px 12px', borderRadius:4 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
            <strong style={{ fontSize:'.82rem' }}>{item.titulo}</strong><span style={{ color:'var(--text-dim)', fontSize:'.72rem' }}>{item.fecha}</span>
          </div>
          <p style={{ color:'var(--text-dim)', fontSize:'.72rem', marginTop:4 }}>{item.instructor_nombre}{item.sedes?.nombre ? ` · ${item.sedes.nombre}` : ''}</p>
          {total > 0 && <p style={{ color:'var(--phosphor)', fontSize:'.7rem', marginTop:4 }}>{present}/{total} presentes · {Math.round((present / total) * 100)}% de asistencia</p>}
        </div>
      })}
    </div>
  </section>
}
