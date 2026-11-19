import {fleetDate, fleetDateTime} from './flotaModel'
export function previousChecklistReading(checks) {
  const latest = [...checks].filter(c=>c.km !== '' && c.km != null && Number.isFinite(Number(c.km)))
    .sort((a,b)=>String(b.row?.fecha || b.creado_at || b.fecha || '').localeCompare(String(a.row?.fecha || a.creado_at || a.fecha || '')))[0]
  return latest ? String(latest.km) : ''
}

export function checklistDateTime(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? `${fleetDate(value)} (hora no registrada)` : fleetDateTime(value)
}
