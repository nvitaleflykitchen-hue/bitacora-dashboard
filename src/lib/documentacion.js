import { db } from './supabase'

export const DOCUMENTACION_ESTADOS = [
  { value: 'pendiente', label: 'Pendiente', color: 'var(--text-dim)' },
  { value: 'vigente', label: 'Vigente', color: '#39FF14' },
  { value: 'observado', label: 'Observado', color: '#F59E0B' },
  { value: 'vencido', label: 'Vencido', color: '#FF2A2A' },
  { value: 'no_aplica', label: 'No aplica', color: '#60A5FA' },
]

export const DOCUMENTACION_AVISO_DIAS_DEFAULT = 30

export const PERSONA_DOCUMENTACION_TEMPLATE = [
  { codigo: 'carnet_manipulador', titulo: 'Carnet de manipulador', seccion: 'Personal' },
  { codigo: 'certificado_reincidencia', titulo: 'Certificado de reincidencia', seccion: 'Personal' },
  { codigo: 'carnet_conductor', titulo: 'Carnet de conductor', seccion: 'Personal' },
  { codigo: 'credencial_psa', titulo: 'Credencial PSA', seccion: 'Personal' },
  { codigo: 'bpm_manipulacion', titulo: 'BPM y manipulación higiénica de alimentos', seccion: 'Capacitación' },
  { codigo: 'avsec_interferencia', titulo: 'AVSEC / Interferencia ilícita', seccion: 'Capacitación' },
  { codigo: 'sms', titulo: 'SMS', seccion: 'Capacitación' },
  { codigo: 'operacion_plataforma', titulo: 'Operación en plataforma', seccion: 'Capacitación' },
  { codigo: 'itc_21_24', titulo: 'ITC-21 / ITC-24', seccion: 'Capacitación' },
  { codigo: 'directiva_47bis', titulo: 'Directiva de seguridad 47 bis', seccion: 'Capacitación' },
  { codigo: 'precintado', titulo: 'Precintado de equipos y camiones', seccion: 'Capacitación' },
  { codigo: 'abordamiento_aeronave', titulo: 'Abordamiento a aeronave', seccion: 'Capacitación' },
  { codigo: 'seguridad_factores_humanos_aa', titulo: 'Seguridad y factores humanos AA', seccion: 'Capacitación' },
]

export const VEHICULO_DOCUMENTACION_TEMPLATE = [
  { codigo: 'habilitacion_senasa', titulo: 'Habilitación transporte alimentos SENASA', seccion: 'Vehículos' },
  { codigo: 'habilitacion_municipal_provincial', titulo: 'Habilitación municipal / provincial', seccion: 'Vehículos' },
  { codigo: 'itv_pov_cov', titulo: 'ITV / POV / COV', seccion: 'Vehículos' },
  { codigo: 'tarjeta_verde_azul', titulo: 'Tarjeta verde / azul', seccion: 'Vehículos' },
  { codigo: 'poliza_seguro', titulo: 'Póliza de seguro', seccion: 'Vehículos' },
  { codigo: 'plan_mantenimiento_preventivo', titulo: 'Plan de mantenimiento preventivo y registros', seccion: 'Vehículos' },
]

export const SEDE_DOCUMENTACION_TEMPLATE = [
  { codigo: 'habilitacion_establecimiento', titulo: 'Habilitación del establecimiento', seccion: 'Establecimiento' },
  { codigo: 'certificado_plagas', titulo: 'Certificado de manejo de plagas actualizado', seccion: 'Establecimiento' },
  { codigo: 'estado_matafuegos', titulo: 'Estado de matafuegos', seccion: 'Establecimiento' },
  { codigo: 'limpieza_tanques', titulo: 'Limpieza de tanques', seccion: 'Establecimiento' },
  { codigo: 'analisis_agua', titulo: 'Análisis de agua', seccion: 'Establecimiento' },
  { codigo: 'registro_recepcion_mercaderia', titulo: 'Registro recepción de mercadería', seccion: 'Registros operativos' },
  { codigo: 'registro_visitas', titulo: 'Registro de visitas', seccion: 'Registros operativos' },
  { codigo: 'poes', titulo: 'POES: procedimientos de limpieza y registros', seccion: 'Calidad' },
  { codigo: 'productos_quimicos', titulo: 'Listado de productos químicos y documentación', seccion: 'Calidad' },
  { codigo: 'plan_mantenimiento_equipos', titulo: 'Plan de mantenimiento de equipos y registros', seccion: 'Mantenimiento' },
  { codigo: 'sop_hornos', titulo: 'SOP de chequeo de hornos y registro de capacitación', seccion: 'Mantenimiento' },
  { codigo: 'sistema_gestion_calidad', titulo: 'Sistema de gestión de calidad documentado', seccion: 'Calidad' },
  { codigo: 'programa_seguridad', titulo: 'Programa de seguridad vigente', seccion: 'Seguridad aeroportuaria' },
  { codigo: 'acceso_arsa', titulo: 'Acceso a documentación ARSA', seccion: 'Seguridad aeroportuaria' },
  { codigo: 'acceso_bcv', titulo: 'Acceso a BCV', seccion: 'Seguridad aeroportuaria' },
  { codigo: 'inventario_aerolineas', titulo: 'Inventario de materiales de Aerolíneas Argentinas', seccion: 'Inventarios aerolíneas' },
  { codigo: 'inventario_gol', titulo: 'Inventario de materiales de GOL', seccion: 'Inventarios aerolíneas' },
  { codigo: 'inventario_copa', titulo: 'Inventario de materiales de COPA Airlines', seccion: 'Inventarios aerolíneas' },
]

export function docEstadoMeta(estado) {
  return DOCUMENTACION_ESTADOS.find(e => e.value === estado) || DOCUMENTACION_ESTADOS[0]
}

export function docVencimientoInfo(fecha, avisoDias = DOCUMENTACION_AVISO_DIAS_DEFAULT) {
  if (!fecha) return { tipo: 'sin_fecha', label: 'Sin vencimiento', color: 'var(--text-dim)' }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(`${fecha}T00:00:00`)
  const dias = Math.ceil((venc - hoy) / 86400000)
  if (dias < 0) return { tipo: 'vencido', label: `${Math.abs(dias)} d vencido`, color: '#FF2A2A', dias }
  if (dias === 0) return { tipo: 'hoy', label: 'Vence hoy', color: '#F59E0B', dias }
  if (dias <= Number(avisoDias || DOCUMENTACION_AVISO_DIAS_DEFAULT)) return { tipo: 'proximo', label: `Vence en ${dias} d`, color: '#F59E0B', dias }
  return { tipo: 'vigente', label: `Vence en ${dias} d`, color: '#39FF14', dias }
}

export async function getDocumentacionItems(entityType, entityId) {
  const { data, error } = await db()
    .from('documentacion_items')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .order('seccion')
    .order('titulo')
  if (error) throw error
  return data || []
}

export async function upsertDocumentacionItem(item) {
  const payload = {
    ...item,
    entity_id: String(item.entity_id),
    estado: item.estado || 'pendiente',
    aviso_dias: item.aviso_dias === '' || item.aviso_dias == null ? DOCUMENTACION_AVISO_DIAS_DEFAULT : Number(item.aviso_dias),
    fecha_vencimiento: item.fecha_vencimiento || null,
    observacion: item.observacion?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await db()
    .from('documentacion_items')
    .upsert(payload, { onConflict: 'entity_type,entity_id,codigo' })
    .select()
    .single()
  if (error) throw error
  return data
}
