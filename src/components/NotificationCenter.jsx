import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { db } from '../lib/supabase'

export default function NotificationCenter({ onNavigate }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])

  const load = useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await db().from('notificaciones').select('*')
      .eq('destinatario_id', user.id).order('created_at', { ascending:false }).limit(30)
    if (!error) setItems(data || [])
  }, [user?.id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  const unread = items.filter(item=>!item.leida_at).length
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

  const openItem = async item => {
    if (!item.leida_at) {
      const now = new Date().toISOString()
      await db().from('notificaciones').update({ leida_at:now }).eq('id', item.id)
      setItems(prev=>prev.map(n=>n.id===item.id?{...n,leida_at:now}:n))
    }

    let tipo = item.entidad_tipo
    let id   = item.entidad_id

    // Si es un comentario, resolver la entidad padre para navegar al origen real
    if (tipo === 'comentario' && id) {
      try {
        const { data } = await db()
          .from('comentarios')
          .select('entidad_tipo, entidad_id')
          .eq('id', id)
          .maybeSingle()
        if (data?.entidad_tipo) { tipo = data.entidad_tipo; id = data.entidad_id }
      } catch (_) { /* si falla, seguimos con lo que hay */ }
    }

    // Guardar deep-link para que la vista lo consuma al montar (o en tiempo real si ya está montada)
    if (tipo && id) {
      window.__pendingDeepLink = { tipo, id }
      window.dispatchEvent(new CustomEvent('bitacora:deeplink', { detail: { tipo, id } }))
    }

    // Vista destino: mapeo por tipo resuelto (más preciso que la URL hardcodeada)
    const view = (tipo && ENTITY_VIEW[tipo]) ||
      (item.url ? new URL(item.url, window.location.origin).searchParams.get('view') : null)

    if (view && onNavigate) onNavigate(view)
    else if (item.url) window.location.assign(item.url)
    setOpen(false)
  }

  const markAll = async () => {
    const now = new Date().toISOString()
    await db().from('notificaciones').update({ leida_at:now })
      .eq('destinatario_id', user.id).is('leida_at', null)
    setItems(prev=>prev.map(n=>({...n,leida_at:n.leida_at || now})))
  }

  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>{ setOpen(v=>!v); if (!open) load() }} className="btn-ghost" title="Notificaciones"
        style={{ padding:'0.3rem', position:'relative', color:unread?'#FF5050':'var(--text-dim)' }}>
        <Bell size={13}/>
        {unread > 0 && <span style={{ position:'absolute', top:-4, right:-5, minWidth:14, height:14, padding:'0 3px', borderRadius:8, background:'#FF2A2A', color:'#fff', fontSize:'0.6rem', display:'grid', placeItems:'center', fontWeight:800 }}>{unread>99?'99+':unread}</span>}
      </button>
      {open && (
        <div style={{ position:'fixed', right:12, top:48, zIndex:100, width:'min(360px,calc(100vw - 24px))', maxHeight:'70vh', overflowY:'auto', background:'var(--surface)', border:'1px solid rgba(57,255,20,0.18)', borderRadius:5, boxShadow:'0 18px 50px rgba(0,0,0,0.55)' }}>
          <div style={{ position:'sticky', top:0, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'var(--surface)', borderBottom:'1px solid rgba(255,255,255,0.07)', zIndex:1 }}>
            <strong style={{ color:'var(--text)', fontSize:'0.75rem' }}>Notificaciones</strong>
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={markAll} className="btn-ghost" title="Marcar todas como leídas" style={{ padding:'0.2rem' }}><CheckCheck size={12}/></button>
              <button onClick={()=>setOpen(false)} className="btn-ghost" style={{ padding:'0.2rem' }}><X size={12}/></button>
            </div>
          </div>
          {items.length === 0 ? <p style={{ padding:'1.25rem', color:'var(--text-dim)', fontSize:'0.7rem', textAlign:'center' }}>No hay notificaciones.</p> : items.map(item=>(
            <button key={item.id} onClick={()=>openItem(item)} style={{ width:'100%', textAlign:'left', padding:'10px 12px', background:item.leida_at?'transparent':'rgba(255,42,42,0.05)', border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}>
              <p style={{ color:item.leida_at?'var(--text-dim)':'var(--text)', fontSize:'0.7rem', fontWeight:700 }}>{item.titulo}</p>
              <p style={{ color:'var(--text-dim)', fontSize:'0.63rem', marginTop:3, lineHeight:1.4 }}>{item.cuerpo}</p>
              <p style={{ color:'rgba(107,114,128,0.6)', fontSize:'0.6rem', marginTop:4 }}>{new Date(item.created_at).toLocaleString('es-AR')}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
