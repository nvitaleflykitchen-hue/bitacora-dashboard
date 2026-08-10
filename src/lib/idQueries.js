import { db } from './supabase'

const table = name => db().from(name)

export async function getIdProjects(filters = {}) {
  let query = table('id_proyectos').select('*').order('updated_at', { ascending:false })
  if (filters.situacion) query = query.eq('situacion', filters.situacion)
  if (filters.etapa) query = query.eq('etapa', filters.etapa)
  if (filters.prioridad) query = query.eq('prioridad', filters.prioridad)
  if (filters.sedeId) query = query.eq('sede_id', filters.sedeId)
  if (filters.responsableId) query = query.eq('responsable_id', filters.responsableId)
  if (filters.search) {
    const safe = String(filters.search).replace(/[%_,()]/g, ' ').trim()
    if (safe) query = query.or(`codigo.ilike.%${safe}%,titulo.ilike.%${safe}%,objetivo.ilike.%${safe}%,categoria.ilike.%${safe}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createIdProject(payload) {
  const { data, error } = await table('id_proyectos').insert(payload).select().single()
  if (error) throw error
  const { error: memberError } = await table('id_proyecto_miembros').upsert({
    proyecto_id:data.id,
    perfil_id:data.responsable_id,
    rol_proyecto:'coordinador',
    puede_editar:true,
  }, { onConflict:'proyecto_id,perfil_id' })
  if (memberError) throw memberError
  await addIdEvent(data.id, 'proyecto_creado', `Proyecto ${data.codigo} creado`)
  return data
}

export async function updateIdProject(id, changes, eventSummary = 'Proyecto actualizado') {
  const { data, error } = await table('id_proyectos')
    .update({ ...changes, updated_at:new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  await addIdEvent(id, 'proyecto_actualizado', eventSummary, changes)
  return data
}

export async function getIdProjectBundle(projectId) {
  const [project, members, versions, trials, validations, events] = await Promise.all([
    table('id_proyectos').select('*').eq('id', projectId).single(),
    table('id_proyecto_miembros').select('*').eq('proyecto_id', projectId).order('created_at'),
    table('id_versiones').select('*').eq('proyecto_id', projectId).order('numero', { ascending:false }),
    table('id_pruebas').select('*').eq('proyecto_id', projectId).order('numero', { ascending:false }),
    table('id_validaciones').select('*').eq('proyecto_id', projectId).order('created_at', { ascending:false }),
    table('id_eventos').select('*').eq('proyecto_id', projectId).order('created_at', { ascending:false }),
  ])
  const failure = [project, members, versions, trials, validations, events].find(result => result.error)
  if (failure?.error) throw failure.error
  return {
    project:project.data,
    members:members.data || [],
    versions:versions.data || [],
    trials:trials.data || [],
    validations:validations.data || [],
    events:events.data || [],
  }
}

export async function addIdMember(payload) {
  const { data, error } = await table('id_proyecto_miembros')
    .upsert(payload, { onConflict:'proyecto_id,perfil_id' }).select().single()
  if (error) throw error
  await addIdEvent(payload.proyecto_id, 'miembro_asignado', 'Participante incorporado', { perfil_id:payload.perfil_id, rol_proyecto:payload.rol_proyecto })
  return data
}

export async function removeIdMember(projectId, memberId) {
  const { error } = await table('id_proyecto_miembros').delete().eq('id', memberId)
  if (error) throw error
  await addIdEvent(projectId, 'miembro_removido', 'Participante removido')
}

export async function createIdVersion(payload) {
  const { data, error } = await table('id_versiones').insert(payload).select().single()
  if (error) throw error
  await addIdEvent(payload.proyecto_id, 'version_creada', `Fórmula V${String(data.numero).padStart(2, '0')} creada`, { version_id:data.id })
  return data
}

export async function approveIdVersion(projectId, versionId) {
  const { error } = await db().rpc('aprobar_id_version', {
    p_proyecto_id:projectId,
    p_version_id:versionId,
  })
  if (error) throw error
}

export async function createIdTrial(payload) {
  const { data, error } = await table('id_pruebas').insert(payload).select().single()
  if (error) throw error
  await addIdEvent(payload.proyecto_id, 'prueba_registrada', `Prueba #${String(data.numero).padStart(2, '0')}: ${data.resultado}`, { prueba_id:data.id, version_id:data.version_id })
  return data
}

export async function createIdValidation(payload) {
  const { data, error } = await table('id_validaciones').insert(payload).select().single()
  if (error) throw error
  await addIdEvent(payload.proyecto_id, 'validacion_solicitada', `Validación solicitada a ${payload.area}`, { validacion_id:data.id, validador_id:data.validador_id })
  return data
}

export async function updateIdValidation(id, projectId, changes) {
  const finalChanges = { ...changes, updated_at:new Date().toISOString() }
  if (changes.decision && changes.decision !== 'Pendiente') finalChanges.decidido_at = new Date().toISOString()
  const { data, error } = await table('id_validaciones').update(finalChanges).eq('id', id).select().single()
  if (error) throw error
  await addIdEvent(projectId, 'validacion_resuelta', `${data.area}: ${data.decision}`, { validacion_id:id })
  return data
}

export async function addIdEvent(projectId, type, summary, data = {}) {
  const { data:row, error } = await table('id_eventos').insert({
    proyecto_id:projectId,
    tipo:type,
    resumen:summary,
    datos:data,
  }).select().single()
  if (error) throw error
  return row
}
