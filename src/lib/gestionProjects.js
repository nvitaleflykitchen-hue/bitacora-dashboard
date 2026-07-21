export function isGestionProjectAction(item) {
  const code = String(item?.auditoria_codigo || '').toUpperCase()
  return code.startsWith('FK-GEST-') || (!item?.no_conformidad_id && String(item?.sede_nombre || '').toLowerCase() === 'gestión')
}

export function gestionHealth(item, now = new Date()) {
  if (['Completada', 'Verificada'].includes(item?.estado) || item?.gestion_estado === 'Cumplida') return { level:'ok', label:'Cumplida', days:0 }
  const base = item?.ultima_gestion_at || item?.aceptado_at || item?.updated_at || item?.created_at
  const days = base ? Math.max(0, Math.floor((now - new Date(base)) / 86400000)) : 0
  if (item?.gestion_estado === 'Sin aceptar' && days >= 2) return { level:'critical', label:`Sin aceptar · ${days} d`, days }
  if (item?.gestion_estado === 'Bloqueada') return { level:'warning', label:'Bloqueada', days }
  if (days >= 7) return { level:'critical', label:`Sin movimiento · ${days} d`, days }
  if (days >= 3) return { level:'warning', label:`Sin movimiento · ${days} d`, days }
  return { level:'ok', label:item?.gestion_estado || 'Sin aceptar', days }
}
