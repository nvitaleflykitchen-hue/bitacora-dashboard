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
    schema().from('epp_envios').select('*,epp_envio_bultos(*),epp_envio_items(*,epp_catalogo(nombre))').order('created_at',{ascending:false}),
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

async function sha256(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')
}

export async function cargarColaboradoresSede(sedeId) {
  if(!sedeId) return []
  const {data,error}=await schema().from('personas').select('id,nombre,apellido,puesto,sede_ids')
    .eq('activo',true).contains('sede_ids',[Number(sedeId)]).is('duplicado_de',null).order('apellido').order('nombre')
  if(error) throw error
  return data||[]
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

export function urlRecepcionBulto(bulto) { return `${window.location.origin}/?view=eppRecepcion&bulto=${bulto.id}` }

export async function imprimirEtiquetasEpp(etiquetas,{anchoCm=9,altoCm=12}={}){
  const enriched=await Promise.all(etiquetas.map(async e=>({...e,qr:await QRCode.toDataURL(urlRecepcionBulto(e),{width:700,margin:1,errorCorrectionLevel:'H'})})))
  const w=window.open('','_blank'); if(!w) throw new Error('El navegador bloqueó la ventana de impresión.')
  w.document.write(`<!doctype html><html><head><title>Etiquetas EPP</title><style>@page{size:A4;margin:8mm}*{box-sizing:border-box}body{font-family:Arial;margin:0}.sheet{display:flex;flex-wrap:wrap;gap:5mm}.label{width:${anchoCm}cm;height:${altoCm}cm;border:1px dashed #666;padding:5mm;text-align:center;break-inside:avoid}.label img{width:70%;max-height:65%;object-fit:contain}.code{font-weight:800;font-size:14px}.site{font-size:16px;font-weight:700;margin:4px}.meta{font-size:11px;margin:3px}</style></head><body><div class="sheet">${enriched.map(e=>`<section class="label"><div class="code">${e.codigo}</div><div class="site">${e.sede}</div><img src="${e.qr}"/><div class="meta">Bulto ${e.numero} de ${e.total}</div><div class="meta">Recepción de Uniformes / EPP</div><strong>ESCANEAR PARA CONFIRMAR</strong></section>`).join('')}</div><script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`)
  w.document.close()
}
