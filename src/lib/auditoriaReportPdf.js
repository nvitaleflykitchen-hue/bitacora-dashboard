import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { getAdjuntos } from "./adjuntos";

const COLORS = {
  green: [16, 122, 54],
  gray: [95, 95, 95],
  light: [238, 238, 238],
  red: [190, 35, 35],
  amber: [190, 115, 15],
};
const clean = (value) => String(value ?? "—").replace(/[–—]/g, "-");

export async function generarInformeAuditoriaPDF(auditoria) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(),
    H = doc.internal.pageSize.getHeight(),
    mx = 15,
    cw = W - 30;
  let y = 17;
  const footer = () => {
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(`Fly Gestión - ${clean(auditoria.codigo)}`, mx, H - 9);
    doc.text(`Página ${doc.internal.getNumberOfPages()}`, W - mx, H - 9, {
      align: "right",
    });
  };
  const page = (need) => {
    if (y + need > H - 18) {
      footer();
      doc.addPage();
      y = 17;
    }
  };
  const heading = (text) => {
    page(14);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(25);
    doc.text(clean(text), mx, y);
    y += 2;
    doc.setDrawColor(...COLORS.green);
    doc.line(mx, y, W - mx, y);
    y += 6;
  };
  const paragraph = (text) => {
    if (!text) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(45);
    const lines = doc.splitTextToSize(clean(text), cw);
    page(lines.length * 4 + 2);
    doc.text(lines, mx, y);
    y += lines.length * 4 + 2;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text("INFORME DE AUDITORÍA INTERNA", W / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.green);
  doc.text(clean(auditoria.codigo), W / 2, y, { align: "center" });
  y += 9;
  const info = [
    ["Sede", auditoria.sedes?.nombre],
    ["Tipo", auditoria.tipo_auditoria],
    ["Estado", auditoria.estado],
    [
      "Fecha",
      auditoria.fecha_programada
        ? format(
            new Date(`${auditoria.fecha_programada}T12:00:00`),
            "dd/MM/yyyy",
          )
        : "—",
    ],
    ["Auditor", auditoria.auditor_nombre],
    ["Resultado", auditoria.resultado],
    [
      "Cumplimiento",
      auditoria.porcentaje_cumplimiento == null
        ? "—"
        : `${auditoria.porcentaje_cumplimiento}%`,
    ],
    ["Normativa", auditoria.normativa],
  ];
  doc.setFontSize(8.5);
  info.forEach(([label, value], i) => {
    const col = i % 2,
      row = Math.floor(i / 2),
      x = mx + (col * cw) / 2,
      yy = y + row * 7;
    doc.setFillColor(...COLORS.light);
    doc.rect(x, yy - 4, cw / 2 - 1, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    doc.text(label, x + 2, yy);
    doc.setFont("helvetica", "normal");
    doc.text(
      doc.splitTextToSize(clean(value), cw / 2 - 30)[0] || "—",
      x + 29,
      yy,
    );
  });
  y += Math.ceil(info.length / 2) * 7 + 3;
  const respuestas = auditoria.auditoria_respuestas || [];
  const conteo = respuestas.reduce((acc, r) => {
    const valor = r.valor || "Sin responder";
    acc[valor] = (acc[valor] || 0) + 1;
    return acc;
  }, {});
  heading("Resultado y puntuación");
  paragraph(
    `Puntaje general: ${auditoria.porcentaje_cumplimiento == null ? "Sin calcular" : `${auditoria.porcentaje_cumplimiento}%`} | Resultado: ${auditoria.resultado || "En evaluación"} | Cumple: ${conteo.Cumple || 0} | Parcial: ${conteo.Parcial || 0} | No cumple: ${conteo["No cumple"] || 0} | No observado: ${conteo["No observado"] || 0}`,
  );
  if (auditoria.objetivo) {
    heading("Objetivo");
    paragraph(auditoria.objetivo);
  }
  if (auditoria.alcance) {
    heading("Alcance");
    paragraph(auditoria.alcance);
  }

  const sections = auditoria.auditoria_plantillas?.auditoria_secciones || [];
  const byQuestion = new Map(
    (auditoria.auditoria_respuestas || []).map((r) => [r.pregunta_id, r]),
  );
  heading("Lista de verificación");
  sections.forEach((section) => {
    page(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.green);
    doc.text(`${section.codigo}. ${clean(section.nombre)}`, mx, y);
    y += 5;
    (section.auditoria_preguntas || []).forEach((q) => {
      const r = byQuestion.get(q.id),
        status = r?.valor || "Sin responder";
      const color =
        status === "No cumple"
          ? COLORS.red
          : status === "Parcial"
            ? COLORS.amber
            : COLORS.gray;
      const lines = doc.splitTextToSize(
        `${q.codigo} ${clean(q.pregunta)}`,
        cw - 38,
      );
      page(Math.max(lines.length * 3.6, 5) + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(40);
      doc.text(lines, mx, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...color);
      doc.text(status, W - mx, y, { align: "right" });
      y += Math.max(lines.length * 3.6, 5);
      if (r?.observacion) {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100);
        const ol = doc.splitTextToSize(clean(r.observacion), cw - 6);
        page(ol.length * 3.2);
        doc.text(ol, mx + 4, y);
        y += ol.length * 3.2;
      }
      y += 2;
    });
  });

  heading("Hallazgos y plan de acción");
  for (const h of auditoria.auditoria_hallazgos || []) {
    page(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(
      ...(h.criticidad === "Crítica"
        ? COLORS.red
        : h.criticidad === "Alta"
          ? COLORS.amber
          : COLORS.green),
    );
    doc.text(`${h.numero}. ${clean(h.titulo)} - ${h.criticidad}`, mx, y);
    y += 5;
    paragraph(h.descripcion);
    if (h.contencion_inmediata)
      paragraph(`Contención: ${h.contencion_inmediata}`);
    if (h.accion_propuesta) paragraph(`Acción: ${h.accion_propuesta}`);
    paragraph(
      `Responsable: ${h.responsable_nombre || "—"} | Fecha límite: ${h.fecha_limite || "—"} | Estado: ${h.estado}`,
    );
    const files = await getAdjuntos("auditoria_hallazgo", h.id).catch(() => []);
    if (files.length)
      paragraph(
        `Evidencias adjuntas: ${files.map((f) => f.nombre).join(", ")}`,
      );
    y += 3;
  }
  if (auditoria.resumen) {
    heading("Resumen ejecutivo");
    paragraph(auditoria.resumen);
  }
  if (auditoria.conclusiones) {
    heading("Conclusiones");
    paragraph(auditoria.conclusiones);
  }
  footer();
  doc.save(
    `${auditoria.codigo || "auditoria"}-${(auditoria.sedes?.nombre || "sede").replace(/\s+/g, "_")}.pdf`,
  );
}
