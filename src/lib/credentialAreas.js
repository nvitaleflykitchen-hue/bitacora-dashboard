export const CREDENTIAL_AREAS = Object.freeze({
  operations: Object.freeze({ code:'OPS', label:'Operaciones', color:'#F36C00' }),
  logistics: Object.freeze({ code:'LOG', label:'Logística', color:'#1565C0' }),
  quality: Object.freeze({ code:'CAL', label:'Calidad', color:'#2E7D32' }),
  maintenance: Object.freeze({ code:'MNT', label:'Mantenimiento', color:'#D97706' }),
  administration: Object.freeze({ code:'ADM', label:'Administración', color:'#546E7A' }),
  hr: Object.freeze({ code:'RRHH', label:'Recursos Humanos', color:'#7B1FA2' }),
})

export const CREDENTIAL_AREA_OPTIONS = Object.entries(CREDENTIAL_AREAS).map(([value, config]) => ({ value, ...config }))

const normalize = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const hasAny = (text, terms) => terms.some(term => text.includes(term))

export function inferCredentialArea(persona = {}) {
  const text = `${normalize(persona.area)} ${normalize(persona.puesto || persona.jobTitle)}`.trim()
  if (hasAny(text, ['recursos humanos', 'rr hh', 'rrhh', 'capital humano'])) return 'hr'
  if (hasAny(text, ['mantenimiento', 'tecnico de mantenimiento'])) return 'maintenance'
  if (hasAny(text, ['calidad', 'asuntos regulatorios', 'inocuidad'])) return 'quality'
  if (hasAny(text, ['administracion', 'administrativo', 'contable', 'finanzas', 'tesoreria'])) return 'administration'
  if (hasAny(text, ['logistica', 'transportista', 'deposito', 'almacen', 'chofer', 'armado carga'])) return 'logistics'
  return 'operations'
}

export function resolveCredentialArea(persona = {}, credencial = null) {
  const snapshot = String(credencial?.area_impresa || '').trim().toLowerCase()
  const current = String(persona?.functional_area || persona?.functionalArea || '').trim().toLowerCase()
  const key = CREDENTIAL_AREAS[snapshot] ? snapshot
    : CREDENTIAL_AREAS[current] ? current
      : inferCredentialArea({ area:credencial?.area_impresa || persona?.area, puesto:credencial?.puesto_impreso || persona?.puesto || persona?.jobTitle })
  return { key, ...CREDENTIAL_AREAS[key] }
}

export function credentialPresentation(persona = {}, credencial = null) {
  return {
    area:resolveCredentialArea(persona, credencial),
    jobTitle:String(credencial?.puesto_impreso || persona?.puesto || persona?.jobTitle || 'SIN PUESTO').toUpperCase(),
  }
}

export function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '')
  return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16))
}
