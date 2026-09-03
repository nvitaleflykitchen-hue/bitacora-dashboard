const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseAssetQrValue(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) return null

  if (UUID_RE.test(raw)) return { id: raw, code: null }

  try {
    const url = new URL(raw, window.location.origin)
    const id = url.searchParams.get('id')?.trim()
    if (url.searchParams.get('scan') === 'activo' && UUID_RE.test(id || '')) {
      return { id, code: null }
    }
  } catch {
    // El valor puede ser un código interno, no necesariamente una URL.
  }

  if (/^FK-[A-Z0-9-]+$/i.test(raw)) return { id: null, code: raw.toUpperCase() }
  return null
}

export function parseInternalQrValue(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) return null

  const asset = parseAssetQrValue(raw)
  if (asset) return { type:'asset', ...asset }

  try {
    const url = new URL(raw, window.location.origin)
    const token = url.searchParams.get('credencial')?.trim()
    if (UUID_RE.test(token || '')) return { type:'credential', token }
  } catch {
    return null
  }

  return null
}

export function findScannedAsset(assets, scanValue) {
  const parsed = typeof scanValue === 'string' ? parseAssetQrValue(scanValue) : scanValue
  if (!parsed) return null

  return (assets || []).find(asset => (
    (parsed.id && String(asset.id).toLowerCase() === parsed.id.toLowerCase()) ||
    (parsed.code && String(asset.codigo_interno || '').toUpperCase() === parsed.code)
  )) || null
}
