import { useState, useEffect } from 'react'
import { getDirectorio } from '../lib/queries'

const MODULO_ORDER = ['rrhh', 'mantenimiento', 'flota', 'compras', 'calidad', 'emergencias']
const MODULO_META = {
  rrhh:          { label: 'Recursos Humanos',  desc: 'Consultas, solicitudes y gestiones de RRHH' },
  mantenimiento: { label: 'Mantenimiento',      desc: 'Técnicos, proveedores y emergencia técnica' },
  flota:         { label: 'Flota',              desc: 'Grúas, seguros, ART flota y soporte' },
  compras:       { label: 'Compras',            desc: 'Equipo de compras y proveedores clave' },
  calidad:       { label: 'Calidad',            desc: 'Referentes de calidad, auditorías y BPM' },
  emergencias:   { label: 'Emergencias',        desc: 'Números de emergencia y servicios críticos' },
}

function ContactCard({ c }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 10,
      padding: '0.85rem 1rem', marginBottom: '0.6rem',
      border: '1px solid rgba(57,255,20,0.08)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:'0.7rem', marginBottom:'0.65rem' }}>
        <span style={{ fontSize:'1.35rem', flexShrink:0, marginTop:1 }}>{c.icono}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.88rem', marginBottom:2 }}>{c.nombre}</p>
          {c.descripcion && <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', lineHeight:1.4, marginBottom:3 }}>{c.descripcion}</p>}
          <p style={{ color:'var(--phosphor)', fontSize:'0.75rem', fontFamily:'monospace', opacity:0.8 }}>{c.telefono}</p>
        </div>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <a href={`tel:+${c.tel}`} style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.25)', color:'var(--phosphor)', borderRadius:6, padding:'0.45rem 0.9rem', fontSize:'0.75rem', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
          📞 Llamar
        </a>
        {c.wa && (
          <a href={`https://wa.me/${c.wa}`} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.25)', color:'#25d366', borderRadius:6, padding:'0.45rem 0.9rem', fontSize:'0.75rem', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
            💬 WhatsApp
          </a>
        )}
        {c.email && (
          <a href={`mailto:${c.email}`} style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(99,179,237,0.1)', border:'1px solid rgba(99,179,237,0.25)', color:'#63b3ed', borderRadius:6, padding:'0.45rem 0.9rem', fontSize:'0.75rem', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
            📧 Email
          </a>
        )}
      </div>
    </div>
  )
}

export default function MobileContactos() {
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDirectorio()
      .then(data => setContactos(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Agrupar por módulo
  const byModulo = {}
  for (const c of contactos) {
    if (!byModulo[c.modulo]) byModulo[c.modulo] = []
    byModulo[c.modulo].push(c)
  }
  const sections = MODULO_ORDER.filter(k => byModulo[k]?.length > 0)

  return (
    <div className="mobile-scroll" style={{ padding:'0 1rem 2rem', height:'100%', overflowY:'auto' }}>
      <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem', paddingTop:'1rem', marginBottom:'0.25rem' }}>
        Directorio de contactos
      </h2>
      <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', marginBottom:'0.5rem' }}>
        Llamá o escribí por WhatsApp directamente desde acá
      </p>

      {loading && (
        <div style={{ display:'flex', justifyContent:'center', marginTop:'2rem' }}>
          <div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && sections.length === 0 && (
        <p style={{ color:'var(--text-dim)', fontSize:'0.8rem', marginTop:'1.5rem', textAlign:'center' }}>
          Sin contactos cargados todavía.
        </p>
      )}

      {sections.map(key => {
        const meta = MODULO_META[key] || { label: key, desc: '' }
        return (
          <div key={key} style={{ marginTop:'1.5rem' }}>
            <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.88rem', marginBottom:3 }}>{meta.label}</p>
            <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', marginBottom:'0.75rem' }}>{meta.desc}</p>
            {byModulo[key].map(c => <ContactCard key={c.id} c={c} />)}
          </div>
        )
      })}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
