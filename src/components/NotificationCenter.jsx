import { useCallback, useEffect, useState, useRef } from 'react'
import { Bell, CheckCheck, X, Check, Circle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { db } from '../lib/supabase'

const PAGE = 25

const ENTITY_VIEW = {
  no_conformidad: 'calidadHub',
  ticket:         'mantenimientoHub',
  requerimiento:  'requerimientos',
  capa:           'calidadHub',
  registro:       'sedesHub',
  tarea:          'tareas',
  escalamiento:   'escalamientos',
  anuncio:        'tablon',
  lote_preventivo:'mantenimientoHub',
}

// Etiqueta de contexto según el tipo de entidad (o del comentario padre).
const TIPO_LABEL = {
  comentario: 'Comentario',
  registro: 'Novedad',
  tarea: 'Tarea',
  escalamiento: 'Escalamiento',
  no_conformidad: 'No conformidad',
  capa: 'CAPA',
  requerimiento: 'Compra',
  ticket: 'Ticket',
  anuncio: 'Tablón',
  lote_preventivo: 'Preventivo',
}

function tiempoRelativo(iso) {
  const d = new Date(iso)
  const seg = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seg < 60) return 'recién'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const hs = Math.floor(min / 60)
  if (hs < 24) return `hace ${hs} h`
  const dias = Math.floor(hs / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return d.toLocaleDateString('es-AR')
}

function grupoDe(iso) {
  const d = new Date(iso)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const dd = new Date(d); dd.setHours(0, 0, 0, 0)
  const diff = Math.round((hoy - dd) / 86400000)
  if (diff <= 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) return 'Esta semana'
  return 'Antes'
}

export default function NotificationCenter({ onNavigate }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('unread')        // 'unread' | 'all'
  const [unreadCount, setUnreadCount] = useState(0)
  const [limit, setLimit] = useState(PAGE)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef()

  const loadCount = useCallback(async () => {
    if (!user?.id) return
    const { count } = await db().from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_id', user.id).is('leida_at', null)
    setUnreadCount(count || 0)
  }, [user?.id])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    let q = db().from('notificaciones').select('*')
      .eq('destinatario_id', user.id)
      .order('created_at', { ascending: false }).limit(limit)
    if (tab === 'unread') q = q.is('leida_at', null)
    const { data, error } = await q
    if (!error) setItems(data || [])
    setLoading(false)
  }, [user?.id, tab, limit])

  useEffect(() => { loadCount(); const i = setInterval(loadCount, 60_000); return () => clearInterval(i) }, [loadCount])
  useEffect(() => { if (open) load() }, [open, load])

  // Cerrar al clickear afuera
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const marcarLeida = async (item, leida) => {
    const val = leida ? new Date().toISOString() : null
    await db().from('notificaciones').update({ leida_at: val }).eq('id', item.id)
    setItems(prev => tab === 'unread' && leida
      ? prev.filter(n => n.id !== item.id)
      : prev.map(n => n.id === item.id ? { ...n, leida_at: val } : n))
    loadCount()
  }

  const openItem = async item => {
    if (!item.leida_at) await marcarLeida(item, true)

    let tipo = item.entidad_tipo
    let id = item.entidad_id
    if (tipo === 'comentario' && id) {
      try {
        const { data } = await db().from('comentarios')
          .select('entidad_tipo, entidad_id').eq('id', id).maybeSingle()
        if (data?.entidad_tipo) { tipo = data.entidad_tipo; id = data.entidad_id }
      } catch (_) { /* seguimos con lo que hay */ }
    }
    if (tipo && id) {
      window.__pendingDeepLink = { tipo, id }
      window.dispatchEvent(new CustomEvent('bitacora:deeplink', { detail: { tipo, id } }))
    }
    const view = (tipo && ENTITY_VIEW[tipo]) ||
      (item.url ? new URL(item.url, window.location.origin).searchParams.get('view') : null)
    if (view && onNavigate) onNavigate(view)
    else if (item.url) window.location.assign(item.url)
    setOpen(false)
  }

  const markAll = async () => {
    const now = new Date().toISOString()
    await db().from('notificaciones').update({ leida_at: now })
      .eq('destinatario_id', user.id).is('leida_at', null)
    setItems(prev => tab === 'unread' ? [] : prev.map(n => ({ ...n, leida_at: n.leida_at || now })))
    setUnreadCount(0)
  }

  // Agrupar por fecha manteniendo el orden
  const grupos = []
  let gActual = null
  items.forEach(it => {
    const g = grupoDe(it.created_at)
    if (g !== gActual) { grupos.push({ grupo: g, items: [] }); gActual = g }
    grupos[grupos.length - 1].items.push(it)
  })

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(v => !v); if (!open) { setLimit(PAGE); } }} className="btn-ghost" title="Notificaciones"
        style={{ padding: '0.3rem', position: 'relative', color: unreadCount ? '#FF5050' : 'var(--text-dim)' }}>
        <Bell size={13} />
        {unreadCount > 0 && <span style={{ position: 'absolute', top: -4, right: -5, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 8, background: '#FF2A2A', color: '#fff', fontSize: '0.6rem', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <div ref={panelRef} style={{ position: 'fixed', right: 12, top: 48, zIndex: 100, width: 'min(380px,calc(100vw - 24px))', maxHeight: '75vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid rgba(57,255,20,0.18)', borderRadius: 5, boxShadow: '0 18px 50px rgba(0,0,0,0.55)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <strong style={{ color: 'var(--text)', fontSize: '0.75rem' }}>Notificaciones</strong>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={markAll} className="btn-ghost" title="Marcar todas como leídas" style={{ padding: '0.2rem' }}><CheckCheck size={12} /></button>
              <button onClick={() => setOpen(false)} className="btn-ghost" style={{ padding: '0.2rem' }}><X size={12} /></button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            {[['unread', `No leídas${unreadCount ? ` · ${unreadCount}` : ''}`], ['all', 'Todas']].map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setLimit(PAGE) }} style={{
                padding: '0.25rem 0.7rem', borderRadius: 14, fontSize: '0.64rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: tab === id ? 'rgba(57,255,20,0.15)' : 'transparent',
                color: tab === id ? 'var(--phosphor)' : 'var(--text-dim)',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && items.length === 0 ? (
              <p style={{ padding: '1.25rem', color: 'var(--text-dim)', fontSize: '0.7rem', textAlign: 'center' }}>Cargando...</p>
            ) : items.length === 0 ? (
              <p style={{ padding: '1.25rem', color: 'var(--text-dim)', fontSize: '0.7rem', textAlign: 'center' }}>
                {tab === 'unread' ? 'Estás al día. No hay notificaciones sin leer.' : 'No hay notificaciones.'}
              </p>
            ) : grupos.map(({ grupo, items: gItems }) => (
              <div key={grupo}>
                <p style={{ padding: '6px 12px 2px', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', textTransform: 'uppercase', background: 'rgba(255,255,255,0.02)' }}>{grupo}</p>
                {gItems.map(item => {
                  const tag = TIPO_LABEL[item.entidad_tipo] || item.modulo
                  const noLeida = !item.leida_at
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'stretch', background: noLeida ? 'rgba(255,42,42,0.05)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <button onClick={() => openItem(item)} style={{ flex: 1, textAlign: 'left', padding: '10px 4px 10px 12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {noLeida && <Circle size={7} fill="#FF5050" color="#FF5050" style={{ flexShrink: 0 }} />}
                          <p style={{ color: noLeida ? 'var(--text)' : 'var(--text-dim)', fontSize: '0.7rem', fontWeight: 700, margin: 0 }}>{item.titulo}</p>
                        </div>
                        {item.cuerpo && <p style={{ color: 'var(--text-dim)', fontSize: '0.63rem', margin: '2px 0 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.cuerpo}</p>}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                          {tag && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--phosphor)', background: 'rgba(57,255,20,0.1)', padding: '1px 6px', borderRadius: 4 }}>{tag}</span>}
                          <span title={new Date(item.created_at).toLocaleString('es-AR')} style={{ color: 'rgba(107,114,128,0.7)', fontSize: '0.58rem' }}>{tiempoRelativo(item.created_at)}</span>
                        </div>
                      </button>
                      <button onClick={() => marcarLeida(item, noLeida)} title={noLeida ? 'Marcar como leída' : 'Marcar como no leída'}
                        className="btn-ghost" style={{ padding: '0 10px', display: 'flex', alignItems: 'center', color: noLeida ? 'var(--phosphor)' : 'rgba(107,114,128,0.5)' }}>
                        {noLeida ? <Check size={13} /> : <Circle size={11} />}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
            {!loading && items.length >= limit && (
              <button onClick={() => setLimit(l => l + PAGE)} className="btn-ghost" style={{ width: '100%', padding: '10px', fontSize: '0.65rem', color: 'var(--phosphor)' }}>
                Ver más
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
