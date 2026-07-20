import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import { addYears, format } from 'date-fns'
import { supabase } from './supabase'
import { getPersonaFotoUrl } from './personaFotos'

export const fechaVencimientoCredencial = (fecha = new Date()) => format(addYears(fecha, 2), 'yyyy-MM-dd')
export const urlValidacionCredencial = token => `${window.location.origin}/?credencial=${token}`

export function categoriaCredencial(persona) {
  const value = `${persona?.area || ''} ${persona?.puesto || ''}`.toLowerCase()
  if (value.includes('mantenimiento')) return 'MNT'
  if (value.includes('calidad')) return 'CAL'
  if (value.includes('administr')) return 'ADM'
  if (value.includes('seguridad')) return 'HYS'
  return 'OPS'
}

export async function getCredencialPersona(personaId) {
  const { data, error } = await supabase.schema('equipo').from('credenciales_personal')
    .select('*').eq('persona_id', personaId).order('created_at', { ascending:false }).limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function emitirCredencial({ persona, sedeNombre, userId, anterior = null, compartirTelefono = false, compartirEmail = false, grupoSanguineo = null, fotoX = 50, fotoY = 50, fotoZoom = 1 }) {
  if (anterior?.estado === 'activa') {
    const { error } = await supabase.schema('equipo').from('credenciales_personal').update({
      estado:'anulada', motivo_anulacion:'Reemplazada por una nueva emisión', anulada_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    }).eq('id', anterior.id)
    if (error) throw error
  }
  const { data, error } = await supabase.schema('equipo').from('credenciales_personal').insert({
    persona_id:persona.id, estado:'activa', fecha_emision:format(new Date(), 'yyyy-MM-dd'),
    fecha_vencimiento:fechaVencimientoCredencial(), sede_nombre:sedeNombre || 'Administración Central',
    puesto_impreso:persona.puesto || null, area_impresa:persona.area || null, emitida_por:userId,
    compartir_telefono:compartirTelefono, compartir_email:compartirEmail, grupo_sanguineo:grupoSanguineo || null,
    foto_pos_x:fotoX, foto_pos_y:fotoY, foto_zoom:fotoZoom,
  }).select().single()
  if (error) throw error
  return data
}

export async function actualizarPrivacidadCredencial(id, compartirTelefono, compartirEmail, grupoSanguineo = null, fotoX = 50, fotoY = 50, fotoZoom = 1) {
  const { data, error } = await supabase.schema('equipo').from('credenciales_personal').update({
    compartir_telefono:compartirTelefono, compartir_email:compartirEmail,
    grupo_sanguineo:grupoSanguineo || null, foto_pos_x:fotoX, foto_pos_y:fotoY, foto_zoom:fotoZoom,
    updated_at:new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function cambiarEstadoCredencial(id, estado, motivo = null) {
  const { data, error } = await supabase.schema('equipo').from('credenciales_personal').update({
    estado, motivo_anulacion:motivo, anulada_at:['anulada','extraviada'].includes(estado) ? new Date().toISOString() : null,
    updated_at:new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error) throw error
  return data
}

const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob)
})

async function imageData(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('No se pudo cargar una imagen de la credencial.')
  const blob = await response.blob()
  // Si el archivo no esta publicado, el servidor devuelve el index.html de la app
  // con status 200. Sin este control jsPDF falla con "files of type 'UNKNOWN'".
  if (!blob.type.startsWith('image/')) throw new Error(`No se encontró la imagen ${url}. Avisá a sistemas.`)
  return blobToDataUrl(blob)
}

export async function descargarCredencialPdf(persona, credencial) {
  const [logo, foto, qr] = await Promise.all([
    imageData('/fly-kitchen-credencial.png'),
    persona.foto_url ? getPersonaFotoUrl(persona.foto_url).then(imageData) : Promise.resolve(null),
    QRCode.toDataURL(urlValidacionCredencial(credencial.token), { width:700, margin:1, errorCorrectionLevel:'H' }),
  ])
  const fotoRecortada = foto ? await coverImageData(foto, 450, 436, credencial.foto_pos_x, credencial.foto_pos_y, credencial.foto_zoom) : null
  const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:[53.98, 85.6] })
  const orange = [235,102,0], name = [persona.nombre,persona.apellido].filter(Boolean).join(' ').toUpperCase()
  const sede = credencial.sede_nombre || 'Administración Central', category = categoriaCredencial(persona)
  const base = () => { pdf.setFillColor(250,250,250);pdf.rect(0,0,53.98,85.6,'F');pdf.setDrawColor(215);pdf.roundedRect(.5,.5,52.98,84.6,2.5,2.5) }

  base()
  addContainImage(pdf,logo,4,1,45.98,8.2)
  pdf.setFillColor(...orange);pdf.rect(45,9.2,8.98,43.6,'F')
  if(fotoRecortada)pdf.addImage(fotoRecortada,'JPEG',0,9.2,45,43.6,undefined,'FAST');else{pdf.setFillColor(235);pdf.rect(0,9.2,45,43.6,'F')}
  pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(15);category.split('').forEach((letter,i)=>pdf.text(letter,49.5,25+i*8,{align:'center'}))
  pdf.setFillColor(250,250,250);pdf.rect(0,52.8,53.98,24.2,'F')
  pdf.setTextColor(15);pdf.setFont('helvetica','bold');pdf.setFontSize(10.2);pdf.text(name,3,58,{maxWidth:48})
  pdf.setFontSize(6.3);if(persona.dni)pdf.text(`DNI ${persona.dni}`,3,62)
  pdf.setFontSize(7.3);pdf.text('FLY KITCHEN S.A.',3,66)
  pdf.setTextColor(...orange);pdf.setFontSize(6);pdf.text(String(credencial.puesto_impreso||persona.puesto||'SIN PUESTO').toUpperCase(),3,70,{maxWidth:47})
  pdf.setTextColor(35);pdf.setFont('helvetica','normal');pdf.setFontSize(5.5);pdf.text(sede.toUpperCase(),3,75.5,{maxWidth:40})
  if(credencial.grupo_sanguineo){pdf.setTextColor(...orange);pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.text(credencial.grupo_sanguineo,50,75.5,{align:'right'})}
  pdf.setFillColor(...orange);pdf.rect(0,77,53.98,8.6,'F');pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text(`VENCE ${format(new Date(`${credencial.fecha_vencimiento}T12:00:00`),'dd·MM·yyyy')}`,27,82.6,{align:'center'})

  pdf.addPage([53.98,85.6],'portrait');base();addContainImage(pdf,logo,6,4,42,14);pdf.addImage(qr,'PNG',12,20,30,30)
  pdf.setDrawColor(...orange);pdf.line(5,53,49,53);pdf.setTextColor(20);pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.text('VALIDAR CREDENCIAL Y GUARDAR CONTACTO',27,57,{align:'center',maxWidth:46})
  pdf.setTextColor(35);pdf.setFont('helvetica','normal');pdf.setFontSize(6);pdf.text('Esta credencial es propiedad de',27,66,{align:'center'});pdf.setTextColor(...orange);pdf.setFont('helvetica','bold');pdf.text('Fly Kitchen S.A.',27,70,{align:'center'})
  pdf.setTextColor(35);pdf.setFont('helvetica','normal');pdf.setFontSize(5.8);pdf.text('En caso de extravío, remitir a Recursos Humanos.',27,75,{align:'center',maxWidth:45})
  pdf.setFillColor(...orange);pdf.rect(0,78,53.98,7.6,'F');pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(6);pdf.text('ALIMENTAMOS LO QUE NOS MUEVE',27,82.8,{align:'center'})
  pdf.save(`Credencial-${name.replace(/\s+/g,'-')}.pdf`)
}

function coverImageData(dataUrl,width,height,posX=50,posY=50,zoom=1){
  return new Promise((resolve,reject)=>{
    const image=new Image()
    image.onload=()=>{
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=width;canvas.height=height
      const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight)*Number(zoom||1),rw=image.naturalWidth*scale,rh=image.naturalHeight*scale
      const px=Math.min(100,Math.max(0,Number(posX??50)))/100,py=Math.min(100,Math.max(0,Number(posY??50)))/100
      ctx.fillStyle='#dfe3e8';ctx.fillRect(0,0,width,height);ctx.drawImage(image,(width-rw)*px,(height-rh)*py,rw,rh)
      resolve(canvas.toDataURL('image/jpeg',.94))
    }
    image.onerror=reject;image.src=dataUrl
  })
}

function addContainImage(pdf,dataUrl,x,y,width,height){
  const props=pdf.getImageProperties(dataUrl),scale=Math.min(width/props.width,height/props.height)
  const renderedWidth=props.width*scale,renderedHeight=props.height*scale
  pdf.addImage(dataUrl,props.fileType,x+(width-renderedWidth)/2,y+(height-renderedHeight)/2,renderedWidth,renderedHeight,undefined,'FAST')
}
