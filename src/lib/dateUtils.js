/**
 * dateUtils.js — FK Kitchen OS
 * Formato estándar: dd/mm/aa  (igual que Google Sheets)
 * IMPORTANTE: Las fechas importadas desde Excel se almacenan como
 * medianoche UTC (00:00:00+00). Para evitar el desfase UTC-3,
 * se usan métodos UTC para la parte de fecha y métodos locales para la hora.
 *
 * NUNCA pasar strings "dd/mm/aa" a new Date() directamente —
 * JavaScript los interpreta como MM/DD/YY (formato US) y invierte día y mes.
 * Usar siempre toDate() de este módulo.
 */

/**
 * Convierte cualquier valor de fecha a un objeto Date seguro.
 * Acepta:
 *   - Date
 *   - number (timestamp ms)
 *   - "dd/mm/aa" o "dd/mm/yyyy" o "d/m/aa" (formato argentino, 1 o 2 dígitos)
 *   - "yyyy-mm-dd" ISO solo fecha
 *   - "yyyy-mm-ddTHH:MM:SS..." ISO con hora
 */
function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  if (typeof value === 'string') {
    const s = value.trim()

    // dd/mm/aa o dd/mm/yyyy (1 o 2 dígitos por parte — formato argentino)
    // NUNCA usar new Date() con este formato: JS lo trataría como MM/DD
    const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (slashMatch) {
      const day  = parseInt(slashMatch[1], 10)
      const mon  = parseInt(slashMatch[2], 10)
      const rawY = slashMatch[3]
      const year = rawY.length === 2 ? 2000 + parseInt(rawY, 10) : parseInt(rawY, 10)
      // Construir como UTC para consistencia con el resto de la app
      const dt = new Date(Date.UTC(year, mon - 1, day))
      return isNaN(dt.getTime()) ? null : dt
    }

    // yyyy-mm-dd (ISO sin hora) — almacenar como medianoche UTC
    const isoDateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoDateMatch) {
      const dt = new Date(Date.UTC(
        parseInt(isoDateMatch[1], 10),
        parseInt(isoDateMatch[2], 10) - 1,
        parseInt(isoDateMatch[3], 10)
      ))
      return isNaN(dt.getTime()) ? null : dt
    }

    // ISO con hora (yyyy-mm-ddTHH:MM:SS o yyyy-mm-dd HH:MM:SS con +00 o Z)
    const dt = new Date(s)
    return isNaN(dt.getTime()) ? null : dt
  }

  return null
}

/**
 * Extrae la parte de FECHA usando UTC para evitar desfase en UTC-3.
 * Los tickets importados se almacenan como medianoche UTC; usar getUTC*
 * devuelve la fecha correcta en lugar de restar un día.
 */
function utcParts(d) {
  return {
    dd:   String(d.getUTCDate()).padStart(2, '0'),
    mm:   String(d.getUTCMonth() + 1).padStart(2, '0'),
    yyyy: String(d.getUTCFullYear()),
    aa:   String(d.getUTCFullYear()).slice(-2),
  }
}

/** dd/mm/aa  →  "11/06/26" */
export function fmtFecha(value) {
  const d = toDate(value)
  if (!d) return '—'
  const { dd, mm, aa } = utcParts(d)
  return `${dd}/${mm}/${aa}`
}

/** dd/mm/yyyy  →  "11/06/2026" */
export function fmtFechaLarga(value) {
  const d = toDate(value)
  if (!d) return '—'
  const { dd, mm, yyyy } = utcParts(d)
  return `${dd}/${mm}/${yyyy}`
}

/**
 * dd/mm/aa HH:mm  →  "11/06/26 14:30"
 * Fecha: UTC (para importados). Hora: local (para lecturas reales).
 */
export function fmtFechaHora(value) {
  const d = toDate(value)
  if (!d) return '—'
  const { dd, mm, aa } = utcParts(d)
  const hh  = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${aa} ${hh}:${min}`
}

/** Solo hora local HH:mm */
export function fmtHora(value) {
  const d = toDate(value)
  if (!d) return '—'
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

/**
 * ISO yyyy-mm-dd  →  display dd/mm/aa
 * Para mostrar valores de <input type="date"> en texto.
 */
export function isoToDisplay(iso) {
  if (!iso) return '—'
  const [y, m, day] = iso.split('-')
  if (!y || !m || !day) return iso
  return `${day.padStart(2,'0')}/${m.padStart(2,'0')}/${String(y).slice(-2)}`
}

/**
 * Display dd/mm/aa o dd/mm/yyyy  →  ISO yyyy-mm-dd
 * Para guardar en Supabase (que espera formato ISO).
 */
export function displayToIso(str) {
  if (!str) return null
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return str
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
}

/**
 * Devuelve el número de semana ISO (lunes = inicio de semana).
 */
export function semanaISO(value) {
  const d = toDate(value)
  if (!d) return null
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
}

/**
 * Retorna el lunes de la semana a la que pertenece `value` (UTC).
 */
export function inicioSemana(value) {
  const d = toDate(value) || new Date()
  const day = d.getUTCDay() // 0=dom ... 6=sáb
  const diff = day === 0 ? -6 : 1 - day
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff))
}

/** Diferencia en días entre value y hoy (positivo = futuro) */
export function diasHasta(value) {
  const d = toDate(value)
  if (!d) return null
  const hoyUTC = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  const valUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.ceil((valUTC - hoyUTC) / 86400000)
}

/** true si la fecha ya pasó (y no es hoy) */
export function esVencida(value) {
  const dias = diasHasta(value)
  return dias !== null && dias < 0
}

/** true si vence en los próximos `umbral` días */
export function esProxima(value, umbral = 7) {
  const dias = diasHasta(value)
  return dias !== null && dias >= 0 && dias <= umbral
}
