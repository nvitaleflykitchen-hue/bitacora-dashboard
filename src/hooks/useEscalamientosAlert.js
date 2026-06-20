import { useEffect, useRef } from 'react'
import { getEscalamientosItems } from '../lib/queries'

const INTERVALO_MS  = 5 * 60 * 1000  // cada 5 minutos
const UMBRAL_HORAS  = 2               // escalamientos sin gestionar > 2 hs

function horasDesde(fechaStr) {
  if (!fechaStr) return 0
  return (Date.now() - new Date(fechaStr).getTime()) / (1000 * 60 * 60)
}

export function useEscalamientosAlert({ sedeIds, enabled = true }) {
  const permisoPedido = useRef(false)

  const pedirPermiso = async () => {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    if (permisoPedido.current) return false
    permisoPedido.current = true
    const result = await Notification.requestPermission()
    return result === 'granted'
  }

  const chequear = async () => {
    if (!enabled) return
    const ok = await pedirPermiso()
    if (!ok) return

    try {
      const items = await getEscalamientosItems({ sedeIds: sedeIds || undefined, estado: 'Pendiente' })
      const viejos = items.filter(e => horasDesde(e.created_at || e.fecha_reporte) >= UMBRAL_HORAS)
      if (viejos.length === 0) return

      // Agrupar por sede para no spamear
      const porSede = {}
      for (const e of viejos) {
        const sede = e.sede_nombre || 'Sede desconocida'
        if (!porSede[sede]) porSede[sede] = []
        porSede[sede].push(e.tipo || 'General')
      }

      for (const [sede, tipos] of Object.entries(porSede)) {
        const tiposStr = [...new Set(tipos)].join(', ')
        new Notification('⚠ Escalamiento sin gestionar — FK', {
          body: `${sede}: ${tipos.length} pendiente${tipos.length > 1 ? 's' : ''} (${tiposStr}) · más de ${UMBRAL_HORAS}hs sin atención`,
          icon: '/favicon.ico',
          tag:  `esc-${sede}`,          // evita duplicar misma sede
          renotify: false,
        })
      }
    } catch (e) {
      console.warn('[useEscalamientosAlert]', e)
    }
  }

  useEffect(() => {
    if (!enabled) return
    // Chequeo inicial con delay (esperar a que el usuario esté activo)
    const init = setTimeout(chequear, 10_000)
    const interval = setInterval(chequear, INTERVALO_MS)
    return () => { clearTimeout(init); clearInterval(interval) }
  }, [enabled, JSON.stringify(sedeIds)])  // eslint-disable-line
}
