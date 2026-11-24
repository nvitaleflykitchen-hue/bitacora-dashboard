import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store'}
const response = (data: unknown, status=200) => new Response(JSON.stringify(data),{headers,status})
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers})
  if (req.method !== 'POST') return response({error:'Método no permitido'},405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /i,'')
    const {data:callerAuth,error:callerError} = await admin.auth.getUser(token)
    if (callerError || !callerAuth.user) return response({error:'Sesión requerida'},401)
    const profiles = admin.schema('bitacora')
    const {data:caller} = await profiles.from('perfiles').select('rol,activo').eq('id',callerAuth.user.id).single()
    if (!caller?.activo || caller.rol !== 'admin') return response({error:'Solo administración'},403)
    const {persona_id,user_id,password} = await req.json()
    if (!persona_id || !user_id || user_id === callerAuth.user.id || typeof password !== 'string' || password.length<20 || password.length>128) return response({error:'Solicitud inválida'},400)
    const {data:person,error:personError} = await profiles.rpc('get_persona_for_user_enable',{p_persona_id:persona_id}).single()
    const {data:profile,error:profileError} = await profiles.from('perfiles').select('id,email,rol,activo,must_change_password').eq('id',user_id).single()
    if (personError || profileError || !person?.activo || !profile?.activo || ['admin','editor'].includes(profile.rol)) return response({error:'Persona o perfil no elegible'},409)
    if (person.perfil_id ? person.perfil_id !== user_id : String(person.email || '').trim().toLowerCase() !== profile.email.toLowerCase()) return response({error:'La identidad no coincide con el legajo'},409)
    const {data:target,error:targetError} = await admin.auth.admin.getUserById(user_id)
    if (targetError || !target.user || target.user.email?.toLowerCase() !== profile.email.toLowerCase()) return response({error:'Cuenta no coincidente'},409)
    const last = target.user.last_sign_in_at
    if (last && Date.parse(last) >= Date.now()-90*86400000) return response({error:'La cuenta ingresó durante los últimos 90 días. No se modifica.'},409)
    if (target.user.banned_until && Date.parse(target.user.banned_until)>Date.now()) return response({error:'Cuenta suspendida. Revisión manual requerida.'},409)
    if (!person.perfil_id) {
      const linked = await profiles.rpc('link_persona_to_profile',{p_persona_id:persona_id,p_perfil_id:user_id})
      if (linked.error || !linked.data) return response({error:'No se pudo vincular el legajo'},409)
    }
    const flag = await profiles.from('perfiles').update({must_change_password:true}).eq('id',user_id).select('id').single()
    if (flag.error || !flag.data) return response({error:'No se pudo exigir el cambio de clave'},409)
    // Auth Admin API is the only password writer. Never log request bodies.
    const changed = await admin.auth.admin.updateUserById(user_id,{password})
    if (changed.error) {
      await profiles.from('perfiles').update({must_change_password:profile.must_change_password}).eq('id',user_id)
      return response({error:'Auth no pudo restablecer la clave'},400)
    }
    return response({success:true,user_id})
  } catch {
    return response({error:'No se completó el restablecimiento'},400)
  }
})

