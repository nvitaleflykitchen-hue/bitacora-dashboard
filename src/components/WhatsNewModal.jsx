import { X } from "lucide-react";
import { LATEST_RELEASE, markLatestReleaseSeen } from "../data/releases";
import { ReleaseCard } from "./ReleaseNotes";

export default function WhatsNewModal({ userId, onClose, onOpenAll }) {
  const close = () => {
    markLatestReleaseSeen(userId);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 100,
        padding: "clamp(0.5rem, 2vw, 1rem)",
        overflow: "hidden",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div
        style={{
          width: "min(680px, 100%)",
          height: "min(760px, calc(100dvh - 2rem))",
          maxHeight: "calc(100dvh - 1rem)",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          overflow: "hidden",
          background: "var(--bg)",
          border: "1px solid rgba(57,255,20,0.2)",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div>
            <p
              className="font-metric"
              style={{
                color: "var(--phosphor)",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
              }}
            >
              NUEVA ACTUALIZACIÓN
            </p>
            <h1
              id="whats-new-title"
              style={{
                color: "var(--text)",
                fontSize: "1.25rem",
                fontWeight: 800,
              }}
            >
              Qué hay de nuevo
            </h1>
          </div>
          <button
            type="button"
            onClick={close}
            className="btn-ghost"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div
          style={{
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            padding: "1rem",
          }}
        >
          <ReleaseCard release={LATEST_RELEASE} compact />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: 8,
            padding: "0.8rem 1rem",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "var(--bg)",
          }}
        >
          {onOpenAll && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                close();
                onOpenAll();
              }}
            >
              Ver todas
            </button>
          )}
          <button type="button" className="btn-primary" onClick={close}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
