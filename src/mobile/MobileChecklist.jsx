import { useState, useEffect } from 'react'
import { getChecklistItems, getChecklistHoy, createChecklist, getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { ChevronLeft, CheckSquare, Square, Check } from 'lucide-react'

const TIPO_LABELS = {
  apertura: { label: 'Apertura', emoji: '🌅', color: '#39FF14' },
  cierre:   { label: 'Cierre',   emoji: '🌙', color: '#F59E0B' },
}

export default function MobileChecklist({ onBack }) {
  const { perfil, allowedSedeIds } = useAuth()
  const [tipo,      setTipo]      = useState(null)    // 'apertura' | 'cierre'
  const [sedes,     setSedes]     = useState([])
  const [sedeId,    setSedeId]    = useState(null)
  const [items,     setItems]     = useState([])      // template items
  const [checks,    setChecks]    = useState({})      // { item_id: true/false }
  const [obs,       setObs]       = useState('')
  const [yaHecho,   setYaHecho]   = useState(null)    // checklist existente de hoy
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    getSedes(allowedSedeIds?.length ? allowedSedeIds : null).then(list => {
      setSedes(list)
      if (list.length === 1) setSedeId(list[0].id)
    })
  }, [allowedSedeIds])

  useEffect(() => {
    if (!tipo || !sedeId) return
    setLoadingItems(true)
    setChecks({})
    setYaHecho(null)
    Promise.all([
      getChecklistItems(tipo),
      getChecklistHoy(sedeId, tipo),
    ]).then(([tmpl, existente]) => {
      setItems(tmpl)
      if (existente) {
        setYaHecho(existente)
        setChecks(existente.items || {})
        setObs(existente.observaciones || '')
      } else {
        const init = {}
        tmpl.forEach(i => { init[i.id] = false })
        setChecks(init)
      }
    }).finally(() => setLoadingItems(false))
  }, [tipo, sedeId])

  const toggle = (id) => {
    if (yaHecho) return  // readonly si ya fue enviado
    setChecks(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const okCount    = Object.values(checks).filter(Boolean).length
  const totalCount = items.length
  const pct        = totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 0

  const handleSubmit = async () => {
    if (!sedeId || !tipo) return
    setLoading(true)
    const sedeSel = sedes.find(s => s.id === sedeId)
    try {
      await createChecklist({
        sede_id:        sedeId,
        sede_nombre:    sedeSel?.nombre || '',
        tipo,
        turno:          null,
        fecha:          new Date().toISOString().slice(0, 10),
        operador_id:    perfil?.id   || null,
        operador_nombre: perfil?.nombre || '',
        items:          checks,
        items_ok:       okCount,
        items_total:    totalCount,
        observaciones:  obs || null,
      })
      setSubmitted(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Agrupar items por categoría
  const byCat = {}
  for (const item of items) {
    if (!byCat[item.categoria]) byCat[item.categoria] = []
    byCat[item.categoria].push(item)
  }

  // ── Pantalla de éxito ──
  if (submitted) {
    return (
      <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'2rem' }}>
        <div style={{ fontSize:'3rem' }}>✓</div>
        <p style={{ color:'var(--phosphor)', fontWeight:700, fontSize:'1.1rem' }}>
          Checklist enviado
        </p>
        <p style={{ color:'var(--text-dim)', fontSize:'0.85rem', textAlign:'center' }}>
          {okCount}/{totalCount} ítems completados ({pct}%)
        </p>
        <button onClick={onBack} style={{
          marginTop:'0.5rem', padding:'0.75rem 2rem', borderRadius:8,
          background:'var(--phosphor)', color:'#0A0A0E', fontWeight:700, border:'none', cursor:'pointer',
        }}>
          Volver
        </button>
      </div>
    )
  }

  // ── Selector de tipo ──
  if (!tipo) {
    return (
      <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'0.85rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', padding:'0.2rem' }}>
            <ChevronLeft size={22} />
          </button>
          <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem', margin:0 }}>Checklist</h2>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'2rem' }}>
          <p style={{ color:'var(--text-dim)', fontSize:'0.85rem', marginBottom:'0.5rem' }}>¿Qué checklist querés completar?</p>
          {Object.entries(TIPO_LABELS).map(([key, info]) => (
            <button key={key} onClick={() => setTipo(key)} style={{
              width:'100%', padding:'1.25rem', borderRadius:10, cursor:'pointer',
              background:'var(--surface)', border:`1.5px solid ${info.color}33`,
              display:'flex', alignItems:'center', gap:'1rem',
              transition:'all 0.15s',
            }}>
              <span style={{ fontSize:'1.8rem' }}>{info.emoji}</span>
              <div style={{ textAlign:'left' }}>
                <p style={{ color:info.color, fontWeight:700, fontSize:'1rem' }}>{info.label}</p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', marginTop:2 }}>
                  {key === 'apertura' ? 'Verificación al inicio del turno' : 'Control al cierre del turno'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const tipoInfo = TIPO_LABELS[tipo]

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'0.85rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <button onClick={() => setTipo(null)} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', padding:'0.2rem' }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex:1 }}>
          <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem', margin:0 }}>
            {tipoInfo.emoji} Checklist de {tipoInfo.label}
          </h2>
          {yaHecho && (
            <p style={{ color:'var(--warn)', fontSize:'0.65rem', marginTop:2 }}>Ya completado hoy · {yaHecho.items_ok}/{yaHecho.items_total} ítems</p>
          )}
        </div>
        {totalCount > 0 && (
          <div style={{ textAlign:'right' }}>
            <p style={{ color: tipoInfo.color, fontWeight:700, fontSize:'1rem' }}>{pct}%</p>
            <p style={{ color:'var(--text-dim)', fontSize:'0.6rem' }}>{okCount}/{totalCount}</p>
          </div>
        )}
      </div>

      {/* Sede selector (si hay más de una) */}
      {sedes.length > 1 && (
        <div style={{ padding:'0.75rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
          <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.4rem' }}>
            Sede *
          </p>
          <select value={sedeId || ''} onChange={e => setSedeId(Number(e.target.value))}
            style={{ width:'100%', padding:'0.65rem 0.9rem', borderRadius:8, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text)', fontSize:'0.88rem' }}>
            <option value="">Seleccioná una sede</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Body */}
      <div className="mobile-scroll" style={{ flex:1, padding:'0.75rem 1rem' }}>
        {loadingItems ? (
          <div style={{ display:'flex', justifyContent:'center', paddingTop:'3rem' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : !sedeId ? (
          <p style={{ color:'var(--text-dim)', textAlign:'center', paddingTop:'2rem', fontSize:'0.85rem' }}>Seleccioná una sede</p>
        ) : (
          Object.entries(byCat).map(([cat, catItems]) => (
            <div key={cat} style={{ marginBottom:'1.25rem' }}>
              <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.5rem' }}>
                {cat}
              </p>
              {catItems.map(item => {
                const checked = checks[item.id] === true
                return (
                  <button key={item.id} onClick={() => toggle(item.id)} style={{
                    width:'100%', display:'flex', alignItems:'flex-start', gap:'0.75rem',
                    padding:'0.75rem 0.85rem', borderRadius:8, marginBottom:'0.35rem',
                    background: checked ? `${tipoInfo.color}12` : 'var(--surface)',
                    border: checked ? `1.5px solid ${tipoInfo.color}44` : '1.5px solid rgba(255,255,255,0.07)',
                    cursor: yaHecho ? 'default' : 'pointer',
                    textAlign:'left', transition:'all 0.12s',
                  }}>
                    <span style={{ color: checked ? tipoInfo.color : 'var(--text-dim)', flexShrink:0, marginTop:1 }}>
                      {checked ? <Check size={17} /> : <Square size={17} />}
                    </span>
                    <span style={{ color: checked ? 'var(--text)' : 'var(--text-dim)', fontSize:'0.85rem', lineHeight:1.4 }}>
                      {item.texto}
                    </span>
                  </button>
                )
              })}
            </div>
          ))
        )}

        {/* Observaciones */}
        {items.length > 0 && (
          <div style={{ marginBottom:'1rem' }}>
            <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.4rem' }}>
              Observaciones (opcional)
            </p>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              disabled={!!yaHecho}
              rows={3}
              placeholder="Novedades adicionales del checklist..."
              style={{
                width:'100%', padding:'0.65rem 0.75rem', borderRadius:8, resize:'none',
                background:'var(--surface)', border:'1px solid rgba(255,255,255,0.1)',
                color:'var(--text)', fontSize:'0.85rem', fontFamily:'inherit', boxSizing:'border-box',
                opacity: yaHecho ? 0.6 : 1,
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      {!yaHecho && items.length > 0 && (
        <div style={{ padding:'0.85rem 1rem', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          <button onClick={handleSubmit} disabled={loading || !sedeId} style={{
            width:'100%', padding:'1rem', borderRadius:8,
            background: loading ? `${tipoInfo.color}66` : tipoInfo.color,
            color: '#0A0A0E', fontWeight:800, fontSize:'1rem',
            border:'none', cursor: loading || !sedeId ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Guardando...' : `Enviar checklist (${okCount}/${totalCount})`}
          </button>
        </div>
      )}
    </div>
  )
}
