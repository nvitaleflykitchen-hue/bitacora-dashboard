// Guía de evaluación de desempeño — extraída del "Instructivo de Evaluaciones
// de Desempeño Fly Gestión". Alimenta la ayuda en contexto del formulario
// para que el evaluador no dependa de un documento aparte.

// Qué observar en cada criterio (los 11 campos de la evaluación).
export const CRITERIOS_GUIA = {
  d1_cumple_actividades: {
    titulo: "Cumple actividades",
    intro: "Realiza las tareas de su puesto, en tiempo y forma.",
    puntos: [
      "Cumplimiento y finalización de tareas",
      "Calidad del trabajo",
      "Errores o reprocesos",
      "Respeto de procedimientos",
    ],
  },
  d2_sin_supervision: {
    titulo: "Trabajo sin supervisión",
    intro: "Nivel de autonomía para ejecutar sin control permanente.",
    puntos: [
      "Necesidad de recordatorios",
      "Organiza su propio trabajo",
      "Resuelve situaciones habituales",
      "Pide ayuda de forma oportuna",
    ],
  },
  d3_comprende_prioridades: {
    titulo: "Comprende prioridades",
    intro: "Identifica qué tareas deben resolverse primero.",
    puntos: [
      "Organización en alta demanda",
      "Cumple horarios de servicio",
      "Prioriza tareas críticas",
      "Se reorganiza ante cambios y avisa demoras",
    ],
  },
  e1_cooperacion: {
    titulo: "Cooperación",
    intro: "Disposición para colaborar con el equipo.",
    puntos: [
      "Ayuda a compañeros",
      "Cumple responsabilidades compartidas",
      "Participa en tareas generales",
      "No confundir con amistad o buena relación personal",
    ],
  },
  e2_comunicacion: {
    titulo: "Comunicación",
    intro: "Transmite información de manera clara y oportuna.",
    puntos: [
      "Informa novedades, errores y faltantes",
      "Escucha indicaciones",
      "Pregunta cuando no comprende",
      "Usa los canales y registros correspondientes",
    ],
  },
  e3_maneja_desacuerdos: {
    titulo: "Manejo de desacuerdos",
    intro: "Cómo responde ante diferencias, correcciones o indicaciones.",
    puntos: [
      "Respeto en el trato",
      "Capacidad para escuchar",
      "Plantea la diferencia de forma adecuada",
      "No se evalúa si 'cae bien', sino la conducta laboral",
    ],
  },
  e4_ambiente_confianza: {
    titulo: "Ambiente de confianza",
    intro: "Su conducta contribuye a un entorno profesional.",
    puntos: [
      "Respeto y responsabilidad",
      "Cumple compromisos",
      "Honestidad",
      "Trato con compañeros, clientes y responsables",
    ],
  },
  e5_evita_conflictos: {
    titulo: "Evita conflictos",
    intro: "Maneja situaciones sin generar enfrentamientos innecesarios.",
    puntos: [
      "Plantea problemas de forma adecuada",
      "Usa los canales correspondientes",
      "Evita rumores y discusiones improductivas",
      "Diferencia desacuerdo operativo de conflicto personal",
    ],
  },
  p1_cumple_horario: {
    titulo: "Cumple horario",
    intro: "Puntualidad y cumplimiento efectivo del turno.",
    puntos: [
      "Hora de ingreso",
      "Ausencias y tardanzas",
      "Avisos anticipados",
      "Permanencia efectiva en el puesto",
    ],
  },
  p2_aseo_personal: {
    titulo: "Aseo personal",
    intro: "Higiene personal y normas de seguridad alimentaria.",
    puntos: [
      "Higiene personal",
      "Estado y limpieza de la ropa de trabajo",
      "Cumplimiento de normas internas",
    ],
  },
  p3_uniforme: {
    titulo: "Uniforme",
    intro: "Uso completo de la presentación requerida.",
    puntos: [
      "Uso completo del uniforme",
      "Cofia, calzado y elementos requeridos",
      "Estado y limpieza",
    ],
  },
};

// Escala 1-5. Mensaje clave contra la inflación de puntajes:
// cumplir correctamente = 3, superar lo esperado = 4, el 5 es excepcional.
export const ESCALA_GUIA = [
  { n: 1, nivel: "Muy bajo", def: "Claramente inferior a lo requerido. Incumplimientos reiterados, supervisión permanente." },
  { n: 2, nivel: "Bajo", def: "Cumple parcialmente, con dificultades relevantes. Cumplimiento irregular." },
  { n: 3, nivel: "Aceptable", def: "Cumple correctamente lo esperado para el puesto. Este es el valor de referencia." },
  { n: 4, nivel: "Alto", def: "Supera lo esperado de forma consistente. Requiere hechos que lo respalden." },
  { n: 5, nivel: "Excepcional", def: "Desempeño sobresaliente y verificable. Reservado para casos realmente excepcionales." },
];

export const RECORDATORIO_ESCALA =
  "Cumplir lo esperado = 3. Superar = 4. El 5 es excepcional. Evitá inflar puntajes.";

// Frases vacías a desalentar en Observaciones (§5 del instructivo).
export const FRASES_VACIAS = [
  "excelente persona",
  "muy buena compañera",
  "muy buen compañero",
  "todo bien",
  "cumple siempre",
  "sin observaciones",
  "trabaja bien",
  "buena actitud",
];

// Checklist previo a guardar (§11 del instructivo).
export const CHECKLIST_PREVIO = [
  "Los puntajes se basan en hechos observados.",
  "Los valores 4 y 5 están justificados.",
  "Los comentarios coinciden con las calificaciones.",
  "Incluye al menos una oportunidad de mejora.",
  "No se evaluaron aspectos personales.",
  "Se consideró todo el período, no un único hecho.",
  "Los ítems no observados quedaron 'Sin calificar'.",
  "La evaluación puede explicarse al empleado.",
];
