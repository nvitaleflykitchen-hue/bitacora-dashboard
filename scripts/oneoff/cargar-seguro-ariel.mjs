import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'

const PROJECT_ID = 'mixyhfdlzjarvszinytk'
const BUCKET = 'bitacora-adjuntos'
const CODIGO = 'seguro_ariel_aeropuerto'
const TITULO = 'Seguro de línea aérea - Responsabilidad Civil Propietarios y Operadores de Aeropuertos (ARIEL)'
const VENCIMIENTO = '2026-10-01'
const AVISO_DIAS = 30
const DOMINIOS_POLIZA = new Set([
  'JDN191', 'JDN192', 'AD286IG', 'AD286IH', 'AD286II', 'AF602RB',
  'AC065RF', 'AA110NL', 'AG908XL', 'AH172MY', 'AF558CW', 'AH213XP',
])

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const pdfPath = args.find(arg => arg.startsWith('--pdf='))?.slice('--pdf='.length)
const envPath = args.find(arg => arg.startsWith('--env='))?.slice('--env='.length)
const expected = Number(args.find(arg => arg.startsWith('--expect='))?.slice('--expect='.length) || 8)

if (!pdfPath || !existsSync(pdfPath)) {
  console.error('Uso: node scripts/oneoff/cargar-seguro-ariel.mjs --pdf=<archivo.pdf> --env=<archivo.env> [--expect=8] [--apply]')
  process.exit(1)
}

function loadEnv(path) {
  if (!path || !existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function normalizeDominio(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function safeStorageName(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

loadEnv(envPath)
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
if (!url.includes(`${PROJECT_ID}.supabase.co`)) throw new Error(`Proyecto Supabase incorrecto. Se esperaba ${PROJECT_ID}.`)

const client = createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } })
const db = client.schema('bitacora')
const sourceName = basename(pdfPath)
const pdf = readFileSync(pdfPath)

const { data: activos, error: activosError } = await client
  .from('mnt_activos')
  .select('id,nombre,codigo_interno,sede_nombre,tipo,estado')
  .eq('tipo', 'VEHICULO')
  .ilike('sede_nombre', '%Aeropuerto%')
if (activosError) throw activosError

const targets = (activos || [])
  .filter(item => DOMINIOS_POLIZA.has(normalizeDominio(item.codigo_interno)))
  .sort((a, b) => String(a.codigo_interno).localeCompare(String(b.codigo_interno)))

if (targets.length !== expected) {
  throw new Error(`La selección segura esperaba ${expected} vehículos de aeropuerto cubiertos y encontró ${targets.length}. No se aplicaron cambios.`)
}

console.log(`${apply ? 'Aplicación' : 'Simulación'} ARIEL: ${targets.length} vehículos · vencimiento ${VENCIMIENTO} · aviso ${AVISO_DIAS} días.`)
for (const vehicle of targets) console.log(`- ${vehicle.codigo_interno} · ${vehicle.sede_nombre} · ${vehicle.nombre}`)
if (!apply) {
  console.log('Simulación terminada. Agregá --apply para guardar los requisitos y adjuntar el PDF.')
} else {
  let attached = 0
  let alreadyAttached = 0
  for (const vehicle of targets) {
    const now = new Date().toISOString()
    const { data: item, error: itemError } = await db
      .from('documentacion_items')
      .upsert({
        entity_type: 'vehiculo',
        entity_id: String(vehicle.id),
        codigo: CODIGO,
        titulo: TITULO,
        seccion: 'Seguridad aeroportuaria',
        estado: 'vigente',
        aviso_dias: AVISO_DIAS,
        fecha_vencimiento: VENCIMIENTO,
        observacion: 'Póliza N° 22-1122 · Vigencia desde 01/10/2025 · Asegurado adicional: FLY KITCHEN · Certificado ARSA 2025-566iv.',
        updated_by: 'Codex · carga solicitada por Nicolás Vitale',
        updated_at: now,
      }, { onConflict:'entity_type,entity_id,codigo' })
      .select('id')
      .single()
    if (itemError) throw itemError

    const entityId = String(item.id)
    const { data: existing, error: existingError } = await db
      .from('adjuntos')
      .select('id')
      .eq('entity_type', 'documentacion_item')
      .eq('entity_id', entityId)
      .eq('nombre', sourceName)
      .limit(1)
    if (existingError) throw existingError
    if (existing?.length) {
      alreadyAttached += 1
      continue
    }

    const storagePath = `documentacion_item/${entityId}/${Date.now()}-${safeStorageName(sourceName)}`
    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(storagePath, pdf, { cacheControl:'3600', upsert:false, contentType:'application/pdf' })
    if (uploadError) throw uploadError

    const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(storagePath)
    const { error: attachmentError } = await db.from('adjuntos').insert({
      entity_type: 'documentacion_item',
      entity_id: entityId,
      nombre: sourceName,
      tipo: 'archivo',
      url: publicData.publicUrl,
      storage_path: storagePath,
      mime_type: 'application/pdf',
      tamaño_bytes: pdf.length,
      uploaded_by: 'Codex · carga solicitada por Nicolás Vitale',
    })
    if (attachmentError) {
      await client.storage.from(BUCKET).remove([storagePath])
      throw attachmentError
    }
    attached += 1
  }

  console.log(`Carga completa: ${targets.length} requisitos vigentes, ${attached} PDF adjuntados, ${alreadyAttached} adjuntos ya existentes.`)
}
