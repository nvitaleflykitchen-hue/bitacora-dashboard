import { FRASES_VACIAS } from "../data/evaluacionGuia";

export const EVALUACION_SCORE_FIELDS = [
  "d1_cumple_actividades",
  "d2_sin_supervision",
  "d3_comprende_prioridades",
  "e1_cooperacion",
  "e2_comunicacion",
  "e3_maneja_desacuerdos",
  "e4_ambiente_confianza",
  "e5_evita_conflictos",
  "p1_cumple_horario",
  "p2_aseo_personal",
  "p3_uniforme",
];

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function puntajesEvaluacion(evaluacion) {
  return EVALUACION_SCORE_FIELDS
    .map((field) => Number(evaluacion?.[field]))
    .filter((value) => value >= 1 && value <= 5);
}

export function promedioEvaluacion(evaluacion) {
  const puntajes = puntajesEvaluacion(evaluacion);
  if (!puntajes.length) return null;
  return Math.round(
    (puntajes.reduce((total, value) => total + value, 0) / puntajes.length) * 10,
  ) / 10;
}

export function analizarObjetividadEvaluacion(evaluacion) {
  const puntajes = puntajesEvaluacion(evaluacion);
  const observaciones = String(evaluacion?.observaciones_rrhh || "").trim();
  const sugerencias = String(evaluacion?.sugerencias_evaluador || "").trim();
  const observacionesNormalizadas = normalizar(observaciones);
  const hallazgos = [];

  const agregar = (codigo, severidad, titulo, detalle) => {
    hallazgos.push({ codigo, severidad, titulo, detalle });
  };

  if (!String(evaluacion?.evaluador_nombre || "").trim()) {
    agregar(
      "evaluador_faltante",
      "bloqueante",
      "Falta identificar al evaluador",
      "Indicá quién observó el desempeño y será responsable de la devolución.",
    );
  }
  if (!String(evaluacion?.periodo || "").trim()) {
    agregar(
      "periodo_faltante",
      "bloqueante",
      "Falta el período evaluado",
      "La evaluación debe representar un período definido y no solamente el último hecho.",
    );
  }
  if (!String(evaluacion?.antiguedad_con_evaluado || "").trim()) {
    agregar(
      "observacion_faltante",
      "revision",
      "No se informó el tiempo de observación",
      "Indicá cuánto tiempo lleva el evaluador trabajando o supervisando a la persona.",
    );
  }
  if (!puntajes.length) {
    agregar(
      "sin_criterios",
      "bloqueante",
      "No hay criterios calificados",
      "Calificá únicamente los criterios observados y dejá el resto como Sin calificar.",
    );
  }

  if (
    puntajes.length === EVALUACION_SCORE_FIELDS.length
    && new Set(puntajes).size === 1
  ) {
    agregar(
      "puntaje_automatico",
      puntajes[0] === 5 ? "bloqueante" : "revision",
      "Los 11 criterios tienen la misma calificación",
      "Revisá cada criterio por separado para evitar un puntaje automático o efecto halo.",
    );
  }

  const altos = puntajes.filter((value) => value >= 4).length;
  const bajos = puntajes.filter((value) => value <= 2).length;
  if (altos > 0 && observaciones.length < 60) {
    agregar(
      "altos_sin_evidencia",
      "bloqueante",
      "Hay puntajes altos con evidencia insuficiente",
      "Los valores 4 y 5 requieren resultados, conductas o ejemplos concretos del período.",
    );
  }
  if (bajos > 0 && observaciones.length < 60) {
    agregar(
      "bajos_sin_evidencia",
      "bloqueante",
      "Hay puntajes bajos con evidencia insuficiente",
      "Los valores 1 y 2 deben describir hechos concretos, frecuencia e impacto laboral.",
    );
  }

  const fraseVacia = FRASES_VACIAS.find((frase) =>
    observacionesNormalizadas.includes(normalizar(frase)),
  );
  if (fraseVacia) {
    agregar(
      "observacion_generica",
      "revision",
      "La observación contiene una expresión genérica",
      `Reemplazá “${fraseVacia}” por una conducta, resultado o situación verificable.`,
    );
  }
  if (observaciones.length > 0 && observaciones.length < 30) {
    agregar(
      "observacion_breve",
      "revision",
      "La observación es demasiado breve",
      "Agregá fortalezas, nivel observado y al menos una situación concreta del período.",
    );
  }
  if (sugerencias.length < 20) {
    agregar(
      "seguimiento_faltante",
      "bloqueante",
      "Falta una oportunidad de desarrollo verificable",
      "Indicá qué debe sostenerse o mejorarse y cómo se revisará en el período siguiente.",
    );
  }

  const bloqueantes = hallazgos.filter(
    (hallazgo) => hallazgo.severidad === "bloqueante",
  ).length;
  const revisiones = hallazgos.length - bloqueantes;
  const criteriosObservados = puntajes.length;
  const calidad = Math.max(
    0,
    Math.round(
      100
      - bloqueantes * 18
      - revisiones * 8
      - Math.max(0, 6 - criteriosObservados) * 4,
    ),
  );

  return {
    hallazgos,
    bloqueantes,
    revisiones,
    criteriosObservados,
    calidad,
    estado:
      bloqueantes > 0
        ? "requiere_revision"
        : revisiones > 0
          ? "revisar"
          : "lista_para_validar",
  };
}

export function resumirCalidadEvaluaciones(evaluaciones = []) {
  const analizadas = evaluaciones.map((evaluacion) => ({
    evaluacion,
    analisis: analizarObjetividadEvaluacion(evaluacion),
  }));
  return {
    analizadas,
    total: analizadas.length,
    listas: analizadas.filter(
      ({ analisis }) => analisis.estado === "lista_para_validar",
    ).length,
    conObservaciones: analizadas.filter(
      ({ analisis }) => analisis.estado === "revisar",
    ).length,
    requierenRevision: analizadas.filter(
      ({ analisis }) => analisis.estado === "requiere_revision",
    ).length,
  };
}
