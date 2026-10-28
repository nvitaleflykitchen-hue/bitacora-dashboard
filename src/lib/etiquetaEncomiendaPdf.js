function safeName(value) {
  return String(value || 'sede').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '_')
}

export async function crearEtiquetaEncomiendaPDF(datos) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a5' })
  const rows = [
    ['REMITENTE:', true],
    ['FLY KITCHEN S.A. - CUIT 30-70728569-5'],
    ['AV. LA VOZ DEL INTERIOR 7660'],
    ['CÓRDOBA - CÓRDOBA - ARGENTINA'],
    ['DESTINATARIO:', true],
    [[datos.destinatario, datos.dni && `DNI: ${datos.dni}`].filter(Boolean).join(' - ')],
    ...(datos.telefono ? [[`TEL.: ${datos.telefono}`]] : []),
    [datos.direccion],
    [datos.localidad || datos.sedeNombre],
    [datos.leyenda || `RETIRO EN TERMINAL DE ${datos.sedeNombre || ''}`, true],
  ]
  let layout, size = 16
  for (; size >= 9; size -= 0.5) {
    layout = rows.map(([text, bold]) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size)
      return { lines: doc.splitTextToSize(String(text || '—').toUpperCase(), 184), bold }
    })
    if (layout.reduce((sum, row) => sum + row.lines.length * size * 0.42 + 2, 0) <= 120) break
  }
  if (size < 9) throw new Error('El texto es demasiado largo para la etiqueta. Acortá los campos e intentá nuevamente.')
  doc.setDrawColor(0); doc.setLineWidth(0.7); doc.rect(5, 5, 200, 138)
  let y = 15
  for (const row of layout) {
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal'); doc.setFontSize(size)
    doc.text(row.lines, 12, y, { lineHeightFactor: 1.19 })
    y += row.lines.length * size * 0.42 + 2
  }
  return doc.output('blob')
}

export async function entregarEtiquetaEncomienda(datos, compartir=false) {
  const blob = await crearEtiquetaEncomiendaPDF(datos)
  const filename = `Etiqueta_Encomienda_${safeName(datos.sedeNombre)}.pdf`
  const file = new File([blob], filename, { type:'application/pdf' })
  if (compartir && navigator.share && navigator.canShare?.({ files:[file] })) {
    await navigator.share({ title:`Etiqueta de encomienda - ${datos.sedeNombre}`, files:[file] })
    return 'shared'
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(()=>URL.revokeObjectURL(url),1500)
  return 'downloaded'
}
