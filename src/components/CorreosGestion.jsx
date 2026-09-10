import { useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import Correos from '../views/Correos'

export default function CorreosGestion({ codigo }) {
  const [planId, setPlanId] = useState(null)
  useEffect(() => {
    let active = true
    setPlanId(null)
    if (codigo?.startsWith('FK-GEST-')) {
      db().from('capa_planes').select('id').eq('auditoria_codigo', codigo).maybeSingle()
        .then(({ data }) => { if (active) setPlanId(data?.id || null) })
    }
    return () => { active = false }
  }, [codigo])
  if (!planId) return null
  return <details className="mt-4"><summary className="cursor-pointer font-bold">Correos y evidencias de la gestión</summary><Correos key={planId} planId={planId} /></details>
}
