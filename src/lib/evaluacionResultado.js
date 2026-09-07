export const RESULTADO_EVALUACION_COLOR = Object.freeze({
  "Muy bajo": "#ff2a2a",
  Bajo: "#ff4444",
  Aceptable: "#f59e0b",
  Alto: "#3b82f6",
  Excepcional: "#39ff14",
});

export function getResultadoEvaluacion(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 1 || value > 5) return null;
  if (value < 1.5) return "Muy bajo";
  if (value < 2.5) return "Bajo";
  if (value < 3.5) return "Aceptable";
  if (value < 4.5) return "Alto";
  return "Excepcional";
}
