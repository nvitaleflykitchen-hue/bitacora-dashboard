export const DESTINOS_INVENTARIO = [
  { value: 'insumo', label: 'Insumo / stock' },
  { value: 'activo', label: 'Equipo / activo' },
  { value: 'no_inventariable', label: 'No inventariable' },
]

export function descripcionCantidad(req) {
  const cantidad = Number(req?.cantidad || 0)
  const prefijo = cantidad > 0 ? `${cantidad} ${req?.unidad_medida || 'u.'}` : '1 u.'
  return `${prefijo} — ${req?.descripcion || 'Sin descripción'}`
}

export function buildRetiroMessage({ sedeNombre, responsableNombre, requerimientos }) {
  const items = (requerimientos || []).map(r => `• ${descripcionCantidad(r)}`).join('\n')
  return `Hola${responsableNombre ? ` ${responsableNombre}` : ''}. Ya se encuentran disponibles en Central los siguientes elementos para ${sedeNombre || 'la sede'}:\n\n${items}\n\nPodés pasar a retirarlos. Al recibirlos deberás confirmar el retiro en Fly Gestión; esa confirmación transfiere la custodia y actualiza automáticamente el inventario de la sede.`
}

export function whatsappRetiroHref(telefono, mensaje) {
  let digits = String(telefono || '').replace(/\D/g, '').replace(/^0+/, '')
  if (digits && !digits.startsWith('54')) digits = `549${digits.replace(/^9/, '')}`
  else if (digits.startsWith('54') && !digits.startsWith('549')) digits = `549${digits.slice(2).replace(/^9/, '')}`
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(mensaje || '')}`
}

export function agruparRecibidosPorSede(requerimientos) {
  const grupos = new Map()
  for (const req of requerimientos || []) {
    if (req.estado !== 'Recibido' || !req.sede_id || req.entrega_id) continue
    const key = String(req.sede_id)
    if (!grupos.has(key)) grupos.set(key, { sedeId: req.sede_id, sedeNombre: req.sedes?.nombre || req.sede_nombre, requerimientos: [] })
    grupos.get(key).requerimientos.push(req)
  }
  return [...grupos.values()]
}
