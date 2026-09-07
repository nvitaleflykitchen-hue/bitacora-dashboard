export const PRODUCT_FIELD_LABELS = {
  name:'Nombre', description:'Descripción comercial', brand:'Marca', manufacturer:'Fabricante',
  category:'Categoría', subcategory:'Subcategoría', image_url:'Imagen', ingredients:'Ingredientes',
  allergens:'Alérgenos', country_of_origin:'País de origen', nutrition_text:'Información nutricional',
  presentation:'Presentación', packaging_level:'Nivel de empaque', net_quantity:'Contenido unitario',
  net_unit:'Unidad de contenido', units_per_package:'Unidades por caja / bulto',
}
const blank = (value, key) => value == null || String(value).trim() === '' || (key === 'packaging_level' && value === 'unknown')

export function missingProposals(current, candidates) {
  const chosen = new Set(), proposals = []
  for (const candidate of candidates || []) {
    const product = candidate.product || candidate
    const source = product.source
    if (!source) continue
    const fields = {}
    // A quantity and its unit are a single measurement: never mix sources or
    // attach a proposed unit to an incompatible quantity entered by the user.
    const measurement = ['net_quantity','net_unit']
    const packagingFits = ['packaging_level','units_per_package'].every(k => blank(current[k],k) || blank(product[k],k) || String(current[k]) === String(product[k]))
    const measurementFits = measurement.every(k => !blank(product[k],k) && (blank(current[k],k) || String(current[k]) === String(product[k])))
    for (const key of Object.keys(PRODUCT_FIELD_LABELS)) {
      if (['net_quantity','net_unit','units_per_package','packaging_level'].includes(key) && !packagingFits) continue
      if (measurement.includes(key) && !measurementFits) continue
      if (!chosen.has(key) && blank(current[key],key) && !blank(product[key],key)) {
        fields[key] = product[key]; chosen.add(key)
      }
    }
    if (Object.keys(fields).length) proposals.push({ fields, source, candidate:product })
  }
  return proposals
}

export function displayProductSources(sources, depth = 0) {
  return (sources || []).flatMap(source => depth < 4 && Array.isArray(source.raw_metadata?.sources)
    ? displayProductSources(source.raw_metadata.sources, depth + 1) : [source])
}

export function applyProductProposals(current, proposals) {
  // Re-check blanks when applying, even if the form changed since lookup.
  const valid = missingProposals(current, proposals.map(p => p.candidate || ({ ...p.fields, source:p.source })))
  if (!valid.length) return current
  const sources = [...(current.source ? [current.source] : []), ...valid.map(p => p.source)]
  return { ...current, ...Object.assign({}, ...valid.map(p => p.fields)), source:{
    provider:'Datos completados con fuentes verificadas', retrieved_at:new Date().toISOString(),
    source_url:valid[0].source.source_url,
    raw_metadata:{ sources, accepted_fields:valid.map(p => ({ fields:Object.keys(p.fields), source_url:p.source.source_url })) },
  } }
}
