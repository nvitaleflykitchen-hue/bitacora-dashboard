import { supabase, db } from './supabase'
import { getVehiculoDocumentacionTemplate } from './documentacion'

const CHECKLIST_PREFIX = 'CHECKLIST_VEHICULO::'

async function read(query) {
  const { data, error } = await query
  if (error) throw error
  return data || []
}

function parseChecklist(row) {
  if (!String(row.observacion || '').startsWith(CHECKLIST_PREFIX)) return null
  try { return { ...JSON.parse(row.observacion.slice(CHECKLIST_PREFIX.length)), fecha:row.fecha, visitante:row.visitante } }
  catch { return null }
}

export function groupVehicleReport(vehicles, rows) {
  const reportsById = new Map((rows.reports || []).map(row => [String(row.id), row]))
  return vehicles.map(vehicle => {
    const id = String(vehicle.id)
    const docs = rows.documentation.filter(row => row.entity_id === id)
    const byCode = new Map(docs.map(row => [row.codigo, row]))
    const template = getVehiculoDocumentacionTemplate(vehicle.sede_nombre)
    const documentation = [
      ...template.map(item => ({ ...item, ...byCode.get(item.codigo), registered:byCode.has(item.codigo) })),
      ...docs.filter(item => !template.some(entry => entry.codigo === item.codigo)).map(item => ({ ...item, registered:true })),
    ].map(item => ({ ...item, attachments:rows.attachments.filter(a => a.entity_type === 'documentacion_item' && a.entity_id === String(item.id)) }))
    const plans = rows.plans.filter(row => String(row.activo_id) === id).map(plan => ({
      ...plan, executions:rows.executions.filter(row => String(row.plan_id) === String(plan.id)),
    }))
    const news = rows.news.filter(row => String(row.activo_id) === id)
    return {
      vehicle,
      documentation,
      fleetDocuments:rows.fleetDocuments.filter(row => String(row.activo_id) === id).map(item => ({ ...item, attachments:rows.attachments.filter(a => a.entity_type === 'flota_documento' && a.entity_id === String(item.id)) })),
      plans,
      tickets:rows.tickets.filter(row => String(row.activo_id) === id),
      news:news.filter(row => !row.registro_id),
      scaleReports:news.filter(row => row.registro_id).map(row => ({ ...row, sourceReport:reportsById.get(String(row.registro_id)) || null })),
      checks:rows.visits.filter(row => String(row.activo_id) === id).map(parseChecklist).filter(Boolean),
      extinguishers:rows.extinguishers.filter(row => String(row.activo_id) === id),
    }
  })
}

export async function loadVehicleReport(vehicles) {
  if (!vehicles.length) throw new Error('Seleccioná al menos un vehículo.')
  const ids = vehicles.map(v => v.id)
  const stringIds = ids.map(String)
  const [documentation, fleetDocuments, plans, tickets, news, visits, extinguishers] = await Promise.all([
    read(db().from('documentacion_items').select('*').eq('entity_type','vehiculo').in('entity_id',stringIds)),
    read(supabase.from('mnt_documentos_flota').select('*').in('activo_id',ids)),
    read(supabase.from('mnt_planes').select('*').in('activo_id',ids)),
    read(supabase.schema('mantenimiento').from('tickets').select('*').eq('categoria','Vehiculos').in('activo_id',ids).order('created_at',{ascending:false})),
    read(db().from('vehiculo_novedades').select('*').in('activo_id',ids).order('fecha_reporte',{ascending:false})),
    read(supabase.from('mnt_visitas').select('*').eq('activo_tipo','VEHICULO').in('activo_id',ids).order('fecha',{ascending:false})),
    read(supabase.from('mnt_matafuegos').select('*').in('activo_id',ids)),
  ])
  const planIds = plans.map(p => p.id)
  const reportIds = [...new Set(news.map(n => n.registro_id).filter(Boolean))]
  const reports = reportIds.length ? await read(db().from('registros').select('id,fecha_reporte,reportante,email_reportante,sede_id,sede_nombre,turno').in('id',reportIds)) : []
  const executions = planIds.length ? await read(supabase.from('mnt_ejecuciones').select('*').in('plan_id',planIds).order('fecha',{ascending:false})) : []
  const docIds = documentation.map(item => String(item.id))
  const fleetIds = fleetDocuments.map(item => String(item.id))
  const [docAttachments, fleetAttachments] = await Promise.all([
    docIds.length ? read(db().from('adjuntos').select('entity_type,entity_id,nombre,url,descripcion').eq('entity_type','documentacion_item').in('entity_id',docIds)) : [],
    fleetIds.length ? read(db().from('adjuntos').select('entity_type,entity_id,nombre,url,descripcion').eq('entity_type','flota_documento').in('entity_id',fleetIds)) : [],
  ])
  return groupVehicleReport(vehicles, { documentation, fleetDocuments, plans, tickets, news, reports, visits, extinguishers, executions, attachments:[...docAttachments,...fleetAttachments] })
}
