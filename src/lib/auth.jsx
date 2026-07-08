import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase, db } from './supabase'
import { canWrite } from './access'

const AuthContext = createContext(null)
const AUTH_TIMEOUT_MS = 12_000

function withTimeout(promise, label, ms = AUTH_TIMEOUT_MS) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} agotó el tiempo de espera`)), ms)
    }),
  ])
}

// Compare two perfil objects by value to avoid unnecessary re-renders.
// Returns true if both represent the same logical data.
function perfilEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  // Compare the fields that actually drive downstream effects
  return a.id === b.id
    && a.rol === b.rol
    && a.activo === b.activo
    && a.grupo_id === b.grupo_id
    && a.nombre === b.nombre
    && a.email === b.email
    && JSON.stringify(a.sede_ids) === JSON.stringify(b.sede_ids)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [allowedSedeIds, setAllowedSedeIds] = useState(null) // null = sin restricción
  const [loading, setLoading] = useState(true)
  const [accessBlocked, setAccessBlocked] = useState(false)
  const [authError, setAuthError] = useState(null)
  const perfilRef = useRef(null)

  const loadPerfil = async (authUser) => {
    if (!authUser) {
      setPerfil(null)
      setAllowedSedeIds(null)
      setAccessBlocked(false)
      return null
    }

    let { data, error } = await withTimeout(
      db()
        .from('perfiles')
        .select('*')
        .eq('id', authUser.id)
        .single(),
      'Carga de perfil',
    )

    if (error || !data) {
      const { data: nuevo, error: insertError } = await withTimeout(
        db()
          .from('perfiles')
          .insert({
            id: authUser.id,
            nombre: authUser.user_metadata?.nombre || authUser.email.split('@')[0],
            email: authUser.email,
            rol: 'consultor',
            activo: true,
          })
          .select()
          .single(),
        'Creación de perfil',
      )
      if (insertError) throw insertError
      data = nuevo
    }

    // Only update perfil state when data actually changed to avoid cascading re-renders
    if (!perfilEqual(perfilRef.current, data)) {
      perfilRef.current = data
      setPerfil(data)
    }

    if (!data?.activo) {
      setAllowedSedeIds([])
      setAccessBlocked(true)
      return data
    }

    const rol = data?.rol || 'consultor'
    if (['admin', 'editor', 'consultor', 'flota'].includes(rol)) {
      setAllowedSedeIds(null)
      setAccessBlocked(false)
    } else if (rol === 'grupo' && data?.grupo_id) {
      const { data: sedes, error: sedesError } = await withTimeout(
        db()
          .from('sedes')
          .select('id')
          .eq('grupo_id', data.grupo_id)
          .eq('activa', true),
        'Carga de sedes del grupo',
      )
      if (sedesError) throw sedesError
      setAllowedSedeIds((sedes || []).map(s => s.id))
      setAccessBlocked(!(sedes || []).length)
    } else if ((rol === 'encargado' || rol === 'sede' || rol === 'operario') && data?.sede_ids?.length) {
      setAllowedSedeIds(data.sede_ids)
      setAccessBlocked(false)
    } else {
      // Fail closed: un rol territorial mal configurado no puede ver todas las sedes.
      setAllowedSedeIds([])
      setAccessBlocked(true)
    }

    return data
  }

  useEffect(() => {
    let cancelled = false
    let runId = 0

    const hydrate = async (authUser, source) => {
      const currentRun = ++runId
      setAuthError(null)
      setUser(authUser ?? null)

      try {
        await loadPerfil(authUser)
      } catch (err) {
        console.error(`[auth] ${source} falló`, err)
        if (cancelled || currentRun !== runId) return
        setAuthError(err?.message || 'No se pudo iniciar la sesión.')
        setPerfil(null)
        setAllowedSedeIds(null)
        setAccessBlocked(false)
      } finally {
        if (!cancelled && currentRun === runId) setLoading(false)
      }
    }

    const bootstrap = async () => {
      try {
        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 'Lectura de sesión')
        if (error) throw error
        if (!cancelled) await hydrate(session?.user ?? null, 'bootstrap')
      } catch (err) {
        console.error('[auth] bootstrap falló', err)
        if (cancelled) return
        setUser(null)
        setPerfil(null)
        setAllowedSedeIds(null)
        setAccessBlocked(false)
        setAuthError(err?.message || 'No se pudo recuperar la sesión.')
        setLoading(false)
      }
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase advierte no hacer trabajo async pesado dentro de este callback.
      // Diferimos la hidratación del perfil para evitar bloqueos intermitentes al iniciar.
      if (event === 'INITIAL_SESSION') return
      setUser(session?.user ?? null)
      window.setTimeout(() => {
        if (!cancelled) hydrate(session?.user ?? null, `auth:${event}`)
      }, 0)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    setAuthError(null)
    await supabase.auth.signOut()
    setUser(null)
    setPerfil(null)
    setAllowedSedeIds(null)
    setAccessBlocked(false)
  }

  const rol = perfil?.rol || 'consultor'
  const sedeIds = perfil?.sede_ids || []
  const grupoId = perfil?.grupo_id || null
  const isAdmin = rol === 'admin'
  const can = (domain, action) => canWrite(rol, domain, action, perfil)

  return (
    <AuthContext.Provider value={{ user, perfil, rol, sedeIds, grupoId, allowedSedeIds, accessBlocked, authError, isAdmin, can, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
