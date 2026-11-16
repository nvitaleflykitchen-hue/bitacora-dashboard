import { jsPDF } from 'jspdf'

const text = value => String(value ?? '').trim() || 'No informado'
const date = value => value ? String(value).slice(0,10).split('-').reverse().join('/') : 'No informada'
const states = { borrador:'Borrador', enviada_whatsapp:'Enviada a WhatsApp', recibiendo_cvs:'Recibiendo CVs', entrevistas:'Entrevistas', preocupacional:'Preocupacional', ingreso:'Ingreso', cerrada:'Cerrada', cancelada:'Cancelada' }

export function createRequerimientoPersonalPdf(s) {
  if (!s.id || !s.codigo_requerimiento) throw Error('Guardá el requerimiento antes de descargar su PDF con código.')
  const pdf = new jsPDF({unit:'pt',format:'a4'})
  const left=36, width=523
  pdf.setFillColor(25,48,40);pdf.rect(0,0,595.28,91,'F')
  pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(17)
  pdf.text('REQUERIMIENTO DE PERSONAL',left,33)
  pdf.setFontSize(13);pdf.text(s.codigo_requerimiento,left,57)
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.text('Fly Gestión | FlyKitchen | Recursos Humanos',left,77)
  pdf.setTextColor(25)
  const sections = [
    ['PUESTO Y SEDE', `${text(s.puesto)} | ${text(s.sede_nombre || s.sede?.nombre)}`],
    ['DATOS DEL REQUERIMIENTO', `Estado: ${states[s.estado] || text(s.estado)} | Cantidad: ${s.cantidad ?? 1} | Prioridad: ${text(s.urgencia)}\nApertura: ${date(s.fecha_apertura)} | Fecha requerida: ${date(s.fecha_necesidad)}\nSolicitante: ${text(s.responsable)} | Contacto: ${text(s.contacto)}`],
    ['CONDICIONES', `Horario: ${text(s.horario)} | Horas semanales: ${text(s.horas_semanales)}\nModalidad: ${text(s.modalidad)} | Período: ${text(s.periodo_necesidad)}\nCategoría: ${text(s.categoria)} | Sueldo / condiciones: ${text(s.sueldo_especificaciones)}`],
    ['MOTIVO', text(s.motivo)],
    ['TAREAS PRINCIPALES', text(s.tareas)],
    ['REQUISITOS Y EXPERIENCIA', `Requisitos: ${text(s.requisitos)}\nExperiencia: ${text(s.experiencia)}`],
    ['DOCUMENTACIÓN Y EVALUACIONES', `${text(s.documentacion)}\nEvaluación psicológica: ${s.requiere_psicologico?'Sí':'No'} | Intervención de Dirección: ${s.requiere_direccion?'Sí':'No'}`],
    ['OBSERVACIONES', text(s.observaciones)],
  ]
  let size=9.5, blocks, total
  do {
    pdf.setFontSize(size)
    blocks=sections.map(([label,body])=>({label,lines:pdf.splitTextToSize(body,width)}))
    total=blocks.reduce((sum,b)=>sum+22+b.lines.length*size*1.17,0)
    if(total<=665 || size<=8) break
    size-=0.5
  } while(size>=8)
  let abbreviated=false
  if(total>665){
    const available=Math.floor((665-blocks.length*22)/(size*1.17))
    const limits=blocks.map(b=>b.lines.length)
    while(limits.reduce((sum,n)=>sum+n,0)>available){
      const longest=limits.indexOf(Math.max(...limits))
      limits[longest]-=1
    }
    blocks=blocks.map((b,index)=>{
      const max=limits[index]
      if(b.lines.length<=max)return b
      abbreviated=true
      return {...b,lines:[...b.lines.slice(0,max-1),'[Continúa en la ficha de Fly Gestión]']}
    })
  }
  let y=111
  for(const b of blocks){
    pdf.setFillColor(237,241,238);pdf.rect(left-4,y-11,width+8,15,'F')
    pdf.setFont('helvetica','bold');pdf.setFontSize(8.5);pdf.text(b.label,left,y)
    y+=15;pdf.setFont('helvetica','normal');pdf.setFontSize(size)
    pdf.text(b.lines,left,y,{lineHeightFactor:1.17});y+=b.lines.length*size*1.17+7
  }
  pdf.setDrawColor(180);pdf.line(left,791,559,791)
  pdf.setFontSize(7);pdf.setTextColor(80)
  pdf.text(abbreviated?'Resumen A4: los campos extensos continúan en la ficha del mismo código.':'Documento de seguimiento de RRHH. Conserva el código del requerimiento original.',left,805)
  pdf.text(`ID interno: ${s.id}`,left,818)
  return pdf
}

export function downloadRequerimientoPersonalPdf(s) {
  const pdf=createRequerimientoPersonalPdf(s)
  pdf.save(`${s.codigo_requerimiento}.pdf`)
}
