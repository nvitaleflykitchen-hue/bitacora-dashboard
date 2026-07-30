import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck } from "lucide-react";
import { resumirCalidadEvaluaciones } from "../lib/evaluacionObjetividad";

const ESTADO = {
  requiere_revision: {
    label: "Requiere revisión",
    color: "#ff6b6b",
  },
  revisar: {
    label: "Revisar antes de validar",
    color: "#f59e0b",
  },
  lista_para_validar: {
    label: "Lista para validar",
    color: "#39FF14",
  },
};

export default function EvaluacionesAnalysisPanel({
  evaluaciones = [],
  personas = [],
  onOpenPersona,
  compact = false,
}) {
  const resumen = resumirCalidadEvaluaciones(evaluaciones);
  const personaById = new Map(personas.map((persona) => [String(persona.id), persona]));
  const pendientes = resumen.analizadas
    .filter(({ analisis }) => analisis.estado !== "lista_para_validar")
    .sort((a, b) => b.analisis.bloqueantes - a.analisis.bloqueantes);
  const evaluadas = new Set(evaluaciones.map((item) => String(item.persona_id))).size;
  const cobertura = personas.length
    ? Math.round((evaluadas / personas.length) * 100)
    : 0;

  return (
    <div className={compact ? "" : "max-w-6xl"}>
      <div
        className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 lg:grid-cols-5 gap-3"}
      >
        {[
          ["Cobertura", `${cobertura}%`, `${evaluadas} de ${personas.length} personas`, "#50b4ff"],
          ["Evaluaciones", resumen.total, "registros analizados", "var(--text)"],
          ["Requieren revisión", resumen.requierenRevision, "con controles bloqueantes", "#ff6b6b"],
          ["Con observaciones", resumen.conObservaciones, "mejorables antes de validar", "#f59e0b"],
          ["Listas para validar", resumen.listas, "sin alertas automáticas", "#39FF14"],
        ].map(([label, value, detail, color]) => (
          <div key={label} className="glass p-4">
            <p className="font-title font-bold" style={{ color, fontSize: "1.35rem" }}>
              {value}
            </p>
            <p
              className="font-metric"
              style={{ color: "var(--text)", fontSize: "0.62rem", marginTop: 2 }}
            >
              {label.toUpperCase()}
            </p>
            <p style={{ color: "var(--text-dim)", fontSize: "0.62rem", marginTop: 4 }}>
              {detail}
            </p>
          </div>
        ))}
      </div>

      {!compact && (
        <div
          className="glass p-4 mt-4"
          style={{ border: "1px solid rgba(80,180,255,0.22)" }}
        >
          <div className="flex items-start gap-3">
            <ClipboardCheck size={19} style={{ color: "#50b4ff", flexShrink: 0 }} />
            <div>
              <p className="font-title font-bold" style={{ color: "var(--text)" }}>
                Control de calidad, no ranking
              </p>
              <p
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.72rem",
                  lineHeight: 1.55,
                  marginTop: 4,
                }}
              >
                La app revisa consistencia, evidencia y seguimiento. No compara
                personas ni modifica puntajes automáticamente. La validación final
                continúa a cargo del responsable y Gestión de Personas.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <p
            className="font-metric"
            style={{ color: "var(--phosphor)", fontSize: "0.68rem" }}
          >
            EVALUACIONES PARA REVISAR
          </p>
          <span style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}>
            {pendientes.length} pendientes
          </span>
        </div>
        {pendientes.length === 0 ? (
          <div className="glass p-6 text-center">
            <CheckCircle2
              size={24}
              style={{ color: "#39FF14", margin: "0 auto 8px" }}
            />
            <p style={{ color: "var(--text)", fontSize: "0.78rem" }}>
              No hay evaluaciones con observaciones automáticas.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendientes.map(({ evaluacion, analisis }) => {
              const persona = personaById.get(String(evaluacion.persona_id));
              const estado = ESTADO[analisis.estado];
              return (
                <button
                  key={evaluacion.id}
                  type="button"
                  onClick={() => onOpenPersona?.(evaluacion.persona_id)}
                  className="glass w-full p-3 text-left flex items-start gap-3"
                  style={{ border: `1px solid ${estado.color}33` }}
                >
                  <AlertTriangle
                    size={16}
                    style={{ color: estado.color, flexShrink: 0, marginTop: 2 }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className="font-title font-bold"
                        style={{ color: "var(--text)", fontSize: "0.78rem" }}
                      >
                        {persona
                          ? `${persona.nombre} ${persona.apellido || ""}`.trim()
                          : "Persona no disponible"}
                      </p>
                      <span
                        className="font-metric"
                        style={{ color: estado.color, fontSize: "0.56rem" }}
                      >
                        {estado.label.toUpperCase()}
                      </span>
                    </div>
                    <p
                      style={{
                        color: "var(--text-dim)",
                        fontSize: "0.64rem",
                        marginTop: 3,
                      }}
                    >
                      {evaluacion.periodo || "Sin período"} ·{" "}
                      {evaluacion.evaluador_nombre || "Evaluador no identificado"}
                    </p>
                    <p
                      style={{
                        color: "var(--text)",
                        fontSize: "0.67rem",
                        marginTop: 6,
                      }}
                    >
                      {analisis.hallazgos
                        .slice(0, 2)
                        .map((hallazgo) => hallazgo.titulo)
                        .join(" · ")}
                      {analisis.hallazgos.length > 2
                        ? ` · +${analisis.hallazgos.length - 2} observaciones`
                        : ""}
                    </p>
                  </div>
                  <ChevronRight size={14} style={{ color: "var(--text-dim)" }} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
