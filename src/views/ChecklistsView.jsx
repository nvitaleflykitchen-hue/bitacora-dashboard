import { useState, useEffect, useMemo, useCallback } from "react";
import { getChecklists, getSedes } from "../lib/queries";
import { useAuth } from "../lib/auth";
import { toast } from "../lib/feedback";
import { mensajeError } from "../lib/errores";
import SkeletonTable from "../components/SkeletonTable";
import EmptyState from "../components/EmptyState";
import { ClipboardCheck, ChevronDown, ChevronUp, Check, X, Minus } from "lucide-react";

// Vista de checklists enviados (encargados/operarios) para supervisión.
// KPIs arriba + lista por fecha con detalle de ítems expandible.

const hoyISO = () => new Date().toISOString().slice(0, 10);
const dISO = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

function pctColor(p) {
  if (p >= 90) return "#39ff14";
  if (p >= 70) return "#f59e0b";
  return "#ef4444";
}

function itemsResumen(items) {
  const vals = Object.values(items || {});
  let ok = 0, no = 0, na = 0;
  vals.forEach((v) => {
    if (v === true || v === "cumplido") ok++;
    else if (v === "no_cumplido" || v === false) no++;
    else if (v === "no_aplica") na++;
  });
  return { ok, no, na, total: vals.length };
}

function ChecklistCard({ c }) {
  const [open, setOpen] = useState(false);
  const r = itemsResumen(c.items);
  const aplic = r.total - r.na;
  const pct = aplic > 0 ? Math.round((r.ok / aplic) * 100) : c.items_total ? Math.round((c.items_ok / c.items_total) * 100) : 0;
  const col = pctColor(pct);
  return (
    <div className="glass rounded" style={{ padding: "12px 14px", borderLeft: `3px solid ${col}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit" }}
      >
        <div className="flex justify-between items-start gap-3">
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>
              {c.sede_nombre || `Sede ${c.sede_id}`}
            </p>
            <p className="font-metric" style={{ color: "var(--text-dim)", fontSize: "0.66rem", margin: "3px 0 0" }}>
              {c.fecha} · {c.turno || c.tipo} · {c.operador_nombre || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: col, fontSize: "1rem", fontWeight: 700 }}>{pct}%</span>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
          <div className="flex gap-3 mb-2" style={{ fontSize: "0.68rem" }}>
            <span style={{ color: "#39ff14" }}>{r.ok} cumplido</span>
            <span style={{ color: "#ef4444" }}>{r.no} no cumplido</span>
            {r.na > 0 && <span style={{ color: "#94a3b8" }}>{r.na} n/a</span>}
          </div>
          {Object.entries(c.items || {}).map(([k, v]) => {
            const ok = v === true || v === "cumplido";
            const na = v === "no_aplica";
            const Icon = na ? Minus : ok ? Check : X;
            const color = na ? "#94a3b8" : ok ? "#39ff14" : "#ef4444";
            return (
              <div key={k} className="flex items-center gap-2 py-1" style={{ fontSize: "0.74rem" }}>
                <Icon size={12} style={{ color, flexShrink: 0 }} />
                <span style={{ color: "var(--text-dim)" }}>{k}</span>
              </div>
            );
          })}
          {c.observaciones && (
            <p style={{ fontSize: "0.74rem", fontStyle: "italic", color: "var(--text-dim)", margin: "8px 0 0", lineHeight: 1.5 }}>
              “{c.observaciones}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChecklistsView() {
  const { allowedSedeIds } = useAuth();
  const [rows, setRows] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sedeId, setSedeId] = useState("");
  const [periodo, setPeriodo] = useState(30);

  const load = useCallback(() => {
    setLoading(true);
    getChecklists({
      sedeIds: allowedSedeIds || undefined,
      sedeId: sedeId ? Number(sedeId) : undefined,
      fechaDesde: dISO(periodo),
    })
      .then(setRows)
      .catch((e) => toast.error(mensajeError(e)))
      .finally(() => setLoading(false));
  }, [allowedSedeIds, sedeId, periodo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getSedes(allowedSedeIds).then(setSedes).catch(() => {}); }, [allowedSedeIds]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const hoy = rows.filter((c) => c.fecha === hoyISO()).length;
    const pcts = rows.map((c) => {
      const r = itemsResumen(c.items);
      const aplic = r.total - r.na;
      return aplic > 0 ? (r.ok / aplic) * 100 : c.items_total ? (c.items_ok / c.items_total) * 100 : 0;
    });
    const prom = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    const conDesvio = rows.filter((c) => itemsResumen(c.items).no > 0).length;
    return { total, hoy, prom, conDesvio };
  }, [rows]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 fade-in">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center">
          <select className="input-dark" style={{ fontSize: "0.8rem" }} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Todas las sedes</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select className="input-dark" style={{ fontSize: "0.8rem" }} value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Enviados", kpis.total, "var(--phosphor)"],
            ["Hoy", kpis.hoy, "var(--text)"],
            ["Cumplimiento prom.", `${kpis.prom}%`, pctColor(kpis.prom)],
            ["Con desvíos", kpis.conDesvio, kpis.conDesvio > 0 ? "#f59e0b" : "var(--text)"],
          ].map(([l, v, c]) => (
            <div key={l} className="kpi-card">
              <p className="kpi-value" style={{ color: c }}>{v}</p>
              <p className="kpi-label">{l}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <SkeletonTable filas={6} columnas={2} />
      ) : rows.length === 0 ? (
        <EmptyState icono={ClipboardCheck} titulo="Sin checklists en el período" detalle="Los checklists enviados desde la app móvil aparecen acá para supervisión." />
      ) : (
        <div className="space-y-2">
          {rows.map((c) => <ChecklistCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
