import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'}
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers})
const uuid=(v:unknown)=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const text=(v:unknown,max:number,required=false)=>typeof v==='string' && v.length<=max && (!required || v.trim().length>0)
const contact=(v:any)=>v && text(v.nombre,100,true) && text(v.rol,120,true) && typeof v.telefono==='string' && /^[1-9][0-9]{9,14}$/.test(v.telefono)
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers})
  if(req.method!=='POST')return reply({error:'Método no permitido'},405)
  try{
    const raw=await req.text();if(raw.length>24000)return reply({error:'Solicitud demasiado grande'},400)
    const b=JSON.parse(raw), secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}}), db=admin.schema('bitacora')
    if(['config','save','reports'].includes(b.action)){
      const {data:user,error:authError}=await admin.auth.getUser((req.headers.get('authorization')||'').replace(/^Bearer /i,''))
      if(authError||!user.user)return reply({error:'Sesión requerida'},401)
      const {data:profile}=await db.from('perfiles').select('rol,activo').eq('id',user.user.id).single()
      if(!profile?.activo||profile.rol!=='admin')return reply({error:'Solo administración'},403)
      if(!Number.isInteger(b.sede_id)||b.sede_id<1)return reply({error:'Sede inválida'},400)
      if(b.action==='save'){
        if(!contact(b.coordinacion)||(!Array.isArray(b.gerencia)||b.gerencia.length!==2||!b.gerencia.every(contact))||typeof b.activo!=='boolean')return reply({error:'Completá los tres contactos con teléfono internacional, solo números.'},400)
        const clean=(c:any)=>({nombre:c.nombre.trim(),rol:c.rol.trim(),telefono:c.telefono})
        const {data:existing,error:lookupError}=await db.from('comedor_qr').select('token').eq('sede_id',b.sede_id).maybeSingle()
        if(lookupError)throw lookupError
        const values={activo:b.activo,coordinacion:clean(b.coordinacion),gerencia:b.gerencia.map(clean),updated_at:new Date().toISOString()}
        const write=existing?db.from('comedor_qr').update(values).eq('sede_id',b.sede_id):db.from('comedor_qr').insert({...values,sede_id:b.sede_id})
        const {data,error}=await write.select('sede_id,token,activo,coordinacion,gerencia').single()
        if(error)throw error;return reply(data)
      }
      if(b.action==='reports'){
        if(b.offset!==undefined && (!Number.isInteger(b.offset)||b.offset<0))return reply({error:'Pagina invalida'},400)
        const {data,error}=await db.from('comedor_novedades').select('id,numero,nombre,empresa,contacto,items,created_at').eq('sede_id',b.sede_id).order('created_at',{ascending:false}).range(b.offset||0,(b.offset||0)+49)
        if(error)throw error;return reply({items:data})
      }
      const {data,error}=await db.from('comedor_qr').select('sede_id,token,activo,coordinacion,gerencia').eq('sede_id',b.sede_id).maybeSingle()
      if(error)throw error;return reply({config:data})
    }
    if(!['info','submit'].includes(b.action)||!uuid(b.token))return reply({error:'QR inválido'},400)
    const {data:qr,error}=await db.from('comedor_qr').select('sede_id,coordinacion,gerencia').eq('token',b.token).eq('activo',true).maybeSingle()
    if(error)throw error
    const {data:sede}=qr?await db.from('sedes').select('nombre').eq('id',qr.sede_id).eq('activa',true).maybeSingle():{data:null}
    if(!qr||!sede)return reply({error:'QR no disponible'},404)
    if(b.action==='info')return reply({nombre:sede.nombre,contactos:[qr.coordinacion,...qr.gerencia]})
    if(!uuid(b.request_id)||!text(b.nombre,100,true)||!text(b.empresa,120)||!text(b.contacto,160)||!Array.isArray(b.items)||!b.items.length||b.items.length>8||new Set(b.items.map((i:any)=>i.tema)).size!==b.items.length||b.items.some((i:any)=>!i||!/^[a-h]$/.test(i.tema)||!text(i.detalle,2000,true)||i.detalle.trim().length<5))return reply({error:'Revisá el nombre y los detalles de cada tema.'},400)
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown'
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+':'+ip))
    const ipHash=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')
    const {data:numero,error:saveError}=await db.rpc('recibir_novedad_comedor',{p_token:b.token,p_request_id:b.request_id,p_nombre:b.nombre.trim(),p_empresa:b.empresa.trim(),p_contacto:b.contacto.trim(),p_items:b.items.map((i:any)=>({tema:i.tema,detalle:i.detalle.trim()})),p_ip_hash:ipHash})
    if(saveError)return reply({error:'No se pudo registrar. Si ya enviaste varias novedades, esperá unos minutos y reintentá.'},429)
    return reply({codigo:`COM-${String(numero).padStart(6,'0')}`})
  }catch{return reply({error:'El canal no está disponible en este momento. Intentá nuevamente.'},500)}
})

