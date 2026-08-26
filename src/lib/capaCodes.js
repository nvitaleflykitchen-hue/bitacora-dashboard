export function nextCapaSequence(codigos = [], prefijo, anio) {
  const inicio = `${prefijo}-${anio}-`
  return codigos.reduce((maximo, item) => {
    const codigo = typeof item === 'string' ? item : item?.codigo
    if (!codigo?.startsWith(inicio)) return maximo
    const numero = Number(codigo.slice(inicio.length))
    return Number.isInteger(numero) ? Math.max(maximo, numero) : maximo
  }, 0) + 1
}

export function formatCapaCode(prefijo, anio, secuencia) {
  return `${prefijo}-${anio}-${String(secuencia).padStart(3, '0')}`
}
