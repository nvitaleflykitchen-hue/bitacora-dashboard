import { lazy, Suspense, useState } from 'react'
const Correos = lazy(() => import('../views/Correos'))
const kinds = {
  tarea: 'tarea',
  requerimiento: 'compra',
  ticket: 'ticket',
  sede: 'sede',
  persona: 'persona',
  vehiculo: 'vehiculo',
  id_proyecto: 'idproyecto',
}

export function correoEntityPlanId(entityType, entityId) {
  if (!kinds[entityType] || entityId == null) return null
  return `${kinds[entityType]}:${entityId}`
}

export default function CorreosEntidad({ entityType, entityId, readOnly }) {
  const [open, setOpen] = useState(false)
  const planId = correoEntityPlanId(entityType, entityId)
  if (!planId) return null
  return <details className="mt-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer font-bold">Correos vinculados y evidencia documental</summary>
    {open && <Suspense fallback={<p>Cargando correos…</p>}><Correos key={planId} planId={planId} readOnly={readOnly} /></Suspense>}
  </details>
}
