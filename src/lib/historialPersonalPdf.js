import { jsPDF } from "jspdf";
import { FLY_KITCHEN_LOGO_PNG } from "../assets/flyKitchenLogo.js";
import { downloadApercibimientoPdf } from "./apercibimientoPdf";

const clean = (value) => String(value ?? "—").replace(/[–—]/g, "-");
const slug = (value) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

export function historialPersonalFilename(persona = {}, registro = {}) {
  const personaNombre =
    slug(`${persona.apellido || ""}-${persona.nombre || ""}`) || "persona";
  return `${slug(registro.tipo || "registro")}-${personaNombre}-${registro.fecha || "sin-fecha"}.pdf`;
}

export function downloadHistorialPersonalPdf(persona, registro) {
  if (registro.tipo === "apercibimiento") {
    downloadApercibimientoPdf(persona, {
      fecha: registro.fecha,
      motivo: registro.descripcion,
    });
    return;
  }
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const nombre = `${persona.nombre || ""} ${persona.apellido || ""}`.trim();
  doc.addImage(FLY_KITCHEN_LOGO_PNG, "PNG", 16, 14, 42, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CONSTANCIA DE HISTORIAL DE PERSONAL", 105, 42, { align: "center" });
  doc.setDrawColor(40);
  doc.line(16, 48, 194, 48);
  const rows = [
    ["Tipo", clean(registro.tipo).replaceAll("_", " ").toUpperCase()],
    ["Fecha", clean(registro.fecha)],
    ["Persona", nombre || "—"],
    ["Legajo", clean(persona.legajo)],
    ["DNI", clean(persona.dni)],
    ["Registrado por", clean(registro.registrado_por)],
  ];
  let y = 60;
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${label}:`, 16, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 50, y);
    y += 8;
  });
  doc.setFont("helvetica", "bold");
  doc.text("Descripción:", 16, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(clean(registro.descripcion), 178), 16, y);
  doc.save(historialPersonalFilename(persona, registro));
}

export function textoHistorialPersonal(persona = {}, registro = {}) {
  const nombre = `${persona.nombre || ""} ${persona.apellido || ""}`.trim();
  return [
    `${clean(registro.tipo).replaceAll("_", " ").toUpperCase()} - ${nombre}`,
    `Fecha: ${clean(registro.fecha)}`,
    `Descripción: ${clean(registro.descripcion)}`,
    registro.dias_suspension
      ? `Días de suspensión: ${registro.dias_suspension}`
      : "",
    registro.registrado_por ? `Registrado por: ${registro.registrado_por}` : "",
    "Fly Gestión - documento de uso interno.",
  ]
    .filter(Boolean)
    .join("\n");
}
