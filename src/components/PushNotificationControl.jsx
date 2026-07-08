import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { activatePushNotifications, deactivatePushNotifications, getCurrentPushSubscription, pushSupported } from '../lib/pushNotifications'
import { toast } from '../lib/feedback'

export default function PushNotificationControl({ compact = false }) {
  const { user } = useAuth()
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const supported = typeof window !== 'undefined' && pushSupported()

  useEffect(() => {
    let alive = true
    if (!supported) { setLoading(false); return }
    getCurrentPushSubscription()
      .then(subscription => { if (alive) setActive(!!subscription) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [supported])

  const toggle = async () => {
    setLoading(true); setError('')
    try {
      if (active) {
        await deactivatePushNotifications(user)
        setActive(false)
      } else {
        await activatePushNotifications(user)
        setActive(true)
      }
    } catch (e) {
      const message = e.message || 'No se pudo cambiar la configuración.'
      setError(message)
      if (compact) toast(message)
    }
    finally { setLoading(false) }
  }

  if (!supported) return compact ? null : (
    <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>Este navegador no admite notificaciones Push.</p>
  )

  return (
    <div>
      <button onClick={toggle} disabled={loading} className={compact ? 'btn-ghost' : ''}
        title={active?'Desactivar notificaciones en este dispositivo':'Activar notificaciones en este dispositivo'}
        style={compact ? { padding:'0.3rem', color:active?'var(--phosphor)':'var(--text-dim)' } : {
          width:'100%', padding:'0.75rem', borderRadius:7, cursor:'pointer',
          background:active?'rgba(57,255,20,0.1)':'rgba(96,165,250,0.08)',
          color:active?'var(--phosphor)':'#60A5FA',
          border:`1px solid ${active?'rgba(57,255,20,0.25)':'rgba(96,165,250,0.25)'}`,
          display:'flex', justifyContent:'center', alignItems:'center', gap:7, fontWeight:700,
        }}>
        {loading ? <Loader2 size={14} className="animate-spin"/> : active ? <Bell size={14}/> : <BellOff size={14}/>}
        {!compact && (active ? 'Notificaciones activas en este celular' : 'Activar notificaciones en este celular')}
      </button>
      {error && !compact && <p style={{ color:'#FF5050', fontSize:'0.68rem', marginTop:6 }}>{error}</p>}
    </div>
  )
}
