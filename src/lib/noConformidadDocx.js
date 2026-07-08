import { format } from 'date-fns'
import { getAdjuntos } from './adjuntos'
import { FLY_KITCHEN_LOGO_PNG } from '../assets/flyKitchenLogo'

// Informe editable (.docx) de una No Conformidad (NC).
// Mismo contenido que el informe PDF (noConformidadPdf.js) pero en Word editable.
// La librería `docx` se carga de forma diferida (dynamic import) para no engordar
// el bundle principal — solo se descarga cuando el usuario pide el Word.

const ORANGE = 'ED8916'
const DARK    = '141414'
const GRAY    = '5A5A5A'

function fmt(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd/MM/yyyy') } catch { return String(d) }
}

function dataUrlToUint8(dataUrl) {
  const b64 = dataUrl.split(',')[1] || ''
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

async function fetchImage(url) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/**
 * Genera y descarga el informe editable (.docx) de una No Conformidad.
 * @param {object} nc  Fila de bitacora.no_conformidades
 * @param {object} [opts] { creadorNombre, capa }
 */
export async function generarInformeNoConformidadDOCX(nc, opts = {}) {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  } = await import('docx')

  const creadorNombre = opts.creadorNombre || nc.creadorNombre || nc.created_by || '—'
  const capa = opts.capa || nc.capa || []
  const adjuntos = await getAdjuntos('no_conformidad', nc.id).catch(() => [])

  // Precargar imágenes (logo + evidencia)
  const logoBytes = (() => { try { return dataUrlToUint8(FLY_KITCHEN_LOGO_PNG) } catch { return null } })()
  const imagenesAdj = adjuntos.filter(a => a.tipo === 'archivo' && a.mime_type?.startsWith('image/'))
  const evidencias = []
  for (const a of imagenesAdj) {
    const bytes = await fetchImage(a.url)
    if (bytes) evidencias.push({ bytes, nombre: a.nombre || 'Evidencia' })
  }

  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: 'C8C8C8' }
  const allThin = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

  const H = (txt) => new Paragraph({
    spacing: { before: 220, after: 90 },
    children: [new TextRun({ text: txt, bold: true, size: 24, color: DARK })],
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: ORANGE, space: 6 } },
  })
  const P = (txt) => new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: txt || 'Sin información registrada.', size: 20, color: '232323' })],
  })
  const KV = (label, val) => new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: `${label}  `, bold: true, size: 20, color: '282828' }),
      new TextRun({ text: String(val ?? '—'), size: 20, color: '333333' }),
    ],
  })

  const children = []

  // ── Membrete (tabla: logo | título | meta) ──
  const logoCellChildren = logoBytes
    ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new ImageRun({ data: logoBytes, transformation: { width: 150, height: 58 } }),
      ] })]
    : [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'FLY KITCHEN', bold: true, color: ORANGE })] })]

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder, insideHorizontal: thinBorder, insideVertical: thinBorder },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, verticalAlign: 'center', children: logoCellChildren }),
      new TableCell({ width: { size: 44, type: WidthType.PERCENTAGE }, verticalAlign: 'center', children: [
        new Paragraph({ children: [new TextRun({ text: 'Informe de No Conformidad (NC)', bold: true, size: 26, color: DARK })] }),
        new Paragraph({ children: [new TextRun({ text: 'Gestión de Calidad · Recepción y Proveedores', size: 18, color: GRAY })] }),
        new Paragraph({ children: [new TextRun({ text: 'FLY KITCHEN — Empresa de Catering', bold: true, size: 18, color: ORANGE })] }),
      ] }),
      new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, verticalAlign: 'center', children: [
        new Paragraph({ children: [new TextRun({ text: 'REV: 00', size: 18, color: '3C3C3C' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Creación: 06/2026', size: 18, color: '3C3C3C' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Norma: ISO 9001:2015', size: 18, color: '3C3C3C' })] }),
      ] }),
    ] })],
  }))

  // ── Identificación ──
  children.push(new Paragraph({
    spacing: { before: 200, after: 20 },
    children: [new TextRun({ text: nc.codigo || 'NC sin código', bold: true, size: 32, color: DARK })],
  }))
  children.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: `Estado: ${nc.estado || '—'}   ·   Categoría: ${nc.categoria || '—'}`, size: 20, color: GRAY })],
  }))

  // ── Datos del hallazgo y registro ──
  children.push(H('Datos del Hallazgo y Registro'))
  children.push(KV('Código NC:', nc.codigo))
  children.push(KV('Fecha de apertura:', fmt(nc.fecha_apertura)))
  children.push(KV('Sede / Origen:', nc.sede_nombre || 'No asignada'))
  children.push(KV('Categoría:', nc.categoria))
  children.push(KV('Responsable:', nc.responsable))
  children.push(KV('Creado por:', creadorNombre))
  if (nc.fecha_cierre) children.push(KV('Fecha de cierre:', fmt(nc.fecha_cierre)))

  // ── Datos de producto / proveedor (solo campos cargados) ──
  const productoRows = [
    ['Producto:', nc.producto],
    ['Marca:', nc.marca],
    ['Lote:', nc.lote],
    ['Presentación:', nc.presentacion],
    ['Proveedor:', nc.proveedor],
    ['Fecha de recepción:', nc.fecha_recepcion ? fmt(nc.fecha_recepcion) : null],
    ['Vencimiento:', nc.vencimiento ? fmt(nc.vencimiento) : null],
  ].filter(([, v]) => v)
  if (productoRows.length > 0) {
    children.push(H('Datos de Producto / Proveedor'))
    productoRows.forEach(([label, val]) => children.push(KV(label, val)))
  }

  // ── Detalle ──
  children.push(H('Detalle de la No Conformidad'))
  children.push(P(nc.descripcion))

  // ── Causa raíz ──
  if (nc.causa_raiz) {
    children.push(H('Causa Raíz'))
    children.push(P(nc.causa_raiz))
  }

  // ── Evidencia fotográfica ──
  children.push(H('Registro Fotográfico de Evidencia'))
  if (evidencias.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Sin evidencia adjunta registrada en la app.', italics: true, size: 18, color: '828282' })] }))
  } else {
    for (const ev of evidencias) {
      children.push(new Paragraph({ spacing: { before: 80 }, children: [
        new ImageRun({ data: ev.bytes, transformation: { width: 300, height: 220 } }),
      ] }))
      children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: ev.nombre, size: 16, color: '6E6E6E' })] }))
    }
  }

  // ── Plan CAPA ──
  if (capa.length > 0) {
    children.push(H(`Plan de Acción Correctiva / Preventiva (CAPA) — ${capa.length}`))
    for (const c of capa) {
      children.push(new Paragraph({ spacing: { after: 50 }, children: [
        new TextRun({ text: `${c.codigo || 'CAPA'} [${c.tipo || '—'}] `, bold: true, size: 18, color: DARK }),
        new TextRun({ text: `${c.descripcion || ''}  ·  Estado: ${c.estado || '—'}`, size: 18, color: '3C3C3C' }),
      ] }))
    }
  }

  // ── Acción y disposición (tabla) ──
  children.push(H('Acción y Disposición'))
  const cerrada = ['Cerrada', 'Verificada'].includes(nc.estado)
  const accRow = (label, val) => new TableRow({ children: [
    new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })] })] }),
    new TableCell({ width: { size: 68, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: String(val), size: 18 })] })] }),
  ] })
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder, insideHorizontal: thinBorder, insideVertical: thinBorder },
    rows: [
      accRow('Estado actual:', nc.estado || '—'),
      accRow('Acción inmediata:', cerrada ? 'No conformidad tratada / cerrada' : 'En gestión — ver plan CAPA'),
      accRow('Disposición final:', nc.fecha_cierre ? `Cerrada el ${fmt(nc.fecha_cierre)}` : 'Pendiente de cierre'),
    ],
  }))

  // ── Firmas ──
  children.push(new Paragraph({ spacing: { before: 400 }, children: [] }))
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: '787878' } }, children: [new TextRun({ text: 'Responsable de Calidad', size: 18, color: '3C3C3C' })] }),
      ] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: '787878' } }, children: [new TextRun({ text: 'Responsable de Planta / Sede', size: 18, color: '3C3C3C' })] }),
      ] }),
    ] })],
  }))

  // ── Control de cambios ──
  children.push(new Paragraph({ spacing: { before: 300, after: 60 }, children: [new TextRun({ text: 'CONTROL DE CAMBIOS', bold: true, size: 16, color: GRAY })] }))
  const ccHead = ['Fecha', 'Versión', 'Descripción del cambio', 'Elabora']
  const ccRow  = ['01/06/26', '00', 'Creación del documento', 'Responsable de Calidad']
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder, insideHorizontal: thinBorder, insideVertical: thinBorder },
    rows: [
      new TableRow({ children: ccHead.map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16 })] })] })) }),
      new TableRow({ children: ccRow.map(v => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v, size: 16 })] })] })) }),
    ],
  }))

  const doc = new Document({
    creator: 'Bitácora In Situ — Fly Kitchen',
    title: `Informe NC ${nc.codigo || ''}`,
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  const base = (nc.codigo || 'NC').replace(/[^\w-]+/g, '_')
  downloadBlob(blob, `Informe_No_Conformidad_${base}.docx`)
}
