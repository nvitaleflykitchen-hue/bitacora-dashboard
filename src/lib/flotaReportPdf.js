import { jsPDF } from 'jspdf'
import { fleetDate, fleetDateTime, fleetToday, closedTicket, interventionDate, interventionKind } from './flotaModel'

const value = (v) => v === null || v === undefined || v === '' ? 'Sin registrar' : String(v)
const slug = v => String(v || 'vehiculo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
const date = fleetDate
const money = v => v == null || v === '' ? 'Sin registrar' : `$ ${Number(v).toLocaleString('es-AR')}`

export function vehicleReportFilename(items, siteName) {
  const name = items.length === 1 ? items[0].vehicle.nombre : `sede_${siteName}`
  return `informe_flota_${slug(name)}_${fleetToday()}.pdf`
}

export function createVehicleReportPdf(items, siteName) {
  if (!items.length) throw new Error('No hay vehículos seleccionados.')
  const pdf = new jsPDF({ unit:'mm', format:'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const margin = 16
  let y = 17

  function next(need = 6) {
    if (y + need <= height - 19) return
    pdf.addPage(); y = 18
  }
  function line(text, { bold = false, size = 8.5, muted = false, indent = 0 } = {}) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(muted ? 110 : 35)
    const lines = pdf.splitTextToSize(value(text), width - 2 * margin - indent)
    for (const part of lines) { next(4.5); pdf.text(part, margin + indent, y); y += 4.5 }
    y += 1.2
  }
  function section(title) {
    next(26); y += 3
    pdf.setDrawColor(42,125,35); pdf.setLineWidth(0.35); pdf.line(margin,y,width-margin,y); y += 5
    line(title,{bold:true,size:10})
  }
  function entry(title, details = []) {
    next(12); line(title,{bold:true})
    details.filter(Boolean).forEach(detail => line(detail,{indent:3,muted:true}))
    y += 1
  }
  function evidence(attachments) {
    if (!attachments.length) { line('Evidencia: sin adjuntos',{indent:3,muted:true}); return }
    attachments.forEach(a => {
      next(5)
      const label = `Evidencia: ${String(a.nombre || 'Adjunto').slice(0,90)}`
      if (a.url) {
        pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); pdf.setTextColor(25,90,150)
        pdf.textWithLink(label,margin+3,y,{url:a.url}); y += 5.7
      } else line(label,{indent:3,muted:true})
    })
  }
  function empty(rows, message) { if (!rows.length) line(message,{muted:true}) }

  pdf.setFont('helvetica','bold'); pdf.setFontSize(17); pdf.setTextColor(25)
  pdf.text('Informe de Flota', margin, y); y += 8
  line(`Sede: ${siteName || 'Varias sedes'}  |  Vehículos: ${items.length}`)
  line(`Emitido: ${fleetDateTime(new Date())}`,{muted:true})

  if (items.length > 1) {
    section('Resumen de la selección')
    line(`Operativos: ${items.filter(i => i.vehicle.estado === 'operativo').length}  |  En reparación: ${items.filter(i => i.vehicle.estado === 'en_reparacion').length}  |  Otros: ${items.filter(i => !['operativo','en_reparacion'].includes(i.vehicle.estado)).length}`)
    items.forEach(({vehicle,documentation,tickets,plans}) => {
      const expired = documentation.filter(d => d.fecha_vencimiento && d.fecha_vencimiento < fleetToday()).length
      entry(vehicle.nombre,[`Estado: ${value(vehicle.estado)}  |  Documentos vencidos: ${expired}  |  Tickets: ${tickets.length}  |  Planes: ${plans.length}`])
    })
  }

  items.forEach((item,index) => {
    if (index || items.length > 1) { pdf.addPage(); y = 18 }
    const {vehicle:v,documentation,fleetDocuments,plans,tickets,news,scaleReports = [],checks,extinguishers} = item
    line(`${index+1}. ${v.nombre}`,{bold:true,size:14})
    line(`Sede: ${value(v.sede_nombre)}  |  Estado: ${value(v.estado)}  |  Responsable: ${value(v.responsable)}`)

    section('Ficha del vehículo')
    line(`Código: ${value(v.codigo_interno)}  |  Categoría: ${value(v.categoria)}  |  Marca/modelo: ${value([v.marca,v.modelo].filter(Boolean).join(' '))}`)
    line(`Dominio: ${value(v.dominio)} (${v.dominio_fuente})  |  Serie interna: ${value(v.numero_serie)}`)
    line(`Año: ${value(v.anio)}  |  Combustible: ${value(v.combustible)}${v.datos_en_notas ? ' (datos conservados en notas)' : ''}`)
    line(`Última lectura: ${item.reading?.km == null ? 'Sin registrar' : Number(item.reading.km).toLocaleString('es-AR')+' km'}  |  Fecha: ${date(item.reading?.fecha)}  |  Fuente: ${value(item.reading?.fuente)}`)
    line('La última lectura registrada no certifica el kilometraje actual.',{muted:true})
    line(`Proveedor habitual: ${value(v.proveedor_nombre)}`)
    line(`Ubicación: ${value(v.ubicacion_detalle)}  |  Bien concesionado: ${v.bien_concesionado === true ? 'Sí' : v.bien_concesionado === false ? 'No' : 'Sin definir'}`)
    if (v.concesion_propietario || v.concesion_referencia) line(`Concedente: ${value(v.concesion_propietario)}  |  Referencia: ${value(v.concesion_referencia)}`)
    if (v.notas || v.estado_notas) line(`Notas: ${[v.notas,v.estado_notas].filter(Boolean).join(' · ')}`)

    if(v.notas_tecnico) { section('Observaciones y recomendaciones técnicas'); line(v.notas_tecnico) }
    section('Controles de consistencia')
    if(!item.warnings?.length) line('Sin contradicciones detectadas por los controles automáticos.')
    ;(item.warnings || []).forEach(w=>line(w))
    section('Vencimientos principales')
    ;[['Seguro',v.vencimiento_seguro],['VTV',v.vencimiento_vtv],['SENASA',v.vencimiento_senasa],['RMTSA',v.vencimiento_rmtsa]].forEach(([name,d]) => line(`${name}: ${date(d)}${d && d < fleetToday() ? ' · VENCIDO' : ''}`))
    if (v.numero_poliza) line(`Póliza: ${v.numero_poliza}`)

    section('Documentación de auditoría / Flota')
    documentation.forEach(d => { entry(d.titulo,[
      `Estado: ${d.fecha_vencimiento && d.fecha_vencimiento < fleetToday() ? 'VENCIDO POR FECHA; declarado '+value(d.estado) : d.registered ? value(d.estado) : 'Sin cargar'}  |  Vence: ${date(d.fecha_vencimiento)}  |  Aviso: ${value(d.aviso_dias || 30)} días`,
      d.observacion ? `Observación: ${d.observacion}` : null,
    ]); evidence(d.attachments) })

    section('Otros documentos vinculados')
    empty(fleetDocuments,'Sin documentos adicionales vinculados.')
    fleetDocuments.forEach(d => { entry(d.titulo,[`Tipo: ${value(d.tipo)}  |  Estado: ${value(d.estado)}  |  Vigente desde: ${date(d.vigente_desde)}  |  Vence: ${date(d.vencimiento)}`, d.notas ? `Notas: ${d.notas}` : null]); evidence(d.attachments) })

    section('Mantenimiento preventivo')
    empty(plans,'Sin planes preventivos registrados.')
    plans.forEach(p => entry(p.nombre,[`Estado: ${value(p.estado)} · Activo: ${p.activo === false ? 'No' : p.activo === true ? 'Sí' : 'Sin registrar'}  |  Frecuencia: ${value(p.frecuencia)}  |  Próximo: ${date(p.proxima_fecha)}  |  Último: ${date(p.ultimo_realizado)}`, p.descripcion ? `Descripción: ${p.descripcion}` : null, `Responsable: ${value(p.responsable_nombre || p.responsable)}`, ...p.executions.map(e => `Ejecución ${date(e.fecha)} · ${value(e.realizado_por)} · ${value(e.observaciones)} · Costo ${money(e.costo)}`)]))

    for (const [title, subset] of [['Tickets abiertos y pendientes',tickets.filter(t=>!closedTicket(t))],['Historial de intervenciones y diagnósticos',tickets.filter(closedTicket)]]) {
      section(title)
      empty(subset,'Sin registros en esta sección.')
      subset.forEach(t=>{
        entry(`Ticket ${value(t.numero || t.id)} · ${interventionKind(t)} · Estado: ${value(t.estado)}`, [
          `Fecha efectiva: ${date(interventionDate(t))} | Incorporación al sistema: ${fleetDateTime(t.created_at)}`,
          `${value(t.tipo)} · ${value(t.descripcion)}`,
          t.trabajo_realizado ? `Trabajo registrado: ${t.trabajo_realizado}` : null,
          t.diagnostico ? `Diagnóstico / garantía informada: ${t.diagnostico}` : null,
          `Proveedor: ${value(t.proveedor_nombre)} | Responsable: ${value(t.responsable)} | Lectura: ${value(t.lectura_km)} km`,
          `Presupuesto: ${money(t.presupuesto ?? t.costo_estimado)} (no acredita pago)`,
          t.costo_real == null ? 'Costo real acreditado: sin constancia.' : `Costo real declarado: ${money(t.costo_real)}; verificar comprobante, no implica pago acreditado.`,
          t.notas_costos ? `Notas económicas: ${t.notas_costos}` : null,
        ])
        evidence([...(t.attachments || []),...(t.evidencia_url ? [{nombre:'Documento de origen / proveedor',url:t.evidencia_url}] : [])])
      })
    }

    section('Reportes de escala vinculados')
    empty(scaleReports,'Sin reportes de escala vinculados a este vehículo.')
    scaleReports.forEach(n => {
      const source = n.sourceReport
      entry(`Registro #${n.registro_id} · ${date(source?.fecha_reporte || n.fecha_reporte || n.created_at)}`,[
        `Reportó: ${value(source?.reportante || n.reportante || source?.email_reportante)}  |  Turno: ${value(source?.turno)}  |  Sede: ${value(source?.sede_nombre || n.sede_nombre)}`,
        `Tipo: ${value(n.tipo)}  |  Estado de la novedad: ${value(n.estado)}`,
        `Texto reportado sobre el vehículo: ${value(n.descripcion)}`,
        !source ? 'La ficha del registro de escala no está disponible; se muestran los datos guardados en la novedad.' : null,
      ])
    })

    section('Novedades operativas')
    empty(news,'Sin otras novedades registradas fuera de reportes de escala.')
    news.forEach(n => entry(`${date(n.fecha_reporte || n.created_at)} · ${value(n.tipo)} · ${value(n.estado)}`,[n.descripcion,`Reportó: ${value(n.reportante)}`]))

    section('Checklists de vehículo')
    empty(checks,'Sin controles registrados.')
    checks.forEach(c => entry(`${date(c.fecha)} · ${value(c.estado)} · ${value(c.conductor || c.visitante)}`,[`KM: ${value(c.km)}  |  Observaciones: ${value(c.observaciones)}`, ...Object.entries(c.respuestas || {}).map(([key,answer]) => `${key}: ${value(answer)}`)]))

    section('Matafuegos asignados')
    empty(extinguishers,'Sin matafuegos asociados directamente al vehículo.')
    extinguishers.forEach(m => line(`${value(m.codigo)} · ${value(m.tipo)} · ${value(m.estado)} · Vence ${date(m.vencimiento)}`))
  })

  const pages = pdf.internal.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p); pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(125)
    pdf.text('Fly Gestión · Informe de Flota',margin,height-10)
    pdf.text(`${p} / ${pages}`,width-margin,height-10,{align:'right'})
  }
  return pdf
}

export function downloadVehicleReportPdf(items, siteName) {
  createVehicleReportPdf(items,siteName).save(vehicleReportFilename(items,siteName))
}
