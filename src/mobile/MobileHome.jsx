import { useState, useEffect } from 'react'
import { getMisRegistrosHoy, getMisTareas, getDirectorio } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search } from 'lucide-react'

const MODULO_ORDER = ['direccion', 'rrhh', 'mantenimiento', 'flota', 'compras', 'calidad', 'emergencias']
const MODULO_LABEL = { direccion:'Dirección / Operaciones', rrhh:'RRHH', mantenimiento:'Mantenimiento', flota:'Flota', compras:'Compras', calidad:'Calidad', emergencias:'Emergencias' }

function ContactoChip({ c }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:8, padding:'0.65rem 0.75rem', border:'1px solid rgba(57,255,20,0.07)', display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{c.icono}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.78rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nombre}</p>
        <p style={{ color:'var(--phosphor)', fontSize:'0.65rem', fontFamily:'monospace', opacity:0.75 }}>{c.telefono}</p>
      </div>
      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
        <a href={`tel:+${c.tel}`} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.2)', color:'var(--phosphor)', borderRadius:5, textDecoration:'none', fontSize:'0.85rem' }}>📞</a>
        {c.wa && <a href={`https://wa.me/${c.wa}`} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.22)', color:'#25d366', borderRadius:5, textDecoration:'none', fontSize:'0.85rem' }}>💬</a>}
      </div>
    </div>
  )
}

function ContactosRapidos() {
  const [contactos, setContactos] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getDirectorio().then(data => setContactos(data || [])).catch(() => {})
  }, [])

  const byModulo = {}
  for (const c of contactos) {
    if (!byModulo[c.modulo]) byModulo[c.modulo] = []
    byModulo[c.modulo].push(c)
  }
  const sections = MODULO_ORDER.filter(k => byModulo[k]?.length > 0)
  if (sections.length === 0) return null

  return (
    <section style={{ marginBottom:'1rem' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:'none', border:'none', cursor:'pointer', padding:'0.4rem 0', marginBottom: open ? '0.75rem' : 0 }}
      >
        <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'var(--font-metric)', margin:0 }}>
          📞 Contactos rápidos
        </p>
        <span style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
          {sections.map(key => (
            <div key={key}>
              <p style={{ color:'rgba(57,255,20,0.45)', fontSize:'0.6rem', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.4rem', fontFamily:'var(--font-metric)' }}>
                {MODULO_LABEL[key]}
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {byModulo[key].map(c => <ContactoChip key={c.id} c={c} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const ESTADO_STYLE = {
  'Sin novedades':          { bg: 'rgba(57,255,20,0.12)', color: '#39FF14', label: 'Sin Novedades' },
  'Hay novedades':          { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Hay Novedades' },
  'Operación condicionada': { bg: 'rgba(255,42,42,0.12)',  color: '#FF2A2A', label: 'Op. Condicionada' },
}

export default function MobileHome({ onNuevoReporte, onOpenSearch }) {
  const { perfil } = useAuth()
  const [registros, setRegistros] = useState([])
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!perfil) return
    Promise.all([
      getMisRegistrosHoy(perfil.email),
      getMisTareas(perfil.id),
    ]).then(([r, t]) => { setRegistros(r); setTareas(t) })
      .finally(() => setLoading(false))
  }, [perfil])

  const fecha = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  const nombre = perfil?.nombre?.split(' ')[0] || 'Usuario'

  return (
    <div className="mobile-scroll" style={{ padding: '1.25rem 1rem 1rem', height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-metric)' }}>
          {fecha}
        </p>
        <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem' }}>
          Hola, {nombre}
        </h1>
      </div>

      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          className="input-dark"
          style={{
            width:'100%', minHeight:44, marginBottom:'1rem', display:'flex',
            alignItems:'center', gap:8, color:'var(--text-dim)', textAlign:'left',
          }}
        >
          <Search size={15} style={{ color:'var(--phosphor)', flexShrink:0 }} />
          Buscar en toda la aplicación...
        </button>
      )}

      {/* Boton principal */}
      {onNuevoReporte && <button onClick={onNuevoReporte}
        style={{
          width: '100%', padding: '1rem', borderRadius: 8,
          background: 'var(--phosphor)', color: '#0A0A0E',
          fontWeight: 700, fontSize: '1rem', letterSpacing: '0.02em',
          border: 'none', cursor: 'pointer', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
        }}>
        + Cargar Reporte de Hoy
      </button>}

      {/* Mis reportes de hoy */}
      <section style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.6rem', fontFamily: 'var(--font-metric)' }}>
          Mis reportes hoy ({registros.length})
        </p>
        {loading ? (
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : registros.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Sin reportes cargados hoy</p>
          </div>
        ) : registros.map(r => {
          const st = ESTADO_STYLE[r.estado_general] || ESTADO_STYLE['Sin novedades']
          return (
            <div key={r.id} style={{
              background: 'var(--surface)', borderRadius: 8, padding: '0.85rem 1rem',
              marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderLeft: `3px solid ${st.color}`
            }}>
              <div>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem' }}>
                  {r.sedes?.nombre || r.sede_nombre || 'Sede'}
                </p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 2 }}>
                  {format(new Date(r.fecha_reporte), 'HH:mm')} hs
                </p>
              </div>
              <span style={{ background: st.bg, color: st.color, fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 600 }}>
                {st.label}
              </span>
            </div>
          )
        })}
      </section>

      {/* Mis tareas */}
      <section style={{ marginBottom: '1rem' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.6rem', fontFamily: 'var(--font-metric)' }}>
          Mis tareas pendientes ({tareas.length})
        </p>
        {tareas.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Sin tareas pendientes</p>
          </div>
        ) : tareas.slice(0, 3).map(t => (
          <div key={t.id} style={{
            background: 'var(--surface)', borderRadius: 8, padding: '0.85rem 1rem',
            marginBottom: '0.5rem',
          }}>
            <p style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: 500 }}>{t.titulo}</p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 2 }}>
              {t.sedes?.nombre || '—'} · {t.prioridad}
            </p>
          </div>
        ))}
        {tareas.length > 3 && (
          <p style={{ color: 'var(--phosphor)', fontSize: '0.72rem', textAlign: 'center', marginTop: '0.5rem' }}>
            +{tareas.length - 3} mas en Tareas
          </p>
        )}
      </section>

      <ContactosRapidos />
    </div>
  )
}
