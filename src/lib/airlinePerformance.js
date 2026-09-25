export const PERFORMANCE_CATEGORIES = [
  ['complaints', 'Quejas', 165, 275, 340],
  ['aqd', 'AQD', 365, 485, 550],
  ['food_audit', 'Auditoría de alimentos', 575, 640, 710],
  ['inventory', 'Inventario', 725, 785, 845],
  ['billing', 'Facturación', 865, 925, 985],
  ['safety', 'Seguridad', 995, 1055, 1120],
  ['delays', 'Demoras', 1135, 1195, 1260],
  ['accidents', 'Accidentes', 1275, 1335, 1405],
]

const MONTH_ALIASES = { JAN:1, ENE:1, FEB:2, MAR:3, APR:4, ABR:4, MAY:5, JUN:6, JUL:7, AUG:8, AGO:8, SEP:9, OCT:10, NOV:11, DEC:12, DIC:12 }
const monthNumber = value => MONTH_ALIASES[String(value || '').slice(0, 3).toUpperCase()] || 0

export function parsePercent(value) {
  const match = String(value || '').replace(',', '.').match(/^(\d{1,3}(?:\.\d+)?)\s*%$/)
  return match ? Number(match[1]) : null
}

function textAt(row, minX, maxX) {
  return row.filter(item => item.x >= minX && item.x < maxX).sort((a, b) => a.x - b.x).map(item => item.text).join(' ').trim()
}

// The Copa scorecard is a wide spreadsheet PDF. Coordinates are scaled from
// its 1832.73-point reference page. A month is complete only if TOTAL exists.
export function parseCopaScorecard(items, pageWidth, filename = '') {
  const scale = 1832.73 / pageWidth
  const tokens = items.map(item => ({ text:String(item.text || '').trim(), x:item.x * scale, y:item.y * scale })).filter(item => item.text)
  const allText = tokens.map(item => item.text).join(' ')
  if (!/\bTOTAL\b/i.test(allText) || !tokens.some(item => item.x < 165 && /^(JAN|ENE|FEB|MAR|APR|ABR|MAY|JUN|JUL|AUG|AGO|SEP|OCT|NOV|DEC|DIC)[-\s]?\d{2,4}$/i.test(item.text))) throw new Error('El PDF no parece ser una planilla mensual de desempeño. Cargá los valores manualmente.')
  const firstPeriod = tokens.find(item => item.x < 165 && monthNumber(item.text))?.text || ''
  const shortYear = Number(firstPeriod.match(/[-\s](\d{2})$/)?.[1])
  const year = Number(allText.match(/\b20\d{2}\b/)?.[0]) || (shortYear ? 2000 + shortYear : new Date().getFullYear())
  const siteCode = allText.match(/\b(ROS|COR|MDZ|TUC|EZE|AEP)\b/i)?.[1]?.toUpperCase() || filename.match(/\b(ROS|COR|MDZ|TUC|EZE|AEP)\b/i)?.[1]?.toUpperCase() || ''
  const months = []
  for (const token of tokens) {
    if (token.x > 165 || !/^(JAN|ENE|FEB|MAR|APR|ABR|MAY|JUN|JUL|AUG|AGO|SEP|OCT|NOV|DEC|DIC)[-\s]?\d{2,4}$/i.test(token.text)) continue
    const month = monthNumber(token.text)
    if (!month || months.some(row => row.month === month)) continue
    const row = tokens.filter(item => Math.abs(item.y - token.y) <= 13)
    const total = parsePercent(textAt(row, 1420, 1520))
    if (total === null) continue
    const metrics = {}
    PERFORMANCE_CATEGORIES.forEach(([key, , startX, scoreX, endX]) => {
      const reportedValue = textAt(row, startX, scoreX)
      const awarded = textAt(row, scoreX, endX)
      if (reportedValue || awarded) metrics[key] = { reported_value:reportedValue || null, awarded:awarded || null }
    })
    months.push({ month, total_score:total, level:textAt(row, 1520, 1833), metrics })
  }
  months.sort((a, b) => a.month - b.month)
  if (!months.length) throw new Error('No se detectaron meses con TOTAL publicado. Revisá el formato y cargá los valores manualmente.')
  // The annual accumulated score is a separately reported value, not the
  // average of the monthly scores. Prefer the header line if identifiable.
  const firstMonthY = Math.min(...tokens.filter(item => item.x < 165 && /^(JAN|ENE|FEB|MAR|APR|ABR|MAY|JUN|JUL|AUG|AGO|SEP|OCT|NOV|DEC|DIC)[-\s]?\d{2,4}$/i.test(item.text)).map(item => item.y))
  const accumulated = tokens.find(item => item.y < firstMonthY && item.x > 1400 && item.x < 1550 && parsePercent(item.text) !== null)
  return { airline:'Copa Airlines', year, siteCode, cumulative_score:accumulated ? parsePercent(accumulated.text) : null, months }
}

export async function extractCopaPdf(file) {
  if (!file || (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) || file.size > 15 * 1024 * 1024) throw new Error('Elegí un PDF de hasta 15 MB.')
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = worker.default
  const task = getDocument({ data:new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  try {
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale:1 })
    const content = await page.getTextContent()
    const items = content.items.filter(item => item.str).map(item => ({ text:item.str, x:item.transform[4], y:viewport.height - item.transform[5] }))
    return parseCopaScorecard(items, viewport.width, file.name)
  } finally { await task.destroy() }
}

export function latestPublishedReports(reports) {
  const seen = new Set()
  return [...reports].filter(report => report.status === 'published').sort((a, b) => String(b.published_at || b.created_at).localeCompare(String(a.published_at || a.created_at))).filter(report => {
    const key = `${report.site_id}:${report.airline.toLowerCase()}:${report.report_year}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
