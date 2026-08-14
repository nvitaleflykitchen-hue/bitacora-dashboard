import { FLY_KITCHEN_LOGO_PNG } from '../assets/flyKitchenLogo'

const ORANGE = 'ED8916'
const BORDER = 'A6A6A6'

function imageBytes(dataUrl) {
  const binary = atob(dataUrl.split(',')[1] || '')
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function generarProgramacionPruebaDOCX(prueba) {
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = await import('docx')
  const border = { style:BorderStyle.SINGLE, size:5, color:BORDER }
  const borders = { top:border, bottom:border, left:border, right:border, insideHorizontal:border, insideVertical:border }
  const paragraph = (value, bold=false) => new Paragraph({ spacing:{ after:40 }, children:[new TextRun({ text:String(value || '—'), bold, size:19 })] })
  const field = (label, value) => new Paragraph({ spacing:{ before:60, after:60 }, children:[new TextRun({ text:`${label}: `, bold:true, size:19 }), new TextRun({ text:String(value || '—'), size:19 })] })
  const cell = (value, bold=false) => new TableCell({ children:[paragraph(value, bold)] })
  const sampleRows = prueba.muestras?.length ? prueba.muestras : [{ marca:'', elaboracion:'', lote:'', vencimiento:'' }]
  const sensoryRows = prueba.evaluacion_sensorial?.length ? prueba.evaluacion_sensorial : [{ muestra:'M1', sabor:'', aroma:'', color:'', textura:'' }]
  const responsibleNames = (prueba.responsables || []).map(item => item.nombre || item).filter(Boolean).join(', ')
  const children = [
    new Table({ width:{ size:100, type:WidthType.PERCENTAGE }, borders, rows:[new TableRow({ children:[
      new TableCell({ width:{ size:25, type:WidthType.PERCENTAGE }, children:[new Paragraph({ alignment:AlignmentType.CENTER, children:[new ImageRun({ data:imageBytes(FLY_KITCHEN_LOGO_PNG), transformation:{ width:125, height:48 } })] })] }),
      new TableCell({ width:{ size:50, type:WidthType.PERCENTAGE }, children:[new Paragraph({ alignment:AlignmentType.CENTER, children:[new TextRun({ text:'PROGRAMACIÓN DE PRUEBA', bold:true, size:25 })] }), new Paragraph({ alignment:AlignmentType.CENTER, children:[new TextRun({ text:'R-8.2.3.1.1', bold:true, color:ORANGE, size:18 })] })] }),
      new TableCell({ width:{ size:25, type:WidthType.PERCENTAGE }, children:[paragraph('REV: 00', true), paragraph(`N°: ${prueba.numero || 'Pendiente'}`), paragraph(`Fecha: ${prueba.fecha || '—'}`)] }),
    ] })] }),
    field('Área solicitante', prueba.area_solicitante), field('Proyecto I+D', prueba.titulo),
    field('Objetivo del ensayo', prueba.objetivo), field('Motivo / situación inicial', prueba.motivo),
    field('Responsables del ensayo', responsibleNames), field('Personal / sector involucrado', prueba.personal_involucrado),
    field('Material / proceso / proveedor', [prueba.proceso,prueba.proveedor].filter(Boolean).join(' / ')), field('Análisis / controles a realizar', prueba.controles),
    new Paragraph({ spacing:{ before:140, after:70 }, children:[new TextRun({ text:'IDENTIFICACIÓN Y TRAZABILIDAD DE MUESTRAS', bold:true, size:21, color:ORANGE })] }),
    new Table({ width:{ size:100, type:WidthType.PERCENTAGE }, borders, rows:[new TableRow({ children:['Marca / producto','Elaboración','Lote','Vencimiento'].map(value=>cell(value,true)) }), ...sampleRows.map(row=>new TableRow({ children:[row.marca,row.elaboracion,row.lote,row.vencimiento].map(value=>cell(value)) }))] }),
    new Paragraph({ spacing:{ before:140, after:70 }, children:[new TextRun({ text:'EVALUACIÓN SENSORIAL', bold:true, size:21, color:ORANGE })] }),
    new Table({ width:{ size:100, type:WidthType.PERCENTAGE }, borders, rows:[new TableRow({ children:['Muestra','Sabor','Aroma','Color','Textura'].map(value=>cell(value,true)) }), ...sensoryRows.map(row=>new TableRow({ children:[row.muestra,row.sabor,row.aroma,row.color,row.textura].map(value=>cell(value)) }))] }),
    paragraph('Escala: 1 Muy malo · 2 Malo · 3 Aceptable · 4 Bueno · 5 Muy bueno'),
    field('Destino del producto', prueba.destino_producto), field('Lista de distribución', prueba.lista_distribucion),
    field('Observaciones / condiciones especiales', prueba.condiciones_especiales || prueba.observaciones),
    new Paragraph({ spacing:{ before:320 }, children:[] }),
    new Table({ width:{ size:100, type:WidthType.PERCENTAGE }, borders, rows:[new TableRow({ children:[cell('Solicitante / Responsable de I+D\nFirma y fecha'), cell('Gerencia General / Área afectada\nAprobación y fecha')] })] }),
  ]
  const doc = new Document({ creator:'Fly Gestión', title:`Programación de Prueba ${prueba.numero || ''}`, sections:[{ properties:{ page:{ margin:{ top:720, right:720, bottom:720, left:720 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  const safeName = String(prueba.numero || prueba.titulo || 'borrador').replace(/[^a-z0-9_-]+/gi, '_')
  download(blob, `Programacion_Prueba_${safeName}.docx`)
}
