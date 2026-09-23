export const MICROBIOLOGIA_PARAMETROS = [
  'Aerobios mesófilos', 'Coliformes totales', 'Escherichia coli',
  'Salmonella spp.', 'Listeria monocytogenes', 'Staphylococcus aureus',
  'Mohos', 'Levaduras', 'Otro',
]

export function buildMicroStats(records) {
  const valid = records.filter(row => !row.anulado_en)
  return {
    total:valid.length,
    cumple:valid.filter(row => row.estado === 'cumple').length,
    observado:valid.filter(row => row.estado === 'observado').length,
    noCumple:valid.filter(row => row.estado === 'no_cumple').length,
  }
}
