import { useState, useEffect } from "react";
import { getTelefonosUtilesSede } from "../lib/queries";
import { Phone } from "lucide-react";

// Teléfonos útiles de una sede: responsables (auto) + contactos fijados (manual).
// Reutilizable en ficha de sede (desktop) y detalle mobile.
export default function TelefonosUtilesSede({ sedeId, compact = false }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!sedeId) return;
    getTelefonosUtilesSede(sedeId).then(setItems).catch(() => {});
  }, [sedeId]);

  if (!items.length) return null;
  const wa = (t) => window.open(`https://api.whatsapp.com/send?phone=${t}`, "_blank");
  const call = (t) => window.open(`tel:+${t}`, "_self");

  return (
    <div style={{ marginTop: compact ? 8 : 0 }}>
      <p style={{ color: "var(--text-dim)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px" }}>
        <Phone size={11} style={{ verticalAlign: -1, marginRight: 4, color: "var(--phosphor)" }} />
        Teléfonos útiles de la sede
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.5rem 0.65rem" }}>
            <span style={{ fontSize: "1.05rem", flexShrink: 0 }}>{c.icono}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "var(--text)", fontWeight: 700, fontSize: "0.76rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</p>
              <p style={{ color: "var(--text-dim)", fontSize: "0.62rem", margin: 0 }}>{c.rol}{c.telefono ? ` · ${c.telefono}` : ""}</p>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {c.tel && <button onClick={() => call(c.tel)} title="Llamar" style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.2)", color: "var(--phosphor)", cursor: "pointer" }}>📞</button>}
              {c.wa && <button onClick={() => wa(c.wa)} title="WhatsApp" style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.22)", color: "#25d366", cursor: "pointer" }}>💬</button>}
              {c.email && <button onClick={() => window.open(`mailto:${c.email}`, "_self")} title="Email" style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(80,180,255,0.08)", border: "1px solid rgba(80,180,255,0.22)", color: "#50b4ff", cursor: "pointer" }}>✉</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
