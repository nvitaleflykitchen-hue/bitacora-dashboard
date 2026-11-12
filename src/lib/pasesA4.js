import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { crearPasePdf } from './pasesAcompanados'

export const PASES_POR_A4 = 11
const mm = value => value * 72 / 25.4
// CR80 vertical 54 x 85,6 mm. Dos columnas de 3 y una girada de 5.
// Márgenes mínimos 6,2 mm y separación de 2 mm para corte.
export function posicionPaseA4(index) {
  if (index < 0 || index >= PASES_POR_A4) throw new Error('Posición fuera de la hoja.')
  if (index < 6) return { x:6.2 + Math.floor(index/3)*56, y:9.5 + index%3*87.6, w:54, h:85.6, rotated:false }
  return { x:118.2, y:9.5 + (index-6)*56, w:85.6, h:54, rotated:true }
}
export function pasesUnicos(pases) {
  return [...new Map(pases.filter(p => p?.token).map(p => [p.token,p])).values()]
}
export async function crearPasesA4(pases) {
  const items=pasesUnicos(pases)
  if (!items.length) throw new Error('No hay pases para imprimir.')
  const pdf=await PDFDocument.create()
  pdf.setTitle('Pases Fly Kitchen - impresión A4')
  pdf.setAuthor('Fly Kitchen')
  let page
  for (let i=0;i<items.length;i++) {
    if (i%PASES_POR_A4===0) page=pdf.addPage([mm(210),mm(297)])
    const card=await crearPasePdf(items[i])
    const [embedded]=await pdf.embedPdf(card.output('arraybuffer'))
    const slot=posicionPaseA4(i%PASES_POR_A4)
    page.drawPage(embedded,{x:mm(slot.x+(slot.rotated?slot.w:0)),y:mm(297-slot.y-slot.h),width:mm(54),height:mm(85.6),rotate:degrees(slot.rotated?90:0)})
    // Marcas fuera de la tarjeta, sin invadir el diseño ni el QR.
    for(const x of [slot.x,slot.x+slot.w]) for(const y of [slot.y,slot.y+slot.h]) {
      const dx=x===slot.x?-1:1,dy=y===slot.y?-1:1
      page.drawLine({start:{x:mm(x+dx*.25),y:mm(297-y)},end:{x:mm(x+dx*.9),y:mm(297-y)},thickness:.3,color:rgb(.5,.5,.5)})
      page.drawLine({start:{x:mm(x),y:mm(297-y-dy*.25)},end:{x:mm(x),y:mm(297-y-dy*.9)},thickness:.3,color:rgb(.5,.5,.5)})
    }
  }
  return pdf.save()
}
export async function descargarPasesA4(pases) {
  const bytes=await crearPasesA4(pases)
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}))
  const link=document.createElement('a')
  link.href=url;link.download='Pases-Fly-Kitchen-A4.pdf'
  document.body.appendChild(link);link.click();link.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
