export function normalizeBarcode(value) {
  if (typeof value !== 'string') throw new Error('El código debe ser texto.')
  const code = value.trim()
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) throw new Error('Ingresá un código EAN-8, UPC de 12 dígitos, EAN-13 o GTIN-14, sin espacios.')
  return code
}

export function barcodeType(code) {
  return ({ 8:'EAN-8', 12:'UPC-A', 13:'EAN-13', 14:'GTIN-14' })[normalizeBarcode(code).length]
}

export function validCheckDigit(value) {
  const code = normalizeBarcode(value)
  const sum = [...code.slice(0, -1)].reverse().reduce((n, digit, i) => n + Number(digit) * (i % 2 ? 1 : 3), 0)
  return (10 - sum % 10) % 10 === Number(code.at(-1))
}

export function safeImageUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : '' } catch { return '' }
}
