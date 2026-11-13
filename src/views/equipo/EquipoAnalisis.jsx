import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import EvaluacionesAnalysisPanel from '../../components/EvaluacionesAnalysisPanel'

export default function EquipoAnalisis({ personas, onOpenPersona }) {
  const [state, setState] = useState({ loading:true, data:[], error:false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setState({ loading:true, data:[], error:false })
    async function load() {
      try {
        const { data, error } = await supabase.from('v_evaluaciones').select('*').order('fecha_evaluacion', { ascending:false })
        if (error) throw error
        if (active) setState({ loading:false, data:data || [], error:false })
      } catch {
        if (active) setState({ loading:false, data:[], error:true })
      }
    }
    load()
    return () => { active = false }
  }, [attempt])
  if (state.loading) return <p role="status">Cargando evaluaciones…</p>
  if (state.error) return <div role="alert">No se pudieron cargar las evaluaciones. <button className="btn-ghost" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>
  const ids = new Set(personas.map(persona => String(persona.id)))
  return <EvaluacionesAnalysisPanel personas={personas} evaluaciones={state.data.filter(item => ids.has(String(item.persona_id)))} onOpenPersona={onOpenPersona}/>
}
