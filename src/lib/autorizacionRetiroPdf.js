const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fechaEnLetras(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? `${day} de ${MONTHS[month - 1]} de ${year}` : ''
}

function safeName(value) {
  return String(value || 'empresa').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '_')
}

async function imageData(url) {
  const response = await fetch(url, { cache:'force-cache' })
  if (!response.ok) throw new Error(`No se pudo cargar el recurso ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

export async function crearAutorizacionRetiroPDF({ empresa, origen, fecha, referencia }) {
  const { jsPDF } = await import('jspdf')
  const [logo, firma] = await Promise.all([
    imageData('/recursos/operaciones/fly-kitchen-logo.png'),
    imageData('/recursos/operaciones/firma-marcela-corte.jpg'),
  ])
  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const left = 24
  const right = 186
  const width = right - left
  doc.addImage(logo, 'PNG', left, 13, 45, 18)
  doc.setFont('helvetica','normal'); doc.setFontSize(11)
  doc.text(`Córdoba, ${fechaEnLetras(fecha)}`, right, 25, { align:'right' })
  let y = 48
  const paragraph = (text, { bold=false, indent=0, gap=6 }={}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(11.5)
    const lines = doc.splitTextToSize(text, width - indent)
    doc.text(lines, left + indent, y, { lineHeightFactor:1.35 })
    y += lines.length * 5.5 + gap
  }
  paragraph(String(empresa).toUpperCase(), { bold:true, gap:2 })
  paragraph('Presente', { gap:9 })
  paragraph('Yo, MARCELA LILIANA CORTE en mi carácter de PRESIDENTE de Fly Kitchen S. A. CUIT 30-70728569-5, autorizo a los Sres. PABLO OCAMPO DNI 37.316.088, FERNANDO GONZÁLEZ DNI 42.896.086, BRAIAN CABALLERO DNI 43.229.305, NAHUEL PEDANO DNI 43.450.813, KEVIN RAMALLO DNI 38.106.268 y MAURO BERTOLA DNI 42.979.180 a retirar un envío a nombre de la firma, según el siguiente detalle:', { indent:10, gap:9 })
  paragraph(`Origen: ${origen}`)
  paragraph('Destino: CÓRDOBA')
  paragraph(`Guía Nro. / Remito / Factura: ${referencia || '—'}`, { gap:10 })
  paragraph('Desde ya, muchísimas gracias por su colaboración.', { gap:8 })
  paragraph('Sin otro particular, la saluda atentamente,', { gap:1 })
  doc.addImage(firma, 'JPEG', left, y, 38, 38)
  doc.setDrawColor(120); doc.setLineWidth(0.25); doc.line(left, 272, right, 272)
  doc.setFont('helvetica','bold'); doc.setFontSize(9)
  doc.text('FLY KITCHEN S.A.', left, 278)
  doc.text('Av. La Voz del Interior N° 7660 – Córdoba – Argentina', left, 283)
  doc.text('www.flykitchen.com.ar', left, 288)
  return doc.output('blob')
}

export async function entregarAutorizacionRetiro(datos, compartir=false) {
  const blob = await crearAutorizacionRetiroPDF(datos)
  const filename = `Autorizacion_Retiro_${safeName(datos.empresa)}_${datos.fecha}.pdf`
  const file = new File([blob], filename, { type:'application/pdf' })
  if (compartir && navigator.share && navigator.canShare?.({ files:[file] })) {
    await navigator.share({ title:'Autorización de retiro de encomienda', files:[file] })
    return 'shared'
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return 'downloaded'
}
