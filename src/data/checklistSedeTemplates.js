export const ELPIDIO_TORRES_SEDE_ID = 6

const item = (id, tipo, categoria, texto, orden) => ({
  id: `elpidio-${tipo}-${id}`,
  tipo,
  categoria,
  texto,
  orden,
  activo: true,
  sede_id: ELPIDIO_TORRES_SEDE_ID,
})

export const CHECKLIST_SEDE_TEMPLATES = {
  [ELPIDIO_TORRES_SEDE_ID]: {
    apertura: [
      item(1, 'apertura', 'Inicio del turno', 'Ingreso con uniforme reglamentario e higiene de manos', 1),
      item(2, 'apertura', 'Inicio del turno', 'Sector limpio, ordenado y preparado para trabajar', 2),
      item(3, 'apertura', 'Servicio', 'Desayunos preparados y servidos a internado y personal', 3),
      item(4, 'apertura', 'Control crítico', 'Dietas verificadas antes de armar y entregar las bandejas', 4),
      item(5, 'apertura', 'Servicio', 'Colaciones entregadas y todas las tazas retiradas', 5),
      item(6, 'apertura', 'Limpieza', 'Limpieza programada del día realizada', 6),
      item(7, 'apertura', 'Servicio', 'Sopa, carro y bandejas preparados para el almuerzo', 7),
      item(8, 'apertura', 'Servicio', 'Almuerzo servido correctamente a internado y comedor', 8),
      item(9, 'apertura', 'Cierre del turno', 'Bandejas y vajilla retiradas, lavadas y guardadas', 9),
      item(10, 'apertura', 'Cierre del turno', 'Insumos repuestos y cocina limpia y ordenada', 10),
    ],
    cierre: [
      item(1, 'cierre', 'Inicio del turno', 'Ingreso con uniforme reglamentario e higiene de manos', 1),
      item(2, 'cierre', 'Inicio del turno', 'Sector limpio, ordenado y preparado para trabajar', 2),
      item(3, 'cierre', 'Servicio', 'Meriendas preparadas y servidas a internado y comedor', 3),
      item(4, 'cierre', 'Servicio', 'Colaciones entregadas y todas las tazas retiradas', 4),
      item(5, 'cierre', 'Limpieza', 'Limpieza programada del día realizada', 5),
      item(6, 'cierre', 'Producción', 'Postre del día siguiente preparado', 6),
      item(7, 'cierre', 'Control crítico', 'Dietas verificadas y bandejas de cena armadas correctamente', 7),
      item(8, 'cierre', 'Servicio', 'Cena servida correctamente a internado y comedor', 8),
      item(9, 'cierre', 'Cierre del turno', 'Bandejas y vajilla retiradas, lavadas y guardadas', 9),
      item(10, 'cierre', 'Cierre del turno', 'Insumos repuestos y cocina limpia y ordenada', 10),
    ],
  },
}

export const ELPIDIO_TURNO_INFO = {
  apertura: {
    label: 'Turno mañana',
    emoji: '🌅',
    color: '#39FF14',
    horario: '06:30 a 14:30',
    rutina: 'Desayunos y colaciones · limpieza programada · preparación y servicio del almuerzo · retiro y orden final.',
  },
  cierre: {
    label: 'Turno tarde',
    emoji: '🌙',
    color: '#F59E0B',
    horario: '14:30 a 22:30',
    rutina: 'Meriendas y colaciones · limpieza programada · postre del día siguiente · preparación y servicio de la cena · orden final.',
  },
}

// ─── COMEDOR LIBERTAD · CRONOGRAMA DE LIMPIEZA (ISO FK) ───────────────────────
// Origen: Planilla de control REG-LIB-LIM-001/002/003 v2 (28/04/2026).
// Modelo mobile: cada sector = 1 ítem con estado cumplido/no_cumplido/no_aplica,
// evidencia fotográfica y observaciones obligatorias ante desvío. Los desvíos
// con seguimiento se cargan además como tarea (REG-004).
export const LIBERTAD_SEDE_ID = 3

const litem = (tipo, cat, texto, orden) => ({
  id: `libertad-${tipo}-${orden}`,
  tipo, categoria: cat, texto, orden, activo: true, sede_id: LIBERTAD_SEDE_ID,
})

const LIB_DIARIA = [
  'Mesadas', 'Pisos', 'Anafe', 'Horno', 'Freidora', 'Baño frío / lunchonera',
  'Puertas y manijas', 'Tachos de basura', 'Elementos de cocina',
  'Heladera depósito', 'Freezer depósito', 'Freezer externo salón',
  'Campanas (control visible)',
].map((t, i) => litem('limpieza_diaria', 'Control diario', t, i + 1))

const LIB_SEMANAL = [
  'Mesadas (patas y bordes inferiores)', 'Puertas, marcos y manijas',
  'Anafe (parrillas, quemadores y base)', 'Azulejos sector cocción',
  'Horno (interior, exterior y base)', 'Freidora (equipo, canastos y base)',
  'Depósito (heladera, freezer y estantería secos)', 'Freezer externo del salón',
  'Campana 1 (exterior)', 'Campana 2 (exterior)', 'Filtros campanas 1 y 2',
  'Baño frío / lunchonera', 'Elementos de cocina',
].map((t, i) => litem('limpieza_semanal', 'Limpieza profunda semanal', t, i + 1))

const LIB_QUINCENAL = [
  'Ángulos del techo', 'Campanas – revisión profunda', 'Azulejos generales',
  'Sectores bajos y rincones', 'Sector fuegos – difícil acceso',
  'Sector mesa fría – difícil acceso', 'Depósito – sectores altos',
].map((t, i) => litem('limpieza_quincenal', 'Limpieza quincenal / difícil acceso', t, i + 1))

CHECKLIST_SEDE_TEMPLATES[LIBERTAD_SEDE_ID] = {
  limpieza_diaria: LIB_DIARIA,
  limpieza_semanal: LIB_SEMANAL,
  limpieza_quincenal: LIB_QUINCENAL,
}

export const LIBERTAD_LIMPIEZA_INFO = {
  limpieza_diaria: {
    label: 'Limpieza diaria', emoji: '🧽', color: '#39FF14', turno: 'Diario',
    horario: 'REG-LIB-LIM-001', rutina: 'Control diario de sectores (mesadas, anafe, horno, freidora, campanas, depósito). Marcá cada sector y adjuntá foto.',
  },
  limpieza_semanal: {
    label: 'Limpieza semanal', emoji: '🧴', color: '#60A5FA', turno: 'Semanal',
    horario: 'REG-LIB-LIM-002', rutina: 'Limpieza profunda semanal. Indicá lo realizado y si algún ítem requiere mantenimiento técnico.',
  },
  limpieza_quincenal: {
    label: 'Limpieza quincenal', emoji: '🪣', color: '#A78BFA', turno: 'Quincenal',
    horario: 'REG-LIB-LIM-003', rutina: 'Puntos de difícil acceso y limpieza profunda quincenal. Registrá fecha real y desvíos.',
  },
}

// Config genérica: qué variantes de checklist tiene cada sede (para el selector).
export const CHECKLIST_TIPOS_POR_SEDE = {
  [ELPIDIO_TORRES_SEDE_ID]: ELPIDIO_TURNO_INFO,
  [LIBERTAD_SEDE_ID]: LIBERTAD_LIMPIEZA_INFO,
}
