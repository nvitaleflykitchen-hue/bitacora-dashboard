const MS_DIA = 86_400_000;

function partesFecha(fecha) {
  const match = String(fecha || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { mes: Number(match[2]), dia: Number(match[3]) };
}

export function proximosCumpleanios(personas = [], hoy = new Date(), dias = 7) {
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return personas.flatMap((persona) => {
    const partes = partesFecha(persona.fecha_nacimiento);
    if (!partes) return [];
    let fecha = new Date(inicio.getFullYear(), partes.mes - 1, partes.dia);
    if (fecha < inicio) fecha = new Date(inicio.getFullYear() + 1, partes.mes - 1, partes.dia);
    const faltan = Math.round((fecha - inicio) / MS_DIA);
    return faltan <= dias ? [{ ...persona, fecha_cumpleanios: fecha, dias_hasta: faltan }] : [];
  }).sort((a, b) => a.dias_hasta - b.dias_hasta || String(a.nombre).localeCompare(String(b.nombre), "es"));
}

export function telefonoWhatsApp(telefono) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("549")) return digitos;
  if (digitos.startsWith("54")) return `549${digitos.slice(2)}`;
  return digitos;
}
