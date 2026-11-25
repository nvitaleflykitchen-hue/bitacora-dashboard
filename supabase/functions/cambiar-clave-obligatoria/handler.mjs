const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'}
const reply = (data, status=200) => new Response(JSON.stringify(data), {status,headers})

export function createPasswordChangeHandler({admin, url, anonKey, fetchImpl=fetch}) {
  return async req => {
    if (req.method === 'OPTIONS') return new Response('ok',{headers})
    if (req.method !== 'POST') return reply({error:'Método no permitido'},405)
    try {
      const token = /^Bearer (\S+)$/i.exec(req.headers.get('authorization') || '')?.[1]
      if (!token) return reply({error:'Sesión requerida'},401)
      const {data:auth,error:authError} = await admin.auth.getUser(token)
      if (authError || !auth?.user) return reply({error:'Sesión vencida'},401)
      const raw = await req.text()
      if (raw.length>2048) return reply({error:'Solicitud inválida'},400)
      let body
      try { body=JSON.parse(raw) } catch { return reply({error:'Solicitud inválida'},400) }
      const password=body?.password
      if (typeof password!=='string' || password.length<12 || password.length>128) return reply({error:'Usá entre 12 y 128 caracteres.'},400)
      const profiles=admin.schema('bitacora').from('perfiles')
      const {data:profile,error:profileError}=await profiles.select('id,activo,must_change_password,updated_at').eq('id',auth.user.id).single()
      if (profileError || !profile?.activo) return reply({error:'Cuenta no habilitada'},403)
      if (!profile.must_change_password) return reply({success:true})
      // Auth receives the verified user's JWT, never a user id supplied by the browser.
      const changed=await fetchImpl(`${url}/auth/v1/user`,{
        method:'PUT',headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({password}),signal:AbortSignal.timeout(15000),
      })
      if (!changed.ok) return reply({error:'No se pudo cambiar la clave. Elegí una diferente y verificá los requisitos.'},400)
      // A concurrent administrative reset changes updated_at; do not clear its requirement.
      let update=profiles.update({must_change_password:false,updated_at:new Date().toISOString()}).eq('id',auth.user.id).eq('must_change_password',true)
      update=profile.updated_at ? update.eq('updated_at',profile.updated_at) : update.is('updated_at',null)
      const completed=await update.select('id').maybeSingle()
      if (completed.error || !completed.data) return reply({error:'La contraseña cambió, pero no se confirmó la habilitación. Reintentá o consultá a administración.'},409)
      return reply({success:true})
    } catch {
      return reply({error:'No se pudo completar el cambio. Reintentá.'},503)
    }
  }
}
