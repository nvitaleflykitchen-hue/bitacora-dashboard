import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Layouts are versioned with their immutable, sanitized PDF backgrounds.
const assets = { ppa_auto:'/formularios/ppa-auto-v1.pdf', anexo_e:'/formularios/anexo-e-v1.pdf' }
const clean = text => String(text ?? '').normalize('NFC').replace(/[\u2010-\u2015]/g, '-').replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?')
const name = p => [p?.apellido,p?.nombre].filter(Boolean).join(', ')
const date = value => value ? value.split('-').reverse().join('/') : ''

export async function createFormularioPdf(form, { templateBytes, preview = false } = {}) {
  if (!assets[form.plantilla.tipo] || form.plantilla.layout !== 1) throw new Error('Versión de diseño no compatible. Actualizá la aplicación.')
  if (!templateBytes) {
    const response = await fetch(assets[form.plantilla.tipo])
    if (!response.ok) throw new Error('No se pudo cargar la plantilla PDF.')
    templateBytes = await response.arrayBuffer()
  }
  const source = await PDFDocument.load(templateBytes)
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const data = form.datos, v = data.variables, people = data.personas
  if (!people?.length) throw new Error('El formulario necesita al menos una persona.')
  const extra = []
  function text(page, value, x, top, width, { size = 10, maxLines = 1, strong = false, label = '' } = {}) {
    const f = strong ? bold : font
    const lines = []; let line = ''
    for (const word of clean(value).split(/\s+/)) {
      // Split long tokens too: no text is allowed to run outside its cell.
      for (const part of (f.widthOfTextAtSize(word,size) <= width ? [word] : word.match(/.{1,18}/g) || [])) {
        if (line && f.widthOfTextAtSize(`${line} ${part}`,size) > width) { lines.push(line); line = part }
        else line = line ? `${line} ${part}` : part
      }
    }
    if (line) lines.push(line)
    const overflow = lines.length > maxLines
    if (overflow) extra.push(`${label || 'Detalle'}: ${value}`)
    lines.slice(0,maxLines).forEach((l,i) => page.drawText(overflow && i === maxLines - 1 ? '(Ver detalle complementario)' : l, { x, y:768-top-i*(size+3), size, font:f, color:rgb(0,0,0) }))
  }
  const perPage = form.plantilla.tipo === 'anexo_e' ? 5 : 1
  const pageCount = Math.ceil(people.length / perPage)
  for (let offset = 0; offset < people.length; offset += perPage) {
    const [page] = await doc.copyPages(source,[0]); doc.addPage(page)
    const group = people.slice(offset, offset+perPage)
    if (form.plantilla.tipo === 'ppa_auto') {
      const p = group[0], a = p.aeroportuario || {}
      text(page,'Solicito se autorice el otorgamiento del permiso de Seguridad Aeroportuario con AUTO-ACOMPAÑAMIENTO para:',66,216,455,{maxLines:2})
      text(page,name(p),66,253,455,{strong:true,label:'Solicitante'})
      text(page,`DNI: ${p.dni || 'SIN INFORMAR'}   Legajo: ${p.legajo || ''}`,66,265,455,{size:8})
      text(page,`Empresa: ${v.empresa}     Permiso Nº: ${a.ppa || 'SIN INFORMAR'}`,66,277,455,{maxLines:2})
      text(page,`Sectores: ${v.sectores}     Aeropuerto: ${v.aeropuerto || a.aeropuerto || ''}`,66,309,455,{maxLines:2})
      text(page,`Día/s: ${v.dias || date(v.fecha)}     Desde: ${v.desde} hs.     Hasta: ${v.hasta} hs.`,66,341,455)
      text(page,`Tareas a desarrollar: ${v.tareas}`,66,366,455,{maxLines:3,label:'Tareas'})
      text(page,'Asimismo, se deja constancia de que el solicitante tiene un permiso vigente y no podrá acceder a otros sectores que no estuviesen autorizados en el Permiso Personal Aeroportuario de Origen. Se adjunta copia del PPA.',66,431,455,{maxLines:4})
      text(page,`La presente solicitud es presentada por la Empresa/Organismo: ${v.empresa}`,66,502,455,{maxLines:2})
    } else {
      text(page,`Solicito se autorice el otorgamiento de ${people.length} PERMISO/S PERSONAL/ES AEROPORTUARIO/S DE SEGURIDAD CON ACOMPAÑAMIENTO.`,120,170,415,{maxLines:2})
      text(page,`Día/s: ${v.dias || date(v.fecha)}     Desde: ${v.desde} hs.     Hasta: ${v.hasta} hs.`,120,202,415)
      text(page,`Tareas: ${v.tareas}`,120,220,415,{maxLines:2,label:'Tareas'})
      const xs = [95,248,384,543], top = 250, row = 22
      page.drawRectangle({x:95,y:768-top-row,width:448,height:row,color:rgb(.8,.8,.8)})
      for(let i=0;i<=6;i++) page.drawLine({start:{x:95,y:768-top-i*row},end:{x:543,y:768-top-i*row},thickness:.7})
      for(const x of xs) page.drawLine({start:{x,y:768-top},end:{x,y:768-top-6*row},thickness:.7})
      ;['APELLIDO Y NOMBRE','TIPO Y Nº DE DOC.','CARGO / FUNCIÓN'].forEach((h,i)=>text(page,h,xs[i]+4,265,xs[i+1]-xs[i]-8,{size:9,strong:true}))
      group.forEach((p,i)=>{
        [name(p),`DNI ${p.dni || 'SIN INFORMAR'}`,p.puesto || ''].forEach((s,j)=>text(page,s,xs[j]+4,282+i*row,xs[j+1]-xs[j]-8,{size:8,maxLines:2,label:`Persona ${offset+i+1}`}))
      })
      text(page,'Se solicita acceso a los siguientes sectores (justificación por sector):',120,405,425)
      for(let i=1;i<=7;i++) text(page,`SECTOR ${i}: ${v.justificaciones?.[i] || (String(v.sectores).split(/\D+/).includes(String(i)) ? 'SOLICITADO - SIN JUSTIFICACIÓN' : 'No solicitado')}`,120,426+(i-1)*17,420,{size:9,label:`Sector ${i}`})
      text(page,'Asume la responsabilidad del ACOMPAÑAMIENTO establecida en la normativa vigente:',120,558,420,{size:9,maxLines:2})
      const a = data.acompanante, ap = a?.aeroportuario || {}
      text(page,`APELLIDO Y NOMBRE: ${name(a) || 'SIN INFORMAR'}`,120,583,420,{size:10})
      text(page,`Permiso Nº ${ap.ppa || 'SIN INFORMAR'}     Acceso a sectores: ${ap.sectores || ''}`,120,599,420,{size:10})
      text(page,`Cargo/Función: ${a?.puesto || ''}`,120,614,420,{size:10})
    }
    text(page,`${preview ? 'VISTA PREVIA - SIN EMITIR | ' : ''}${form.id || 'Borrador'} | v${form.plantilla.version} | ${offset/perPage+1}/${pageCount}`,65,747,480,{size:7})
  }
  if (v.observaciones) extra.push(`Observaciones: ${v.observaciones}`)
  if (extra.length) {
    let page, y = 750
    for(const entry of [...new Set(extra)]) {
      // Additional pages preserve full input rather than silently truncating it.
      const words = clean(entry).split(/\s+/).flatMap(word => font.widthOfTextAtSize(word,10)>450 ? word.match(/.{1,60}/g) : [word]); let line = ''
      const lines = []
      for(const word of words) { if(font.widthOfTextAtSize(`${line} ${word}`,10)>450 && line){lines.push(line);line=word}else line += `${line?' ':''}${word}` }
      if(line) lines.push(line)
      for(const l of lines) {
        if(y>705){page=doc.addPage([588,768]);text(page,'DETALLE COMPLEMENTARIO DEL FORMULARIO',65,50,460,{strong:true});text(page,`${form.id || 'Vista previa'} - ${form.plantilla.nombre}`,65,70,460,{size:8});y=105}
        text(page,l,65,y,450,{size:10}); y+=15
      }
      y+=15
    }
  }
  doc.setTitle(form.plantilla.nombre)
  doc.setSubject('Formulario administrativo. Las firmas se completan fuera de la aplicación.')
  return doc.save()
}
