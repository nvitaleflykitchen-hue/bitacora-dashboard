import { db, supabase } from './supabase'

export const MICROBIOLOGIA_STORAGE_KEY = 'fly-gestion:microbiologia:v1'

export const MICROBIOLOGIA_PARAMETROS = [
  { id:'aerobios', label:'Aerobios mesófilos', unidad:'UFC/g', tipo:'maximo', limite:1000000 },
  { id:'coliformes', label:'Coliformes totales', unidad:'UFC/g', tipo:'maximo', limite:100 },
  { id:'ecoli', label:'Escherichia coli', unidad:'UFC/g', tipo:'maximo', limite:10 },
  { id:'ecoli157', label:'E. coli O157:H7/NM', unidad:'/65 g', tipo:'ausencia' },
  { id:'salmonella', label:'Salmonella spp.', unidad:'/25 g', tipo:'ausencia' },
  { id:'listeria', label:'Listeria monocytogenes', unidad:'/25 g', tipo:'ausencia' },
  { id:'staphylococcus', label:'Staphylococcus aureus', unidad:'UFC/g', tipo:'maximo', limite:1000 },
  { id:'mohos', label:'Mohos', unidad:'UFC/g', tipo:'maximo', limite:1000 },
  { id:'levaduras', label:'Levaduras', unidad:'UFC/g', tipo:'maximo', limite:1000 },
]

const PARAMETROS_POR_ID = new Map(MICROBIOLOGIA_PARAMETROS.map(item => [item.id, item]))

export function parseMicroValue(rawValue) {
  const text = String(rawValue ?? '').trim().toLowerCase()
  if (!text) return null
  if (/ausen|no detect|negativ/.test(text)) return 0
  if (/presen|detect|positiv/.test(text)) return Number.POSITIVE_INFINITY
  const match = text.replace(/\./g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export function classifyMicroResult(parameterId, rawValue) {
  const parameter = PARAMETROS_POR_ID.get(parameterId)
  if (!parameter) return 'observado'
  const value = parseMicroValue(rawValue)
  if (value == null) return 'observado'
  if (parameter.tipo === 'ausencia') return value === 0 ? 'cumple' : 'no_cumple'
  if (value > parameter.limite) return 'no_cumple'
  if (value > parameter.limite * 0.8) return 'observado'
  return 'cumple'
}

export function normalizeMicroRecord(record) {
  const parameter = PARAMETROS_POR_ID.get(record.parametroId)
  return {
    ...record,
    id: record.id || crypto.randomUUID(),
    fecha: record.fecha || new Date().toISOString().slice(0, 10),
    parametro: parameter?.label || record.parametro || 'Parámetro sin identificar',
    unidad: record.unidad || parameter?.unidad || '',
    estado: classifyMicroResult(record.parametroId, record.valor),
    createdAt: record.createdAt || new Date().toISOString(),
  }
}

export function buildMicroStats(records) {
  const stats = { total:records.length, cumple:0, observado:0, noCumple:0, cumplimiento:100, porParametro:[] }
  const groups = new Map()
  for (const record of records) {
    if (record.estado === 'cumple') stats.cumple += 1
    else if (record.estado === 'no_cumple') stats.noCumple += 1
    else stats.observado += 1
    const group = groups.get(record.parametro) || { parametro:record.parametro, total:0, noCumple:0 }
    group.total += 1
    if (record.estado === 'no_cumple') group.noCumple += 1
    groups.set(record.parametro, group)
  }
  stats.cumplimiento = stats.total ? Math.round((stats.cumple / stats.total) * 100) : 100
  stats.porParametro = [...groups.values()].sort((a, b) => b.noCumple - a.noCumple || b.total - a.total)
  return stats
}

export function loadLocalMicroRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MICROBIOLOGIA_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLocalMicroRecords(records) {
  localStorage.setItem(MICROBIOLOGIA_STORAGE_KEY, JSON.stringify(records))
}

function fromDatabase(row) {
  const evidenciaPath = row.record_data?.evidencia_path || ''
  const evidenciaUrl = evidenciaPath
    ? supabase.storage.from('bitacora-adjuntos').getPublicUrl(evidenciaPath).data.publicUrl
    : ''
  return {
    id:row.id,
    sedeId:row.sede_id == null ? '' : String(row.sede_id),
    fecha:row.fecha || '',
    protocolo:row.protocolo || '',
    laboratorio:row.laboratorio || '',
    muestra:row.muestra || '',
    parametro:row.parametro || '',
    parametroId:row.record_data?.parametroId || '',
    valor:row.valor || '',
    unidad:row.unidad || '',
    estado:row.estado || 'observado',
    notas:row.notas || '',
    evidencia:row.evidencia || '',
    evidenciaUrl,
    archivoNombre:row.record_data?.archivoNombre || '',
    createdAt:row.created_at,
  }
}

function toDatabase(record) {
  return {
    sede_id:record.sedeId ? Number(record.sedeId) : null,
    fecha:record.fecha || null,
    protocolo:record.protocolo,
    laboratorio:record.laboratorio || null,
    muestra:record.muestra,
    parametro:record.parametro,
    tipo_muestra:record.tipoMuestra || null,
    valor:record.valor || null,
    unidad:record.unidad || null,
    limite:record.limite || null,
    estado:record.estado || 'observado',
    notas:record.notas || null,
    evidencia:record.evidencia || null,
    record_data:{ parametroId:record.parametroId || null, archivoNombre:record.archivoNombre || null },
  }
}

export async function getMicroRecords() {
  const { data, error } = await db().from('microbiologia_resultados').select('*').order('fecha', { ascending:false })
  if (error) throw error
  return (data || []).map(fromDatabase)
}

export async function createMicroRecords(records) {
  const values = records.map(toDatabase)
  const { data, error } = await db().from('microbiologia_resultados').insert(values).select('*')
  if (error) throw error
  return (data || []).map(fromDatabase)
}

export async function deleteMicroRecord(id) {
  const { error } = await db().from('microbiologia_resultados').delete().eq('id', id)
  if (error) throw error
}
