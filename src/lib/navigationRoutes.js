const TARGET_KEYS = { type:'targetType', id:'targetId', sedeId:'targetSedeId' }

export function readAppRoute(location = window.location) {
  const params = new URLSearchParams(location.search)
  if (params.get('scan') === 'activo' && params.get('id')) {
    return { view:'qrActivo', scanId:params.get('id'), target:null }
  }
  const target = Object.fromEntries(Object.entries(TARGET_KEYS).map(([key,param]) => [key, params.get(param)]))
  return {
    view:params.get('view') || 'inicio',
    scanId:null,
    target:target.type || target.id ? target : null,
  }
}

export function writeAppRoute(currentUrl, view, target = null) {
  const url = new URL(currentUrl)
  url.search = ''
  url.searchParams.set('view', view)
  Object.entries(TARGET_KEYS).forEach(([key,param]) => {
    if (target?.[key] != null && target[key] !== '') url.searchParams.set(param, target[key])
  })
  return url
}

export function mobileDestinationForView(view) {
  if (view === 'calidadHub' || ['noConformidades','capa'].includes(view)) return { tab:'mas', module:'calidad' }
  if (view === 'mantenimientoHub' || ['mntActivos','mntInsumos','mntKanban','mntPlanes','mntProveedores','mntMatafuegos','mntResponsables'].includes(view)) return { tab:'mas', module:'mantenimiento' }
  if (view === 'equipo') return { tab:'mas', module:'personal' }
  if (view === 'flotaHub') return { tab:'mas', module:'flota' }
  if (view === 'mntTickets') return { tab:'tickets' }
  if (view === 'requerimientos') return { tab:'compras' }
  if (view === 'escalamientos') return { tab:'escalamientos' }
  if (view === 'sedesHub' || view === 'sede' || view === 'sedeFicha') return { tab:'sedes' }
  if (view === 'tareas') return { tab:'tareas' }
  return { tab:'home' }
}

