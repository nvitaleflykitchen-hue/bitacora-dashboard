import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
const headers = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json', 'Cache-Control':'no-store' }
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method !== 'POST') return respond({ error:'Método no permitido.' },405)
  const authorization = req.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return respond({ error:'Sesión requerida.' },401)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const caller = createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
    const { data: identity, error: authError } = await caller.auth.getUser(authorization.slice(7))
    if (authError || !identity.user) return respond({ error:'Sesión inválida.' },401)
    const input = await req.json()
    if (!['credencial','pase'].includes(input.tipo) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.token || '') || !Number.isInteger(Number(input.sede))) return respond({ error:'Escaneo inválido.' },400)
    // La RPC se ejecuta con la identidad del guardia: valida rol activo, sede,
    // contraseña actualizada y QR antes de registrar el escaneo y la entrega.
    const { data, error } = await caller.rpc('seguridad_operar',{p_accion:'escanear',p_sede:Number(input.sede),p_datos:{tipo:input.tipo,token:input.token}})
    if (error) return respond({ error:error.message },error.code === '42501' ? 403 : 400)
    const { foto_path, ...result } = data
    if (foto_path) {
      // Nunca acepta rutas enviadas por el cliente ni descarga URLs externas.
      if (typeof foto_path !== 'string' || /^https?:/i.test(foto_path) || foto_path.includes('..')) {
        result.foto_error = true
      } else {
        const admin = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
        const { data: photo, error: photoError } = await admin.storage.from('fotos-personal').createSignedUrl(foto_path,300).catch(() => ({data:null,error:true}))
        result.foto_url = photo?.signedUrl || null
        result.foto_error = !!photoError
      }
    }
    return respond(result)
  } catch {
    return respond({ error:'No se pudo procesar el escaneo. Reintentá.' },500)
  }
})
