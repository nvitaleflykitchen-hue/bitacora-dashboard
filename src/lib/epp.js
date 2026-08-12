import QRCode from 'qrcode'
import { supabase } from './supabase'

const schema = () => supabase.schema('equipo')
const EPP_CATALOGO_BUCKET='epp-catalogo'
const FOTO_MIME_EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}

export function validarFotoProductoEpp(file){
  if(!file) return
  if(!FOTO_MIME_EXT[file.type]) throw new Error('La foto debe ser JPG, PNG o WebP.')
  if(file.size>5*1024*1024) throw new Error('La foto no puede superar los 5 MB.')
}

export async function urlFotoProductoEpp(path){
  if(!path) return null
  const {data,error}=await supabase.storage.from(EPP_CATALOGO_BUCKET).createSignedUrl(path,3600)
  if(error) throw error
  return data?.signedUrl||null
}

export async function cargarEpp() {
  const [catalogo, envios, sedes] = await Promise.all([
    schema().from('epp_catalogo').select('*,epp_catalogo_talles(*)').order('nombre'),
    schema().from('epp_envios').select('*,epp_envio_bultos(*),epp_envio_items(*,epp_catalogo(nombre,codigo,imagen_path),personas(nombre,apellido))').order('created_at',{ascending:false}),
    supabase.schema('bitacora').from('sedes').select('id,nombre'),
  ])
  if (catalogo.error) throw catalogo.error
  if (envios.error) throw envios.error
  if (sedes.error) throw sedes.error
  const sedePorId=new Map((sedes.data||[]).map(sede=>[Number(sede.id),sede]))
  return {
    catalogo:catalogo.data||[],
    envios:(envios.data||[]).map(envio=>({...envio,sede:sedePorId.get(Number(envio.sede_id))||null})),
  }
}

export async function crearProductoEpp(form, userId) {
  const prefijos={uniforme:'IND',epp:'EPP',calzado:'CAL',credencial:'CRE',otro:'OTR'}
  const prefijo=prefijos[form.categoria]||'OTR'
  const existentes=await schema().from('epp_catalogo').select('codigo').ilike('codigo',`${prefijo}-%`)
  if(existentes.error) throw existentes.error
  const siguiente=Math.max(0,...(existentes.data||[]).map(x=>Number(String(x.codigo).match(/-(\d+)$/)?.[1]||0)))+1
  const codigo=`${prefijo}-${String(siguiente).padStart(5,'0')}`
  validarFotoProductoEpp(form.foto)
  let imagenPath=null
  if(form.foto){
    imagenPath=`catalogo/${crypto.randomUUID()}.${FOTO_MIME_EXT[form.foto.type]}`
    const subida=await supabase.storage.from(EPP_CATALOGO_BUCKET).upload(imagenPath,form.foto,{cacheControl:'31536000',contentType:form.foto.type,upsert:false})
    if(subida.error) throw subida.error
  }
  const { data, error } = await schema().from('epp_catalogo').insert({
    codigo, nombre:form.nombre.trim(), categoria:form.categoria,
    descripcion:form.descripcion.trim()||null, requiere_devolucion:form.requiere_devolucion,
    reposicion_periodica:form.reposicion_periodica, imagen_path:imagenPath, created_by:userId,
  }).select().single()
  if (error) { if(imagenPath) await supabase.storage.from(EPP_CATALOGO_BUCKET).remove([imagenPath]); throw error }
  const talles=form.talles.split(',').map(x=>x.trim()).filter(Boolean)
  if (talles.length) {
    const res=await schema().from('epp_catalogo_talles').insert(talles.map(talle=>({producto_id:data.id,talle})))
    if(res.error) throw res.error
  }
  return data
}

export async function actualizarProductoEpp(productoId,form){
  const {error}=await schema().from('epp_catalogo').update({
    nombre:form.nombre.trim(),categoria:form.categoria,descripcion:form.descripcion.trim()||null,
    activo:form.activo,updated_at:new Date().toISOString(),
  }).eq('id',productoId)
  if(error) throw error
  const talles=form.talles.split(',').map(x=>x.trim()).filter(Boolean)
  const desactivar=await schema().from('epp_catalogo_talles').update({activo:false}).eq('producto_id',productoId)
  if(desactivar.error) throw desactivar.error
  if(talles.length){
    const res=await schema().from('epp_catalogo_talles').upsert(talles.map(talle=>({producto_id:productoId,talle,activo:true})),{onConflict:'producto_id,talle'})
    if(res.error) throw res.error
  }
}

export async function cambiarEstadoProductoEpp(productoId,activo){
  const {error}=await schema().from('epp_catalogo').update({activo,updated_at:new Date().toISOString()}).eq('id',productoId)
  if(error) throw error
}

async function sha256(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')
}

export async function cargarColaboradoresSede(sedeId) {
  if(!sedeId) return []
  const [personasRes,sedeRes]=await Promise.all([
    schema().from('personas').select('id,nombre,apellido,puesto,sede_ids')
      .eq('activo',true).is('duplicado_de',null).order('apellido').order('nombre'),
    supabase.schema('bitacora').from('sedes').select('id,nombre').eq('id',Number(sedeId)).single(),
  ])
  const {data,error}=personasRes
  if(error) throw error
  if(sedeRes.error) throw sedeRes.error
  const destino=Number(sedeId)
  const esEquipoCentral=String(sedeRes.data?.nombre||'').trim().toLowerCase()==='equipo central'
  return (data||[]).filter(persona=>{
    const sedes=(persona.sede_ids||[]).map(Number)
    return esEquipoCentral?sedes.length===0:sedes.includes(destino)
  }).map(persona=>{
    const sedes=(persona.sede_ids||[]).map(Number)
    return {...persona,tipo_destinatario:sedes.length===0?'central':sedes.length>1?'multisede':'sede'}
  }).sort((a,b)=>{
    const orden={central:0,multisede:1,sede:2}
    return orden[a.tipo_destinatario]-orden[b.tipo_destinatario]||String(a.apellido||'').localeCompare(String(b.apellido||''),'es')
  })
}

export async function crearEnvioEpp({ sedeId, observaciones, bultos, destinatarios=[] }, userId) {
  const { data:envio,error }=await schema().from('epp_envios').insert({sede_id:Number(sedeId),observaciones:observaciones||null,created_by:userId,fecha_preparacion:new Date().toISOString().slice(0,10)}).select().single()
  if(error) throw error
  try{
    if(destinatarios.length){
      const res=await schema().from('epp_envio_items').insert(destinatarios.map(item=>({
        envio_id:envio.id,persona_id:item.personaId,producto_id:item.productoId,
        talle:item.talle||null,cantidad:Number(item.cantidad||1),estado:'pendiente',
      })))
      if(res.error) throw res.error
    }
    for(let numero=1;numero<=Number(bultos||1);numero+=1){
      const id=crypto.randomUUID(); const codigo=`${envio.codigo}-B${String(numero).padStart(2,'0')}`
      const res=await schema().from('epp_envio_bultos').insert({id,envio_id:envio.id,numero,codigo,qr_token_hash:await sha256(id)}); if(res.error) throw res.error
    }
  }catch(errorCreacion){
    await schema().from('epp_envios').delete().eq('id',envio.id)
    throw errorCreacion
  }
  return envio
}

export function urlConfirmacionIndividual(item) { return `${window.location.origin}/?eppEntrega=${item.qr_token}` }

export async function imprimirConstanciasEpp(items){
  const enriched=await Promise.all(items.map(async item=>({...item,qr:await QRCode.toDataURL(urlConfirmacionIndividual(item),{width:650,margin:1,errorCorrectionLevel:'H'})})))
  const w=window.open('','_blank');if(!w)throw new Error('El navegador bloqueó la ventana de impresión.')
  w.document.write(`<!doctype html><html><head><title>Constancias individuales EPP</title><style>@page{size:A4;margin:8mm}*{box-sizing:border-box}body{font-family:Arial;margin:0}.sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:5mm}.card{height:13cm;border:1px dashed #666;padding:7mm;text-align:center;break-inside:avoid}.qr{width:58%;max-height:6cm}.name{font-size:18px;font-weight:800;margin:8px}.product{font-size:15px}.meta{font-size:12px;margin:5px;color:#333}.code{font-weight:800}</style></head><body><div class="sheet">${enriched.map(i=>`<section class="card"><div class="code">${i.envioCodigo}</div><div class="name">${i.personas?.apellido||''}, ${i.personas?.nombre||''}</div><div class="product">${i.epp_catalogo?.codigo||''} · ${i.epp_catalogo?.nombre||''}</div><div class="meta">Talle: ${i.talle||'Sin talle / Ajustable'} · Cantidad: ${i.cantidad}</div><img class="qr" src="${i.qr}"/><div class="meta">Escanear y confirmar sin iniciar sesión</div><strong>CONFIRMAR RECEPCIÓN INDIVIDUAL</strong></section>`).join('')}</div><script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);w.document.close()
}

export async function obtenerEntregaEpp(token){const {data,error}=await schema().rpc('obtener_entrega_epp_por_token',{p_token:token});if(error)throw error;return data?.[0]||null}
export async function confirmarEntregaEpp(token){const {data,error}=await schema().rpc('confirmar_entrega_epp',{p_token:token});if(error)throw error;return data?.[0]||null}
export async function cargarEppPersona(personaId){const {data,error}=await schema().from('epp_envio_items').select('id,talle,cantidad,estado,confirmado_at,epp_catalogo(nombre,codigo,imagen_path)').eq('persona_id',personaId).order('created_at',{ascending:false});if(error)throw error;return data||[]}

export async function imprimirEtiquetasEpp(etiquetas,{anchoCm=9,altoCm=12}={}){
  const enriched=await Promise.all(etiquetas.map(async e=>({...e,qr:await QRCode.toDataURL(urlRecepcionBulto(e),{width:700,margin:1,errorCorrectionLevel:'H'})})))
  const w=window.open('','_blank'); if(!w) throw new Error('El navegador bloqueó la ventana de impresión.')
  w.document.write(`<!doctype html><html><head><title>Etiquetas EPP</title><style>@page{size:A4;margin:8mm}*{box-sizing:border-box}body{font-family:Arial;margin:0}.sheet{display:flex;flex-wrap:wrap;gap:5mm}.label{width:${anchoCm}cm;height:${altoCm}cm;border:1px dashed #666;padding:5mm;text-align:center;break-inside:avoid}.label img{width:70%;max-height:65%;object-fit:contain}.code{font-weight:800;font-size:14px}.site{font-size:16px;font-weight:700;margin:4px}.meta{font-size:11px;margin:3px}</style></head><body><div class="sheet">${enriched.map(e=>`<section class="label"><div class="code">${e.codigo}</div><div class="site">${e.sede}</div><img src="${e.qr}"/><div class="meta">Bulto ${e.numero} de ${e.total}</div><div class="meta">Recepción de Uniformes / EPP</div><strong>ESCANEAR PARA CONFIRMAR</strong></section>`).join('')}</div><script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`)
  w.document.close()
}
