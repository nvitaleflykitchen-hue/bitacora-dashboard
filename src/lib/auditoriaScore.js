export const AUDITORIA_PUNTOS = { Cumple: 2, Parcial: 1, "No cumple": 0 };

export function calcularCumplimientoAuditoria(preguntas = [], respuestas = {}) {
  let obtenido = 0;
  let maximo = 0;

  preguntas.forEach((pregunta) => {
    const respuesta = respuestas[pregunta.id];
    if (!respuesta?.valor || respuesta.valor === "No observado") return;
    const peso = Number(pregunta.peso) || 1;
    maximo += 2 * peso;
    obtenido += (AUDITORIA_PUNTOS[respuesta.valor] ?? 0) * peso;
  });

  return maximo ? Math.round((obtenido / maximo) * 1000) / 10 : null;
}

export function resumirPuntajeAuditoria(preguntas = [], respuestas = {}) {
  const resumen = {
    cumple: 0,
    parcial: 0,
    noCumple: 0,
    noObservado: 0,
    sinResponder: 0,
    obtenido: 0,
    maximo: 0,
  };
  preguntas.forEach((pregunta) => {
    const valor = respuestas[pregunta.id]?.valor;
    const peso = Number(pregunta.peso) || 1;
    if (!valor) {
      resumen.sinResponder += 1;
      return;
    }
    if (valor === "No observado") {
      resumen.noObservado += 1;
      return;
    }
    if (valor === "Cumple") resumen.cumple += 1;
    else if (valor === "Parcial") resumen.parcial += 1;
    else if (valor === "No cumple") resumen.noCumple += 1;
    resumen.maximo += 2 * peso;
    resumen.obtenido += (AUDITORIA_PUNTOS[valor] ?? 0) * peso;
  });
  return resumen;
}

export function clasificarAuditoria(puntaje) {
  if (puntaje == null) return null;
  if (puntaje >= 90) return "Conforme";
  if (puntaje >= 70) return "Con observaciones";
  if (puntaje >= 50) return "No conforme";
  return "Crítico";
}

const AUDITORES_GLOBALES = new Set([
  "tecnica@flykitchen.com.ar",
  "rrhh.higieneyseguridad.emp@gmail.com",
]);

export function filtrarAuditoresElegibles(perfiles = [], sedeTipo = "") {
  const esAeropuerto = String(sedeTipo).toLowerCase() === "aeropuerto";
  return perfiles
    .filter((perfil) => {
      if (perfil.activo === false) return false;
      const email = String(perfil.email || "").toLowerCase();
      if (email === "mriviere@flykitchen.com.ar") return esAeropuerto;
      return (
        ["admin", "editor"].includes(perfil.rol) ||
        AUDITORES_GLOBALES.has(email)
      );
    })
    .sort((a, b) =>
      String(a.nombre || a.email).localeCompare(
        String(b.nombre || b.email),
        "es",
      ),
    );
}
