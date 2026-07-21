const RACION_CATEGORIAS = [
  {
    key: 'op1',
    label: 'Opción 1',
    producido: 'op1_producidos',
    servido: 'op1_servidos',
    sobrante: 'op1_sobrante',
    reutilizable: 'op1_sobrante_reutilizable',
    descarte: 'op1_sobrante_descarte',
  },
  {
    key: 'op2',
    label: 'Opción 2',
    producido: 'op2_producidos',
    servido: 'op2_servidos',
    sobrante: 'op2_sobrante',
    reutilizable: 'op2_sobrante_reutilizable',
    descarte: 'op2_sobrante_descarte',
  },
  {
    key: 'vegetariano',
    label: 'Vegetariano',
    producido: 'vegetariano_producidos',
    servido: 'vegetariano_servidos',
    sobrante: 'vegetariano_sobrante',
    reutilizable: 'vegetariano_sobrante_reutilizable',
    descarte: 'vegetariano_sobrante_descarte',
  },
  {
    key: 'ensalada',
    label: 'Ensalada',
    producido: 'ensalada_producidos',
    sobrante: 'ensalada_sobrante',
    reutilizable: 'ensalada_sobrante_reutilizable',
    descarte: 'ensalada_sobrante_descarte',
  },
  {
    key: 'postre',
    label: 'Postre',
    producido: 'postre_producidos',
    sobrante: 'postre_sobrante',
    reutilizable: 'postre_sobrante_reutilizable',
    descarte: 'postre_sobrante_descarte',
  },
]

const toNumber = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const hasRaciones = registro => RACION_CATEGORIAS.some(cat => (
  toNumber(registro?.[cat.producido]) > 0 ||
  toNumber(registro?.[cat.servido]) > 0 ||
  toNumber(registro?.[cat.sobrante]) > 0 ||
  toNumber(registro?.[cat.reutilizable]) > 0 ||
  toNumber(registro?.[cat.descarte]) > 0
))

const isComedor = registro => {
  const tipo = String(registro?.sedes?.tipo || '').toLowerCase()
  const nombre = String(registro?.sedes?.nombre || registro?.sede_nombre || '').toLowerCase()
  return tipo.includes('comedor') || nombre.includes('comedor') || hasRaciones(registro)
}

const emptyTotals = () => ({
  producido: 0,
  servido: 0,
  sobrante: 0,
  reutilizable: 0,
  descarte: 0,
  sinDiscriminar: 0,
})

function getRacionValues(cat, registro) {
  const producido = toNumber(registro?.[cat.producido])
  const sobranteCargado = toNumber(registro?.[cat.sobrante])
  const discriminado = registro?.[cat.reutilizable] != null || registro?.[cat.descarte] != null
  const reutilizable = discriminado ? toNumber(registro?.[cat.reutilizable]) : 0
  const descarte = discriminado ? toNumber(registro?.[cat.descarte]) : 0

  if (discriminado) {
    const sobrante = reutilizable + descarte
    const servido = cat.servido && registro?.[cat.servido] != null
      ? toNumber(registro?.[cat.servido])
      : Math.max(0, producido - sobrante)
    return { producido, servido, sobrante, reutilizable, descarte, sinDiscriminar:0 }
  }

  if (cat.servido) {
    const servidoCargado = toNumber(registro?.[cat.servido])
    if (servidoCargado > 0) {
      return {
        producido,
        servido: servidoCargado,
        sobrante: Math.max(0, producido - servidoCargado),
        reutilizable:0,
        descarte:0,
        sinDiscriminar:Math.max(0, producido - servidoCargado),
      }
    }
    if (sobranteCargado > 0) {
      return {
        producido,
        servido: Math.max(0, producido - sobranteCargado),
        sobrante: sobranteCargado,
        reutilizable:0,
        descarte:0,
        sinDiscriminar:sobranteCargado,
      }
    }
    return { producido, servido: 0, sobrante: 0, reutilizable:0, descarte:0, sinDiscriminar:0 }
  }

  return {
    producido,
    servido: Math.max(0, producido - sobranteCargado),
    sobrante: sobranteCargado,
    reutilizable:0,
    descarte:0,
    sinDiscriminar:sobranteCargado,
  }
}

function addRegistroToTotals(totals, registro) {
  RACION_CATEGORIAS.forEach(cat => {
    const { producido, servido, sobrante, reutilizable, descarte, sinDiscriminar } = getRacionValues(cat, registro)

    totals.producido += producido
    totals.servido += servido
    totals.sobrante += sobrante
    totals.reutilizable += reutilizable
    totals.descarte += descarte
    totals.sinDiscriminar += sinDiscriminar
  })
}

function withPercentages(row) {
  const pctSobrante = row.producido > 0 ? Math.round((row.sobrante / row.producido) * 1000) / 10 : 0
  const pctServido = row.producido > 0 ? Math.round((row.servido / row.producido) * 1000) / 10 : 0
  const pctDescarte = row.producido > 0 ? Math.round((row.descarte / row.producido) * 1000) / 10 : 0
  const pctReutilizado = row.sobrante > 0 ? Math.round((row.reutilizable / row.sobrante) * 1000) / 10 : 0
  return { ...row, pctSobrante, pctServido, pctDescarte, pctReutilizado }
}

export function buildComedoresMetricas(registros = []) {
  const filtrados = (registros || []).filter(registro => isComedor(registro) && hasRaciones(registro))
  const global = emptyTotals()
  const porSedeMap = new Map()
  const porCategoriaMap = new Map(RACION_CATEGORIAS.map(cat => [cat.key, { key: cat.key, label: cat.label, ...emptyTotals() }]))

  const movimientos = filtrados.map(registro => {
    const row = {
      id: registro.id,
      sedeId: registro.sede_id || registro.sedes?.id || registro.sede_nombre,
      sedeNombre: registro.sedes?.nombre || registro.sede_nombre || 'Sin sede',
      fecha: registro.fecha_reporte,
      turno: registro.turno || 'Turno',
      ...emptyTotals(),
      categorias: {},
    }

    RACION_CATEGORIAS.forEach(cat => {
      const { producido, servido, sobrante, reutilizable, descarte, sinDiscriminar } = getRacionValues(cat, registro)

      row.producido += producido
      row.servido += servido
      row.sobrante += sobrante
      row.reutilizable += reutilizable
      row.descarte += descarte
      row.sinDiscriminar += sinDiscriminar
      row.categorias[cat.key] = { label: cat.label, producido, servido, sobrante, reutilizable, descarte, sinDiscriminar }

      const categoria = porCategoriaMap.get(cat.key)
      categoria.producido += producido
      categoria.servido += servido
      categoria.sobrante += sobrante
      categoria.reutilizable += reutilizable
      categoria.descarte += descarte
      categoria.sinDiscriminar += sinDiscriminar
    })

    addRegistroToTotals(global, registro)

    const sedeKey = String(row.sedeId)
    if (!porSedeMap.has(sedeKey)) {
      porSedeMap.set(sedeKey, {
        sedeId: row.sedeId,
        sedeNombre: row.sedeNombre,
        registros: 0,
        ultimoReporte: null,
        ...emptyTotals(),
      })
    }
    const sede = porSedeMap.get(sedeKey)
    sede.registros += 1
    sede.producido += row.producido
    sede.servido += row.servido
    sede.sobrante += row.sobrante
    sede.reutilizable += row.reutilizable
    sede.descarte += row.descarte
    sede.sinDiscriminar += row.sinDiscriminar
    if (!sede.ultimoReporte || new Date(row.fecha) > new Date(sede.ultimoReporte)) sede.ultimoReporte = row.fecha

    return withPercentages(row)
  }).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))

  const porSede = [...porSedeMap.values()]
    .map(withPercentages)
    .sort((a, b) => b.pctSobrante - a.pctSobrante || b.sobrante - a.sobrante)

  const porCategoria = [...porCategoriaMap.values()]
    .map(withPercentages)
    .sort((a, b) => b.sobrante - a.sobrante)

  return {
    global: {
      ...withPercentages(global),
      registros: filtrados.length,
      comedores: porSede.length,
    },
    porSede,
    porCategoria,
    movimientos,
  }
}

export { RACION_CATEGORIAS }
