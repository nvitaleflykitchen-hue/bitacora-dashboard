import { useState } from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import AdjuntosPanel from "../components/AdjuntosPanel";

// Vista de solo lectura para auditorías Finalizadas/Cerradas (aprobada 15/07).
// Orden de lectura: resultado → resumen → hallazgos → desvíos → cumplidos
// colapsados. El formulario guiado queda solo para Programada/En curso.

const VALOR_COLOR = {
  Cumple: "#39ff14",
  Parcial: "#f59e0b",
  "No cumple": "#ef4444",
  "No observado": "#94a3b8",
};
const CRITICIDAD_COLOR = {
  Alta: "#ef4444",
  Crítica: "#ef4444",
  Media: "#f59e0b",
  Baja: "#94a3b8",
};
const RESULTADO_COLOR = {
  Excelente: "#39ff14",
  Aceptable: "#39ff14",
  "A mejorar": "#f59e0b",
  Crítico: "#ef4444",
};

function ChipValor({ valor }) {
  const c = VALOR_COLOR[valor] || "#94a3b8";
  return (
    <span
      style={{
        background: `${c}20`,
        color: c,
        fontSize: "0.62rem",
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 3,
        whiteSpace: "nowrap",
        letterSpacing: "0.04em",
        alignSelf: "flex-start",
      }}
    >
      {valor?.toUpperCase() || "SIN RESPONDER"}
    </span>
  );
}

export default function AuditoriaInforme({
  audit,
  answers,
  score,
  scoreSummary,
  resultado,
}) {
  const [verCumplidos, setVerCumplidos] = useState(false);
  const secciones = audit.auditoria_plantillas?.auditoria_secciones || [];
  const hallazgos = audit.auditoria_hallazgos || [];

  const conDesvio = [];
  const cumplidos = [];
  secciones.forEach((s) =>
    (s.auditoria_preguntas || []).forEach((q) => {
      const a = answers[q.id] || {};
      const item = { seccion: s, pregunta: q, respuesta: a };
      if (a.valor === "Parcial" || a.valor === "No cumple") conDesvio.push(item);
      else cumplidos.push(item);
    }),
  );
  const noObservados = cumplidos.filter(
    (i) => i.respuesta.valor === "No observado",
  ).length;
  const resultadoColor = RESULTADO_COLOR[resultado] || "#a78bfa";

  const titulo = (texto) => (
    <p
      className="font-metric"
      style={{
        color: "var(--phosphor)",
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        margin: "0 0 8px",
      }}
    >
      {texto}
    </p>
  );

  return (
    <div className="space-y-5">
      {/* Resultado + KPIs */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          style={{
            background: `${resultadoColor}1c`,
            color: resultadoColor,
            border: `1px solid ${resultadoColor}55`,
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "6px 14px",
            borderRadius: 4,
            letterSpacing: "0.06em",
          }}
        >
          RESULTADO: {(resultado || "EN EVALUACIÓN").toUpperCase()}
        </span>
        <span
          className="font-metric"
          style={{ color: "var(--text-dim)", fontSize: "0.68rem" }}
        >
          {audit.estado} ·{" "}
          {audit.fecha_ejecucion || audit.fecha_programada || ""}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="glass rounded p-3">
          <p
            className="font-metric text-xs"
            style={{ color: "var(--text-dim)", margin: 0 }}
          >
            CUMPLIMIENTO
          </p>
          <p
            className="font-title font-bold"
            style={{ fontSize: "1.4rem", color: resultadoColor, margin: "2px 0 8px" }}
          >
            {score == null ? "—" : `${score}%`}
          </p>
          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              height: 4,
              borderRadius: 2,
            }}
          >
            <div
              style={{
                background: resultadoColor,
                width: `${score || 0}%`,
                height: 4,
                borderRadius: 2,
              }}
            />
          </div>
          <p
            className="font-metric"
            style={{ color: "var(--text-dim)", fontSize: "0.62rem", margin: "6px 0 0" }}
          >
            {scoreSummary.obtenido}/{scoreSummary.maximo} puntos
          </p>
        </div>
        <div className="glass rounded p-3">
          <p
            className="font-metric text-xs"
            style={{ color: "var(--text-dim)", margin: 0 }}
          >
            RESPUESTAS
          </p>
          <p style={{ fontSize: "0.78rem", margin: "8px 0 0", lineHeight: 1.7 }}>
            <span style={{ color: VALOR_COLOR.Cumple }}>
              {scoreSummary.cumple} cumple
            </span>{" "}
            ·{" "}
            <span style={{ color: VALOR_COLOR.Parcial }}>
              {scoreSummary.parcial} parcial
            </span>
            <br />
            <span style={{ color: VALOR_COLOR["No cumple"] }}>
              {scoreSummary.noCumple} no cumple
            </span>{" "}
            ·{" "}
            <span style={{ color: VALOR_COLOR["No observado"] }}>
              {scoreSummary.noObservado} n/o
            </span>
          </p>
        </div>
        <div className="glass rounded p-3">
          <p
            className="font-metric text-xs"
            style={{ color: "var(--text-dim)", margin: 0 }}
          >
            HALLAZGOS
          </p>
          <p
            className="font-title font-bold"
            style={{ fontSize: "1.4rem", margin: "2px 0 0" }}
          >
            {hallazgos.length}
          </p>
          <p
            className="font-metric"
            style={{ color: "#ef4444", fontSize: "0.62rem", margin: 0 }}
          >
            {hallazgos.filter((h) => ["Alta", "Crítica"].includes(h.criticidad)).length}{" "}
            críticos ·{" "}
            {hallazgos.filter((h) => h.criticidad === "Media").length} medios
          </p>
        </div>
      </div>

      {/* Resumen ejecutivo y conclusiones */}
      {(audit.resumen || audit.conclusiones) && (
        <div>
          {titulo("RESUMEN EJECUTIVO")}
          {audit.resumen && (
            <p
              style={{
                fontSize: "0.82rem",
                lineHeight: 1.7,
                borderLeft: "3px solid rgba(57,255,20,0.35)",
                paddingLeft: 12,
                margin: 0,
                whiteSpace: "pre-line",
              }}
            >
              {audit.resumen}
            </p>
          )}
          {audit.conclusiones && (
            <>
              <p
                className="font-metric"
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  margin: "14px 0 6px",
                }}
              >
                CONCLUSIONES Y PRIORIDADES
              </p>
              <p
                style={{
                  fontSize: "0.82rem",
                  lineHeight: 1.7,
                  borderLeft: "3px solid rgba(167,139,250,0.4)",
                  paddingLeft: 12,
                  margin: 0,
                  whiteSpace: "pre-line",
                }}
              >
                {audit.conclusiones}
              </p>
            </>
          )}
        </div>
      )}

      {/* Hallazgos */}
      {hallazgos.length > 0 && (
        <div>
          {titulo(`HALLAZGOS (${hallazgos.length})`)}
          <div className="space-y-2">
            {hallazgos.map((h) => (
              <div
                key={h.id}
                className="glass"
                style={{
                  borderLeft: `3px solid ${CRITICIDAD_COLOR[h.criticidad] || "#94a3b8"}`,
                  padding: "10px 14px",
                }}
              >
                <p style={{ fontSize: "0.82rem", fontWeight: 600, margin: 0 }}>
                  #{h.numero} · {h.titulo}
                </p>
                <p
                  className="font-metric"
                  style={{
                    color: "var(--text-dim)",
                    fontSize: "0.66rem",
                    margin: "4px 0 0",
                  }}
                >
                  {h.tipo} · Criticidad {h.criticidad?.toLowerCase()} · {h.estado}
                  {h.no_conformidad_id ? " · NC generada" : ""}
                  {h.capa_id ? " · CAPA generada" : ""}
                </p>
                {h.descripcion && (
                  <p style={{ fontSize: "0.76rem", margin: "6px 0 0", lineHeight: 1.6 }}>
                    {h.descripcion}
                  </p>
                )}
                {h.accion_propuesta && (
                  <p
                    style={{
                      fontSize: "0.74rem",
                      margin: "4px 0 0",
                      color: "var(--text-dim)",
                    }}
                  >
                    Acción: {h.accion_propuesta}
                  </p>
                )}
                <div className="mt-2">
                  <AdjuntosPanel
                    entityType="auditoria_hallazgo"
                    entityId={h.id}
                    compact
                    readOnly
                    label="Evidencia"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desvíos punto por punto */}
      <div>
        {titulo(`DESVÍOS POR PUNTO (${conDesvio.length})`)}
        {conDesvio.length === 0 && (
          <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
            Sin desvíos: todos los puntos evaluados cumplen.
          </p>
        )}
        <div className="space-y-2">
          {conDesvio.map(({ seccion, pregunta, respuesta }) => (
            <div key={pregunta.id} className="glass rounded" style={{ padding: "12px 14px" }}>
              <div className="flex justify-between gap-3">
                <p style={{ fontSize: "0.8rem", margin: 0, flex: 1, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--text-dim)" }}>
                    {seccion.codigo}.
                  </span>{" "}
                  {pregunta.codigo} {pregunta.pregunta}
                  {pregunta.requisito_critico && (
                    <span style={{ color: "#ef4444" }}> · CRÍTICO</span>
                  )}
                </p>
                <ChipValor valor={respuesta.valor} />
              </div>
              {respuesta.observacion && (
                <p
                  style={{
                    fontSize: "0.76rem",
                    color: "var(--text-dim)",
                    fontStyle: "italic",
                    lineHeight: 1.6,
                    margin: "8px 0 0",
                  }}
                >
                  “{respuesta.observacion}”
                </p>
              )}
              <div className="mt-2">
                <AdjuntosPanel
                  entityType="auditoria_respuesta_evidencia"
                  entityId={`${audit.id}:${pregunta.id}`}
                  compact
                  readOnly
                  label="Evidencias del punto"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cumplidos colapsados */}
      <button
        onClick={() => setVerCumplidos((v) => !v)}
        style={{
          width: "100%",
          background: "rgba(57,255,20,0.05)",
          border: "1px solid rgba(57,255,20,0.15)",
          color: "var(--phosphor)",
          fontSize: "0.74rem",
          padding: "12px 14px",
          borderRadius: 6,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} />
          {cumplidos.length - noObservados} puntos en cumplimiento
          {noObservados > 0 ? ` y ${noObservados} no observados` : ""}
        </span>
        {verCumplidos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {verCumplidos && (
        <div className="space-y-1">
          {cumplidos.map(({ seccion, pregunta, respuesta }) => (
            <div
              key={pregunta.id}
              className="flex justify-between gap-3 py-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p
                style={{
                  fontSize: "0.74rem",
                  margin: 0,
                  flex: 1,
                  color: "var(--text-dim)",
                }}
              >
                <span>{seccion.codigo}.</span> {pregunta.codigo}{" "}
                {pregunta.pregunta}
              </p>
              <ChipValor valor={respuesta.valor} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
