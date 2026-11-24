import { supabase } from './supabase'

// Revalidate the account at submission, not the profile captured when opening the form.
export async function verifiedChecklistAuthor(displayedProfile) {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth?.user) throw new Error('Tu sesión venció. Ingresá nuevamente antes de guardar.')
  if (!displayedProfile?.id || displayedProfile.id !== auth.user.id) {
    throw new Error('La cuenta cambió mientras completabas el checklist. Recargá y verificá tu usuario antes de guardar.')
  }
  const { data: profile, error } = await supabase.rpc('obtener_perfil_sesion')
  if (error || !profile?.activo || profile.id !== auth.user.id) {
    throw new Error('No se pudo verificar al autor del checklist. Recargá e intentá nuevamente.')
  }
  return { id: profile.id, nombre: profile.nombre || profile.email }
}
