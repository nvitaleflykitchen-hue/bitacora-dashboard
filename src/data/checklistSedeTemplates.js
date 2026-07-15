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
