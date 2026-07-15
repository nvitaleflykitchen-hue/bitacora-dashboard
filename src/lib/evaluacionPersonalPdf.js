import { jsPDF } from "jspdf";
import { FLY_KITCHEN_LOGO_PNG } from "../assets/flyKitchenLogo.js";

const clean = (value) => String(value ?? "-")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[–—]/g, "-")
  .trim() || "-";
const slug = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const fechaAr = (value) => {
  if (!value) return "-";
  const [date] = String(value).split("T");
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : clean(value);
};

const BLOQUES = [
  ["DESEMPENO EN EL PUESTO", [["d1_cumple_actividades", "Cumple actividades"], ["d2_sin_supervision", "Trabaja sin supervision"], ["d3_comprende_prioridades", "Comprende prioridades"]]],
  ["TRABAJO EN EQUIPO Y CLIMA", [["e1_cooperacion", "Cooperacion"], ["e2_comunicacion", "Comunicacion"], ["e3_maneja_desacuerdos", "Maneja desacuerdos"], ["e4_ambiente_confianza", "Genera confianza"], ["e5_evita_conflictos", "Evita conflictos"]]],
  ["PRESENTACION Y PUNTUALIDAD", [["p1_cumple_horario", "Cumple horario"], ["p2_aseo_personal", "Aseo personal"], ["p3_uniforme", "Uniforme"]]],
];

export function evaluacionPersonalFilename(persona = {}, evaluacion = {}) {
  const nombre = slug(`${persona.apellido || ""}-${persona.nombre || ""}`) || "persona";
  return `evaluacion-desempeno-${nombre}-${evaluacion.fecha_evaluacion || "sin-fecha"}.pdf`;
}

export function createEvaluacionPersonalPdf(persona = {}, evaluacion = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const nombre = `${persona.nombre || ""} ${persona.apellido || ""}`.trim();
  const sedes = persona.sede_nombre || persona.sedes_nombres || "-";
  let y = 14;

  doc.addImage(FLY_KITCHEN_LOGO_PNG, "PNG", 15, y, 38, 14.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("EVALUACION DE DESEMPENO", 195, 20, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text("Documento interno - Fly Kitchen", 195, 26, { align: "right" });
  doc.setDrawColor(40);
  doc.line(15, 33, 195, 33);

  const data = [
    ["Personal evaluado", nombre || "-", "DNI", clean(persona.dni)],
    ["Legajo", clean(persona.legajo), "Puesto", clean(persona.puesto)],
    ["Sede", clean(sedes), "Ingreso", fechaAr(persona.fecha_ingreso)],
    ["Evaluador", clean(evaluacion.evaluador_nombre), "Cargo", clean(evaluacion.evaluador_cargo)],
    ["Periodo", clean(evaluacion.periodo), "Fecha", fechaAr(evaluacion.fecha_evaluacion)],
  ];
  y = 42;
  data.forEach(([l1, v1, l2, v2]) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(70); doc.text(`${l1}:`, 15, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(0); doc.text(clean(v1), 48, y, { maxWidth: 60 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(70); doc.text(`${l2}:`, 112, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(0); doc.text(clean(v2), 135, y, { maxWidth: 60 });
    y += 7;
  });

  y += 3;
  BLOQUES.forEach(([titulo, items]) => {
    doc.setFillColor(30, 30, 30); doc.rect(15, y - 4.5, 180, 7, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(titulo, 18, y);
    y += 6;
    items.forEach(([key, label], index) => {
      if (index % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(15, y - 4.5, 180, 6.5, "F"); }
      doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(label, 18, y);
      doc.setFont("helvetica", "bold"); doc.text(clean(evaluacion[key]), 190, y, { align: "right" });
      y += 6.5;
    });
    y += 2;
  });

  doc.setDrawColor(180); doc.line(15, y, 195, y); y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(0);
  doc.text(`PUNTAJE: ${clean(evaluacion.puntaje_calculado)} / 5`, 15, y);
  doc.text(`RESULTADO: ${clean(evaluacion.resultado_global)}`, 195, y, { align: "right" });
  y += 8;
  const observaciones = [
    ["Observaciones RRHH", evaluacion.observaciones_rrhh],
    ["Sugerencias del evaluador", evaluacion.sugerencias_evaluador],
  ];
  observaciones.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(`${label}:`, 15, y);
    y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    const lines = doc.splitTextToSize(clean(value), 180).slice(0, 4);
    doc.text(lines, 15, y, { lineHeightFactor: 1.25 });
    y += Math.max(8, lines.length * 4) + 3;
  });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Supero periodo de prueba: ${evaluacion.supero_prueba ? "Si" : "No"}`, 15, y);

  const firmaY = 270;
  doc.setDrawColor(80); doc.line(20, firmaY, 90, firmaY); doc.line(120, firmaY, 190, firmaY);
  doc.setFontSize(7); doc.setTextColor(70);
  doc.text("Firma del evaluador", 55, firmaY + 5, { align: "center" });
  doc.text("Firma del personal evaluado", 155, firmaY + 5, { align: "center" });
  doc.setFontSize(6.5); doc.text(`Generado por Fly Gestion - ${new Date().toLocaleDateString("es-AR")}`, 105, 290, { align: "center" });
  return doc;
}

export function downloadEvaluacionPersonalPdf(persona, evaluacion) {
  createEvaluacionPersonalPdf(persona, evaluacion).save(evaluacionPersonalFilename(persona, evaluacion));
}

export function evaluacionPersonalFile(persona, evaluacion) {
  const blob = createEvaluacionPersonalPdf(persona, evaluacion).output("blob");
  return new File([blob], evaluacionPersonalFilename(persona, evaluacion), { type: "application/pdf" });
}

export function textoEvaluacionPersonal(persona = {}, evaluacion = {}) {
  const nombre = `${persona.nombre || ""} ${persona.apellido || ""}`.trim();
  return [
    `EVALUACION DE DESEMPENO - ${nombre}`,
    `Periodo: ${clean(evaluacion.periodo)} | Fecha: ${fechaAr(evaluacion.fecha_evaluacion)}`,
    `Evaluador: ${clean(evaluacion.evaluador_nombre)} (${clean(evaluacion.evaluador_cargo)})`,
    `Puntaje: ${clean(evaluacion.puntaje_calculado)} / 5 | Resultado: ${clean(evaluacion.resultado_global)}`,
    evaluacion.observaciones_rrhh ? `Observaciones: ${clean(evaluacion.observaciones_rrhh)}` : "",
    evaluacion.sugerencias_evaluador ? `Sugerencias: ${clean(evaluacion.sugerencias_evaluador)}` : "",
    "Fly Gestion - documento de uso interno.",
  ].filter(Boolean).join("\n");
}
