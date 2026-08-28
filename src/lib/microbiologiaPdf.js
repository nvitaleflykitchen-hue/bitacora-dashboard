const PARAMETER_PATTERNS = [
  { parametroId:'ecoli157', pattern:/e\.?\s*coli\s*o?157/i },
  { parametroId:'salmonella', pattern:/salmonella/i },
  { parametroId:'listeria', pattern:/listeria\s+monocyt/i },
  { parametroId:'staphylococcus', pattern:/estafilococ|staphylococcus/i },
  { parametroId:'ecoli', pattern:/e\.?\s*coli/i },
  { parametroId:'coliformes', pattern:/coliform/i },
  { parametroId:'aerobios', pattern:/aerobio|mes[oó]fil/i },
  { parametroId:'mohos', pattern:/mohos?/i },
  { parametroId:'levaduras', pattern:/levaduras?/i },
]

function normalizePdfText(value) {
  return String(value || '').split('\u0000').join(' ').replace(/[ \t]+/g, ' ').trim()
}

function extractLineValue(line) {
  const qualitative = line.match(/\b(ausencia|presencia|no\s+detectado|detectado|negativo|positivo)\b/i)
  if (qualitative) return qualitative[1]
  const comparatorValues = [...line.matchAll(/[<>≤≥]\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/g)]
  if (comparatorValues.length) return comparatorValues.at(-1)[0].replace(/\s+/g, '')
  const beforeUnit = line.match(/(\d+(?:[.,]\d+)?(?:\s*[x×]\s*10\s*\^?\s*\d+)?)\s*(?=UFC|NMP|NPM|UFC|en\s+\d+\s*g)/i)
  return beforeUnit?.[1]?.replace(/\s+/g, '') || ''
}

function extractUnit(line) {
  const unit = line.match(/(?:UFC|NMP|NPM)\s*\/\s*(?:g|ml|cm2|cm²)|en\s+\d+\s*g|\/\s*\d+\s*g/i)?.[0] || ''
  return unit.replace(/\s+/g, ' ').replace(/^en/i, 'En')
}

export function parseMicrobiologyText(rawText, fileName = '') {
  const text = normalizePdfText(rawText)
  const lines = text.split(/\r?\n/).map(normalizePdfText).filter(Boolean)
  const protocolFromText = text.match(/(?:N[°º]?\s*de\s*Protocolo|Protocolo)\s*:?[^\n]{0,100}?\b(\d{4,}[A-Z]?)\b/i)?.[1]
  const protocolFromName = fileName.match(/(?:protocolo\s*)?(\d{4,}[A-Z]?)/i)?.[1]
  const date = text.match(/(?:Fecha de\s+(?:toma|elaboraci[oó]n)|Recepci[oó]n)\s*:?[^\n]{0,80}?(\d{2}[/-]\d{2}[/-]\d{2,4})/i)?.[1]
    || text.match(/\b(\d{2}[/-]\d{2}[/-]\d{4})\b/)?.[1]
  const sample = text.match(/Identificaci[oó]n dada por el solicitante\s*:\s*([^\n]+?)(?=\s+Observaciones|\s+ENSAYO|$)/i)?.[1]
    || text.match(/(?:Alimento\s*T\d|Hisopado[^:]*):\s*([^\n]+)/i)?.[1]
    || ''

  const resultLines = lines.filter(line => PARAMETER_PATTERNS.some(item => item.pattern.test(line)) && !/criterio de aceptaci[oó]n|n\s*=\s*\d/i.test(line))
  const results = []
  const seen = new Set()
  for (const line of resultLines) {
    const parameter = PARAMETER_PATTERNS.find(item => item.pattern.test(line))
    const valor = extractLineValue(line)
    if (!parameter || !valor || seen.has(parameter.parametroId)) continue
    seen.add(parameter.parametroId)
    results.push({ parametroId:parameter.parametroId, valor, unidad:extractUnit(line), sourceLine:line })
  }

  return {
    protocolo:protocolFromText || protocolFromName || '',
    fecha:date ? date.split(/[/-]/).reverse().map((part, index) => index === 0 && part.length === 2 ? `20${part}` : part).join('-') : '',
    muestra:sample,
    resultados:results,
    texto:text,
  }
}

export async function extractMicrobiologyPdf(file) {
  const [{ getDocument, GlobalWorkerOptions }, { default:workerSrc }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = workerSrc
  const bytes = new Uint8Array(await file.arrayBuffer())
  const document = await getDocument({ data:bytes }).promise
  const pages = await Promise.all(Array.from({ length:document.numPages }, async (_, index) => {
    const page = await document.getPage(index + 1)
    const content = await page.getTextContent()
    return content.items.map(item => `${item.str}${item.hasEOL ? '\n' : ' '}`).join('')
  }))
  return parseMicrobiologyText(pages.join('\n'), file.name)
}
