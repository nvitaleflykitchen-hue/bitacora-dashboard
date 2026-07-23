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

export async function imageData(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('No se pudo cargar una imagen de la credencial.')
  const blob = await response.blob()
  // Si el archivo no esta publicado, el servidor devuelve el index.html de la app
  // con status 200. Sin este control jsPDF falla con "files of type 'UNKNOWN'".
  if (!blob.type.startsWith('image/')) throw new Error(`No se encontró la imagen ${url}. Avisá a sistemas.`)
  return blobToDataUrl(blob)
}

// ─── Geometría de la credencial ───────────────────────────────────────────────
// El PDF reproduce la MISMA composición que la vista previa del modal
// (CredencialPersonalModal.jsx), que dibuja la tarjeta en 270 x 428 px sobre un
// formato CR80 de 53,98 x 85,6 mm. Convertimos píxeles de la vista previa a
// milímetros para que ambas salidas coincidan y para no repetir números mágicos.
export const CARD_W = 53.98, CARD_H = 85.6
export const PREVIEW_W = 270, PREVIEW_H = 428
export const mx = px => px * CARD_W / PREVIEW_W   // píxeles -> mm (horizontal)
export const my = px => px * CARD_H / PREVIEW_H   // píxeles -> mm (vertical)
// La vista previa define los tamaños en px de CSS; jsPDF los espera en puntos.
export const ptFromPx = px => my(px) * 72 / 25.4

export async function descargarCredencialPdf(persona, credencial) {
  const [logo, foto, qr] = await Promise.all([
    imageData('/fly-kitchen-credencial.png'),
    persona.foto_url ? getPersonaFotoUrl(persona.foto_url).then(imageData) : Promise.resolve(null),
    QRCode.toDataURL(urlValidacionCredencial(credencial.token), { width:700, margin:1, errorCorrectionLevel:'H' }),
  ])
  // El recorte se rasteriza con la MISMA relación de aspecto que la vista previa
  // (231 x 218 px), para que el encuadre elegido por el administrador se vea igual.
  const fotoRecortada = foto ? await coverImageData(foto, 231 * 2, 218 * 2, credencial.foto_pos_x, credencial.foto_pos_y, credencial.foto_zoom) : null
  const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:[CARD_W, CARD_H] })
  const orange = [235,102,0], name = [persona.nombre,persona.apellido].filter(Boolean).join(' ').toUpperCase()
  const sede = credencial.sede_nombre || 'Administración Central', category = categoriaCredencial(persona)
  const base = () => { pdf.setFillColor(250,250,250);pdf.rect(0,0,CARD_W,CARD_H,'F');pdf.setDrawColor(215);pdf.roundedRect(.5,.5,CARD_W-1,CARD_H-1,2.5,2.5) }

  // ── FRENTE ──────────────────────────────────────────────────────────────────
  base()
  // Banda del logo: 46 px de alto, padding 3 px arriba y 12 px a los lados.
  addContainImage(pdf, logo, mx(12), my(3), mx(PREVIEW_W - 24), my(40))

  // Foto (231 px) + franja naranja de categoría (39 px), ambas de 218 px de alto.
  const fotoW = mx(231), stripX = fotoW, stripW = CARD_W - fotoW
  const fotoY = my(46), fotoH = my(218)
  pdf.setFillColor(...orange);pdf.rect(stripX, fotoY, stripW, fotoH, 'F')
  if (fotoRecortada) pdf.addImage(fotoRecortada,'JPEG',0,fotoY,fotoW,fotoH,undefined,'FAST')
  else { pdf.setFillColor(223,227,232);pdf.rect(0,fotoY,fotoW,fotoH,'F') }

  // Letras de categoría: centradas en la franja, 28 px con interlineado 1,05.
  const letters = category.split(''), letterLine = my(28 * 1.05)
  const lettersTop = fotoY + (fotoH - letters.length * letterLine) / 2
  pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(28))
  letters.forEach((letter,i) => pdf.text(letter, stripX + stripW/2, lettersTop + letterLine*i + letterLine/2, { align:'center', baseline:'middle' }))

  // Bloque de datos: 121 px de alto, padding 7 px arriba, 12 px a los lados, 4 px abajo.
  const infoTop = my(264), infoH = my(121), infoX = mx(12), infoW = mx(PREVIEW_W - 24)
  const infoBottom = infoTop + infoH - my(4)
  pdf.setFillColor(250,250,250);pdf.rect(0,infoTop,CARD_W,infoH,'F')
  let cursor = infoTop + my(7)
  const gap = my(2)

  pdf.setTextColor(15);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(18))
  const nameLines = pdf.splitTextToSize(name, infoW), nameLine = my(18 * 1.05)
  nameLines.forEach((line,i) => pdf.text(line, infoX, cursor + nameLine*i, { baseline:'top' }))
  cursor += nameLines.length * nameLine + gap

  if (persona.dni) {
    pdf.setFontSize(ptFromPx(10.5));pdf.text(`DNI ${persona.dni}`, infoX, cursor, { baseline:'top' })
    cursor += my(10.5 * 1.2) + gap
  }
  pdf.setFontSize(ptFromPx(11.5));pdf.text('FLY KITCHEN S.A.', infoX, cursor, { baseline:'top' })
  cursor += my(11.5 * 1.2) + gap

  pdf.setTextColor(215,91,0);pdf.setFontSize(ptFromPx(9.5))
  const puesto = String(credencial.puesto_impreso || persona.puesto || 'SIN PUESTO').toUpperCase()
  const puestoLine = my(9.5 * 1.1)
  pdf.splitTextToSize(puesto, infoW).forEach((line,i) => pdf.text(line, infoX, cursor + puestoLine*i, { baseline:'top' }))

  // Última fila (sede y grupo sanguíneo): pegada al pie del bloque.
  pdf.setTextColor(35);pdf.setFont('helvetica','normal');pdf.setFontSize(ptFromPx(8))
  pdf.text(sede.toUpperCase(), infoX, infoBottom, { baseline:'bottom', maxWidth:mx(190) })
  if (credencial.grupo_sanguineo) {
    pdf.setTextColor(215,91,0);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(11))
    pdf.text(credencial.grupo_sanguineo, CARD_W - infoX, infoBottom, { align:'right', baseline:'bottom' })
  }

  // Banda de vencimiento: 43 px de alto al pie de la tarjeta.
  const expiryTop = my(385), expiryH = my(43)
  pdf.setFillColor(...orange);pdf.rect(0,expiryTop,CARD_W,expiryH,'F')
  pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(18))
  pdf.text(`VENCE  ${format(new Date(`${credencial.fecha_vencimiento}T12:00:00`),'dd·MM·yyyy')}`, CARD_W/2, expiryTop + expiryH/2, { align:'center', baseline:'middle' })

  // ── DORSO ───────────────────────────────────────────────────────────────────
  pdf.addPage([CARD_W, CARD_H],'portrait');base()
  // Banda del logo: 66 px de alto, padding 8 px arriba y 16 px a los lados.
  addContainImage(pdf, logo, mx(16), my(8), mx(PREVIEW_W - 32), my(50))

  // QR de 166 px, centrado, con 4 px de margen bajo la banda del logo.
  const qrSize = my(166), qrTop = my(70)
  pdf.addImage(qr,'PNG',(CARD_W - qrSize)/2, qrTop, qrSize, qrSize)

  // Bloque "validar credencial": filetes naranjas arriba y abajo, padding 9 px.
  const rule = my(2)
  let backY = qrTop + qrSize + my(4)
  pdf.setFillColor(...orange);pdf.rect(0,backY,CARD_W,rule,'F')
  backY += rule + my(9)
  pdf.setTextColor(20);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(11))
  const validarLine = my(11 * 1.2)
  ;['VALIDAR CREDENCIAL','Y GUARDAR CONTACTO'].forEach((line,i) => pdf.text(line, CARD_W/2, backY + validarLine*i, { align:'center', baseline:'top' }))
  backY += 2 * validarLine + my(9)
  pdf.setFillColor(...orange);pdf.rect(0,backY,CARD_W,rule,'F')

  // Texto de propiedad: padding 15 px, cuerpo 9 px con interlineado 1,55.
  backY += rule + my(15)
  const bodyLine = my(9 * 1.55)
  pdf.setFont('helvetica','normal');pdf.setFontSize(ptFromPx(9))
  pdf.setTextColor(35);pdf.text('Esta credencial es propiedad de', CARD_W/2, backY, { align:'center', baseline:'top' })
  pdf.setTextColor(...orange);pdf.setFont('helvetica','bold')
  pdf.text('Fly Kitchen S.A.', CARD_W/2, backY + bodyLine, { align:'center', baseline:'top' })
  pdf.setTextColor(35);pdf.setFont('helvetica','normal')
  pdf.text('En caso de extravío,', CARD_W/2, backY + bodyLine*3, { align:'center', baseline:'top' })
  pdf.text('remitir a Recursos Humanos.', CARD_W/2, backY + bodyLine*4, { align:'center', baseline:'top' })

  // Banda inferior con el lema: mismo alto que la de vencimiento del frente.
  pdf.setFillColor(...orange);pdf.rect(0,expiryTop,CARD_W,expiryH,'F')
  pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(8))
  pdf.text('ALIMENTAMOS LO QUE NOS MUEVE', CARD_W/2, expiryTop + expiryH/2, { align:'center', baseline:'middle' })

  pdf.save(`Credencial-${name.replace(/\s+/g,'-')}.pdf`)
}

export function coverImageData(dataUrl,width,height,posX=50,posY=50,zoom=1){
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

// Dibuja una imagen dentro de la caja indicada como lo hace `object-fit: contain`
// de CSS: conserva SIEMPRE la relación de aspecto original, la achica de forma
// proporcional si no entra y la centra en los dos ejes. Nunca la estira.
export function addContainImage(pdf,dataUrl,x,y,width,height){
  const props=pdf.getImageProperties(dataUrl)
  const naturalWidth=Number(props?.width),naturalHeight=Number(props?.height)
  // Sin dimensiones válidas no se puede preservar la proporción: se omite el
  // dibujo en lugar de deformar la imagen o emitir un PDF con medidas NaN.
  if(!(naturalWidth>0)||!(naturalHeight>0))return
  const scale=Math.min(width/naturalWidth,height/naturalHeight)
  const renderedWidth=naturalWidth*scale,renderedHeight=naturalHeight*scale
  pdf.addImage(dataUrl,props.fileType,x+(width-renderedWidth)/2,y+(height-renderedHeight)/2,renderedWidth,renderedHeight,undefined,'FAST')
}
