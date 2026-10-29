import { supabase, db } from './supabase'
import { getVehiculoDocumentacionTemplate } from './documentacion'
import { vehicleIdentity, lastReading, fleetWarnings, ticketDate } from './flotaModel'

const CHECKLIST_PREFIX = 'CHECKLIST_VEHICULO::'

export async function readAll(query) {
  const rows=[]
  for(let from=0;;from+=500) {
    const {data,error}=await query.range(from,from+499)
    if(error) throw error
    rows.push(...(data || []))
    if(!data || data.length<500) return rows
  }
}

function parseChecklist(row) {
  if (!String(row.observacion || '').startsWith(CHECKLIST_PREFIX)) return null
  try { return { ...JSON.parse(row.observacion.slice(CHECKLIST_PREFIX.length)), fecha:row.fecha, visitante:row.visitante } }
  catch { return null }
}

export function groupVehicleReport(vehicles, rows) {
  const reportsById = new Map((rows.reports || []).map(row => [String(row.id), row]))
  return vehicles.map(rawVehicle => {
    const vehicle=vehicleIdentity(rawVehicle)
    vehicle.proveedor_nombre=(rows.providers || []).find(p=>p.id===vehicle.proveedor_servicio_id)?.nombre || null
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
    const tickets=[...new Map(rows.tickets.filter(row=>String(row.activo_id)===id).map(t=>[t.id,t])).values()].map(t=>({...t,proveedor_nombre:(rows.providers || []).find(p=>p.id===t.proveedor_id)?.nombre || null,attachments:rows.attachments.filter(a=>a.entity_type==='ticket' && a.entity_id===String(t.id))})).sort((a,b)=>String(ticketDate(b)||'').localeCompare(String(ticketDate(a)||'')) || String(a.id).localeCompare(String(b.id)))
    const checks=rows.visits.filter(row=>String(row.activo_id)===id).map(parseChecklist).filter(Boolean)
    return {
      vehicle,
      reading:lastReading(vehicle,tickets,checks),
      warnings:fleetWarnings(vehicle,documentation,plans),
      documentation,
      fleetDocuments:rows.fleetDocuments.filter(row => String(row.activo_id) === id).map(item => ({ ...item, attachments:rows.attachments.filter(a => a.entity_type === 'flota_documento' && a.entity_id === String(item.id)) })),
      plans,
      tickets,
      news:news.filter(row => !row.registro_id),
      scaleReports:news.filter(row => row.registro_id).map(row => ({ ...row, sourceReport:reportsById.get(String(row.registro_id)) || null })),
      checks,
      extinguishers:rows.extinguishers.filter(row => String(row.activo_id) === id),
    }
  })
}

export async function loadVehicleReport(vehicles) {
  if (!vehicles.length) throw new Error('Seleccioná al menos un vehículo.')
  const ids = vehicles.map(v => v.id)
  const stringIds = ids.map(String)
  const freshVehicles=await readAll(supabase.from('mnt_activos').select('*').in('id',ids).order('id'))
  if(freshVehicles.length!==new Set(ids).size) throw Error('Una ficha ya no está disponible. Actualizá la selección antes de generar.')
  const [documentation, fleetDocuments, plans, tickets, news, visits, extinguishers] = await Promise.all([
    readAll(db().from('documentacion_items').select('*').eq('entity_type','vehiculo').in('entity_id',stringIds).order('id')),
    readAll(supabase.from('mnt_documentos_flota').select('*').in('activo_id',ids).order('id')),
    readAll(supabase.from('mnt_planes').select('*').in('activo_id',ids).order('id')),
    readAll(supabase.schema('mantenimiento').from('tickets').select('*').in('activo_id',ids).order('created_at',{ascending:false}).order('id')),
    readAll(db().from('vehiculo_novedades').select('*').in('activo_id',ids).order('fecha_reporte',{ascending:false}).order('id')),
    readAll(supabase.from('mnt_visitas').select('*').eq('activo_tipo','VEHICULO').in('activo_id',ids).order('fecha',{ascending:false}).order('id')),
    readAll(supabase.from('mnt_matafuegos').select('*').in('activo_id',ids).order('id')),
  ])
  const planIds = plans.map(p => p.id)
  const reportIds = [...new Set(news.map(n => n.registro_id).filter(Boolean))]
  const reports = reportIds.length ? await readAll(db().from('registros').select('id,fecha_reporte,reportante,email_reportante,sede_id,sede_nombre,turno').in('id',reportIds).order('id')) : []
  const executions = planIds.length ? await readAll(supabase.from('mnt_ejecuciones').select('*').in('plan_id',planIds).order('fecha',{ascending:false}).order('id')) : []
  const docIds = documentation.map(item => String(item.id))
  const fleetIds = fleetDocuments.map(item => String(item.id))
  const [docAttachments, fleetAttachments, ticketAttachments] = await Promise.all([
    docIds.length ? readAll(db().from('adjuntos').select('entity_type,entity_id,nombre,url,descripcion').eq('entity_type','documentacion_item').in('entity_id',docIds).order('id')) : [],
    fleetIds.length ? readAll(db().from('adjuntos').select('entity_type,entity_id,nombre,url,descripcion').eq('entity_type','flota_documento').in('entity_id',fleetIds).order('id')) : [],
    tickets.length ? readAll(db().from('adjuntos').select('entity_type,entity_id,nombre,url,descripcion').eq('entity_type','ticket').in('entity_id',tickets.map(t=>String(t.id))).order('id')) : [],
  ])
  const providerIds=[...new Set([...freshVehicles.map(v=>v.proveedor_servicio_id),...tickets.map(t=>t.proveedor_id)].filter(Boolean))]
  const providers=providerIds.length ? await readAll(supabase.from('mnt_proveedores').select('id,nombre').in('id',providerIds).order('id')) : []
  return groupVehicleReport(freshVehicles, { documentation, fleetDocuments, plans, tickets, news, reports, visits, extinguishers, executions, providers, attachments:[...docAttachments,...fleetAttachments,...ticketAttachments] })
}
