const digitsOnly = value => String(value || '').replace(/\D/g, '')

export function phoneDigits(value) {
  let digits = digitsOnly(value)
  if (!digits) return ''
  if (digits.length <= 4) return digits
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.startsWith('54') ? digits : `54${digits}`
}

export function phoneHref(value) {
  const digits = phoneDigits(value)
  if (!digits) return ''
  return digits.length <= 4 ? `tel:${digits}` : `tel:+${digits}`
}

export function whatsappDigits(value) {
  const normalized = phoneDigits(value)
  if (!normalized || normalized.length <= 4) return ''
  if (normalized.startsWith('549')) return normalized
  if (normalized.startsWith('54')) return `549${normalized.slice(2).replace(/^9/, '')}`
  return normalized
}

export function whatsappHref(value) {
  const digits = whatsappDigits(value)
  return digits ? `https://wa.me/${digits}` : ''
}

