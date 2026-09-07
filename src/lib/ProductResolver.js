import { normalizeBarcode } from './productBarcode'

// Dependencies are injected so every source can be added without changing the UI.
// A local database error is deliberately propagated: it is not a missing product.
export class ProductResolver {
  constructor({ findLocal, providers = [] }) {
    this.findLocal = findLocal
    this.providers = providers
  }
  async resolve(value, { signal } = {}) {
    const barcode = normalizeBarcode(value)
    const local = await this.findLocal(barcode, { signal })
    if (local) return { product:local, origin:'local', warnings:[] }
    const warnings = []
    for (const provider of this.providers) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
      try {
        const result = await provider.lookup(barcode, { signal })
        warnings.push(...(result?.warnings || []))
        if (result?.product) return { ...result, origin:'external', warnings }
      } catch (error) {
        if (error.name === 'AbortError' || signal?.aborted) throw error
        warnings.push(`${provider.name}: no se pudo consultar. Podés completar los datos manualmente.`)
      }
    }
    return { product:null, origin:'unknown', warnings }
  }
}
