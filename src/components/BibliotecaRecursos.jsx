import { BookOpen, Bot, Download, ExternalLink, FileText } from "lucide-react";
import { RECURSOS_BIBLIOTECA } from "../data/recursosBiblioteca";

const TIPO_COLOR = {
  PDF: "#ff6b6b",
  DOCX: "#50b4ff",
  NOTEBOOKLM: "#8b7cff",
};

export default function BibliotecaRecursos({
  compact = false,
  categoria = null,
}) {
  const recursos = categoria
    ? RECURSOS_BIBLIOTECA.filter((recurso) => recurso.categoria === categoria)
    : RECURSOS_BIBLIOTECA;

  return (
    <section>
      {!compact && (
        <div className="glass p-5 mb-4">
          <div className="flex items-center gap-3">
            <BookOpen size={22} style={{ color: "var(--phosphor)" }} />
            <div>
              <h2
                className="font-title font-bold"
                style={{ color: "var(--text)", fontSize: "1rem" }}
              >
                Biblioteca de recursos
              </h2>
              <p
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.72rem",
                  marginTop: 3,
                }}
              >
                Documentos vigentes, instructivos y asistentes para trabajar con
                criterios comunes.
              </p>
            </div>
          </div>
        </div>
      )}
      <div
        className={compact ? "grid grid-cols-1 md:grid-cols-3 gap-2" : "grid grid-cols-1 lg:grid-cols-3 gap-4"}
      >
        {recursos.map((recurso) => {
          const Icon = recurso.tipo === "NOTEBOOKLM" ? Bot : FileText;
          const color = TIPO_COLOR[recurso.tipo] || "var(--phosphor)";
          return (
            <article
              key={recurso.id}
              className="glass"
              style={{
                padding: compact ? 12 : 18,
                border: `1px solid ${color}33`,
                minWidth: 0,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  style={{
                    width: compact ? 32 : 40,
                    height: compact ? 32 : 40,
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                    background: `${color}15`,
                    color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={compact ? 16 : 20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-metric"
                    style={{
                      fontSize: "0.56rem",
                      color,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {recurso.tipo} · {recurso.codigo}
                  </p>
                  <h3
                    className="font-title font-bold"
                    style={{
                      color: "var(--text)",
                      fontSize: compact ? "0.75rem" : "0.88rem",
                      marginTop: 4,
                    }}
                  >
                    {recurso.titulo}
                  </h3>
                  {!compact && (
                    <>
                      <p
                        style={{
                          color: "var(--text-dim)",
                          fontSize: "0.7rem",
                          lineHeight: 1.55,
                          marginTop: 8,
                        }}
                      >
                        {recurso.descripcion}
                      </p>
                      <p
                        className="font-metric"
                        style={{
                          color: "var(--text-dim)",
                          fontSize: "0.56rem",
                          marginTop: 10,
                        }}
                      >
                        VERSIÓN {recurso.version} · VIGENTE {recurso.vigencia}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2" style={{ marginTop: compact ? 10 : 14 }}>
                <a
                  href={recurso.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost flex items-center gap-1.5"
                  style={{ fontSize: "0.62rem", color }}
                >
                  {recurso.externo ? <ExternalLink size={12} /> : <BookOpen size={12} />}
                  {recurso.externo
                    ? "Abrir asistente"
                    : recurso.tipo === "DOCX"
                      ? "Abrir documento"
                      : "Leer"}
                </a>
                {recurso.descarga && (
                  <a
                    href={recurso.descarga}
                    download
                    className="btn-ghost flex items-center gap-1.5"
                    style={{ fontSize: "0.62rem" }}
                  >
                    <Download size={12} /> DOCX
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
