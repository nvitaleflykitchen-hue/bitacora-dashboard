function firmaRegistroGenerado(item) {
  const descripcion = String(item?.descripcion || "").trim();
  const referencia = descripcion.match(/^\[Registro #(\d+)\s*[·-]/i);
  if (!referencia) return null;

  return [item.persona_id, referencia[1], item.tipo, item.fecha,
    descripcion.replace(/\s+/g, " ").toLocaleLowerCase("es")].join("|");
}

export function deduplicarHistorialPersonal(items = []) {
  const firmas = new Set();
  return items.filter((item) => {
    const firma = firmaRegistroGenerado(item);
    if (!firma) return true;
    if (firmas.has(firma)) return false;
    firmas.add(firma);
    return true;
  });
}
