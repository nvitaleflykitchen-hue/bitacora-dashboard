import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, db } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [perfil, setPerfil]           = useState(null)
  const [allowedSedeIds, setAllowedSedeIds] = useState(null) // null = sin restricción (admin)
  const [loading, setLoading]         = useState(true)

  const loadPerfil = async (authUser) => {
    if (!authUser) { setPerfil(null); setAllowedSedeIds(null); return null }
    let { data, error } = await db()
      .from('perfiles')
      .select('*')
      .eq('id', authUser.id)
      .single()
    if (error || !data) {
      const { data: nuevo } = await db()
        .from('perfiles')
        .insert({
          id: authUser.id,
          nombre: authUser.user_metadata?.nombre || authUser.email.split('@')[0],
          email: authUser.email,
          rol: 'consultor',
          activo: true,
        })
        .select()
        .single()
      data = nuevo
    }
    setPerfil(data)

    // Calcular allowedSedeIds según rol
    const rol = data?.rol || 'consultor'
    if (['admin', 'editor', 'consultor'].includes(rol)) {
      setAllowedSedeIds(null) // sin restricción
    } else if (rol === 'grupo' && data?.grupo_id) {
      // Traer todas las sedes activas de ese grupo
      const { data: sedes } = await db()
        .from('sedes')
        .select('id')
        .eq('grupo_id', data.grupo_id)
        .eq('activa', true)
      setAllowedSedeIds((sedes || []).map(s => s.id))
    } else if ((rol === 'encargado' || rol === 'sede') && data?.sede_ids?.length) {
      setAllowedSedeIds(data.sede_ids)
    } else {
      setAllowedSedeIds(null)
    }

    return data
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      await loadPerfil(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      await loadPerfil(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setPerfil(null)
    setAllowedSedeIds(null)
  }

  const rol       = perfil?.rol || 'consultor'
  const sedeIds   = perfil?.sede_ids || []
  const grupoId   = perfil?.grupo_id || null
  const isAdmin   = rol === 'admin'

  return (
    <AuthContext.Provider value={{ user, perfil, rol, sedeIds, grupoId, allowedSedeIds, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
