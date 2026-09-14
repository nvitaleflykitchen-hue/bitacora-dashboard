import { lazy, Suspense, useState } from 'react'
const Correos = lazy(() => import('../views/Correos'))
const kinds = { tarea: 'tarea', requerimiento: 'compra', ticket: 'ticket' }
export default function CorreosEntidad({ entityType, entityId, readOnly }) {
  const [open, setOpen] = useState(false)
  if (!kinds[entityType] || entityId == null) return null
  return <details className="mt-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer font-bold">Correos vinculados y evidencia documental</summary>
    {open && <Suspense fallback={<p>Cargando correos…</p>}><Correos key={`${entityType}:${entityId}`} planId={`${kinds[entityType]}:${entityId}`} readOnly={readOnly} /></Suspense>}
  </details>
}
