import { describe, expect, it } from "vitest";
import {
  analizarObjetividadEvaluacion,
  resumirCalidadEvaluaciones,
} from "./evaluacionObjetividad";

const puntajes = {
  d1_cumple_actividades: 3,
  d2_sin_supervision: 3,
  d3_comprende_prioridades: 4,
  e1_cooperacion: 3,
  e2_comunicacion: 3,
  e3_maneja_desacuerdos: 3,
  e4_ambiente_confianza: 3,
  e5_evita_conflictos: 3,
  p1_cumple_horario: 3,
  p2_aseo_personal: 3,
  p3_uniforme: 3,
};

const evaluacionValida = {
  ...puntajes,
  evaluador_nombre: "María González",
  periodo: "Q2 2026",
  antiguedad_con_evaluado: "8 meses",
  observaciones_rrhh:
    "Cumple el cronograma diario y mantiene los registros completos. Durante el período resolvió faltantes sin demorar el servicio.",
  sugerencias_evaluador:
    "Reforzar la planificación previa de las tareas de mayor demanda y revisarla dentro de treinta días.",
};

describe("analizarObjetividadEvaluacion", () => {
  it("acepta una evaluación con evidencia y seguimiento concretos", () => {
    const resultado = analizarObjetividadEvaluacion(evaluacionValida);
    expect(resultado.estado).toBe("lista_para_validar");
    expect(resultado.hallazgos).toHaveLength(0);
  });

  it("detecta puntaje automático y falta de evidencia", () => {
    const resultado = analizarObjetividadEvaluacion({
      ...evaluacionValida,
      ...Object.fromEntries(Object.keys(puntajes).map((key) => [key, 5])),
      observaciones_rrhh: "Trabaja bien.",
      sugerencias_evaluador: "",
    });
    expect(resultado.estado).toBe("requiere_revision");
    expect(resultado.hallazgos.map((item) => item.codigo)).toEqual(
      expect.arrayContaining([
        "puntaje_automatico",
        "altos_sin_evidencia",
        "observacion_generica",
        "seguimiento_faltante",
      ]),
    );
  });

  it("resume el estado del conjunto sin convertirlo en ranking", () => {
    const resumen = resumirCalidadEvaluaciones([
      evaluacionValida,
      { ...evaluacionValida, periodo: "" },
    ]);
    expect(resumen.total).toBe(2);
    expect(resumen.listas).toBe(1);
    expect(resumen.requierenRevision).toBe(1);
  });
});
