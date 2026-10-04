import { useEffect, useState } from 'react'
import { db } from './supabase'
export function useFormAccess(personaId = null) {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    let active = true
    db().rpc('fp_available', { p_persona: personaId }).then(({data,error}) => {
      if (active) setAllowed(!error && data === true)
    }).catch(() => { if (active) setAllowed(false) })
    return () => { active = false }
  }, [personaId])
  return allowed
}
