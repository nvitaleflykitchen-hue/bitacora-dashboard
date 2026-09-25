import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getSedes } from '../lib/queries'
import { activatePushNotifications, deactivatePushNotifications, getPushDeviceSettings, pushSupported, savePushDeviceSettings } from '../lib/pushNotifications'
import { toast } from '../lib/feedback'

const OPTIONS = [
  ['mantenimiento', 'Tickets urgentes'], ['compras', 'Compras urgentes'],
  ['tareas', 'Tareas de prioridad alta'], ['escalamientos', 'Escalamientos'],
  ['no_conformidades', 'Nuevas no conformidades'],
  ['comentario', 'Comentarios dirigidos a mí'], ['anuncio', 'Avisos de la administración'],
]
const DEFAULT_EVENTS = OPTIONS.map(([key]) => key)

export default function PushNotificationControl({ compact = false }) {
  const { user, allowedSedeIds } = useAuth()
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [sites, setSites] = useState([])
  const [settings, setSettings] = useState({ event_types:DEFAULT_EVENTS, site_ids:null, sound_enabled:true })
  const supported = typeof window !== 'undefined' && pushSupported()

  useEffect(() => {
    let alive = true
    if (!supported || !user?.id) { setLoading(false); return () => { alive = false } }
    getPushDeviceSettings(user).then(row => {
      if (!alive) return
      setActive(!!row?.active)
      if (row) setSettings({ event_types:row.event_types || DEFAULT_EVENTS,
        site_ids:row.site_ids, sound_enabled:row.sound_enabled !== false })
    }).catch(e => { if (alive) setError(e.message || 'No se pudo leer la configuración.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [supported, user])

  useEffect(() => {
    let alive = true
    if (allowedSedeIds?.length === 0) return () => { alive = false }
    getSedes(allowedSedeIds).then(rows => { if (alive) setSites(rows || []) })
      .catch(() => { if (alive) setSites([]) })
    return () => { alive = false }
  }, [allowedSedeIds])

  const toggle = async () => {
    setLoading(true); setError('')
    try {
      if (active) { await deactivatePushNotifications(user); setActive(false) }
      else {
        await activatePushNotifications(user)
        const row = await getPushDeviceSettings(user)
        if (row) setSettings({ event_types:row.event_types || DEFAULT_EVENTS,
          site_ids:row.site_ids, sound_enabled:row.sound_enabled !== false })
        setActive(true)
      }
    } catch (e) {
      const message = e.message || 'No se pudo cambiar la configuración.'
      setError(message)
      if (compact) toast(message)
    } finally { setLoading(false) }
  }

  const save = async () => {
    setSaving(true); setError('')
    try {
      const allowed = new Set(sites.map(site => Number(site.id)))
      const site_ids = settings.site_ids === null ? null : settings.site_ids.filter(id => allowed.has(Number(id)))
      await savePushDeviceSettings(user, { ...settings, site_ids })
      setSettings(previous => ({ ...previous, site_ids }))
      toast('Preferencias de notificaciones guardadas.')
      if (compact) setOpen(false)
    } catch (e) { setError(e.message || 'No se pudieron guardar las preferencias.') }
    finally { setSaving(false) }
  }

  if (!supported) return compact ? null : <p style={{ color:'var(--text-dim)', fontSize:'0.8rem' }}>Este navegador no admite push. En iPhone, abrí Fly Gestión desde la pantalla de inicio.</p>

  const form = <div style={{ display:'grid', gap:14 }}>
    <button onClick={toggle} disabled={loading} className="btn-ghost" style={{ width:'100%', display:'flex', justifyContent:'center', alignItems:'center', gap:8, padding:12, color:active?'var(--phosphor)':'#60A5FA' }}>
      {loading ? <Loader2 size={16} className="animate-spin"/> : active ? <Bell size={16}/> : <BellOff size={16}/>}
      {active ? 'Notificaciones activas' : 'Activar notificaciones'}
    </button>
    {error && <p role="alert" style={{ color:'#FF5050', fontSize:'0.8rem' }}>{error}</p>}
    {active && <>
      <fieldset style={{ border:'1px solid var(--border)', padding:12 }}><legend>Qué avisos recibir</legend>
        {OPTIONS.map(([key, label]) => <label key={key} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0' }}>
          <input type="checkbox" checked={settings.event_types.includes(key)} onChange={event => setSettings(previous => ({ ...previous,
            event_types:event.target.checked ? [...previous.event_types, key] : previous.event_types.filter(value => value !== key),
          }))} />{label}
        </label>)}
      </fieldset>
      <fieldset style={{ border:'1px solid var(--border)', padding:12 }}><legend>Sedes</legend>
        <label style={{ display:'flex', alignItems:'center', gap:8 }}><input type="checkbox" checked={settings.site_ids === null}
          onChange={event => setSettings(previous => ({ ...previous, site_ids:event.target.checked ? null : [] }))} />Todas mis sedes autorizadas</label>
        {settings.site_ids !== null && <div style={{ maxHeight:180, overflowY:'auto', marginTop:8 }}>
          {sites.map(site => <label key={site.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
            <input type="checkbox" checked={settings.site_ids.includes(Number(site.id))}
              onChange={event => setSettings(previous => ({ ...previous, site_ids:event.target.checked
                ? [...previous.site_ids, Number(site.id)] : previous.site_ids.filter(id => id !== Number(site.id)) }))} />{site.nombre}
          </label>)}
          {!sites.length && <p>No tenés sedes asignadas.</p>}
        </div>}
      </fieldset>
      <label style={{ display:'flex', alignItems:'center', gap:8 }}><input type="checkbox" checked={settings.sound_enabled}
        onChange={event => setSettings(previous => ({ ...previous, sound_enabled:event.target.checked }))} />Permitir sonido y vibración</label>
      <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>El sonido depende de la configuración del teléfono. En iPhone, agregá Fly Gestión a la pantalla de inicio.</p>
      <button onClick={save} disabled={saving} className="btn-ghost" style={{ color:'var(--phosphor)' }}>{saving ? 'Guardando…' : 'Guardar preferencias'}</button>
    </>}
  </div>

  return compact ? <>
    <button onClick={() => setOpen(true)} className="btn-ghost" title="Configurar notificaciones" style={{ padding:'0.3rem', color:active?'var(--phosphor)':'var(--text-dim)' }}><Bell size={14}/></button>
    {open && <div className="modal-overlay" style={{ zIndex:3000 }}><div style={{ background:'var(--surface)', border:'1px solid var(--border)', padding:20, width:'min(96vw,520px)', maxHeight:'90vh', overflowY:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><strong>Notificaciones en este dispositivo</strong><button onClick={() => setOpen(false)} className="btn-ghost" aria-label="Cerrar"><X size={18}/></button></div>
      {form}
    </div></div>}
  </> : form
}
