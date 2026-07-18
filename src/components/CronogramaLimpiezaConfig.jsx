import { useState, useEffect, useCallback } from "react";
import { getCronogramaLimpieza, updateCronogramaItem } from "../lib/queries";
import { useAuth } from "../lib/auth";
import { toast } from "../lib/feedback";
import { mensajeError } from "../lib/errores";
import { CalendarClock, ChevronDown, ChevronUp } from "lucide-react";

// Config del cronograma de limpieza (Etapa 3): reasignar el día de cada ítem
// semanal y el intervalo de los quincenales, sin tocar código.
const DIAS = [
  [1, "Lunes"], [2, "Martes"], [3, "Miércoles"],
  [4, "Jueves"], [5, "Viernes"], [6, "Sábado"], [7, "Domingo"],
];

export default function CronogramaLimpiezaConfig({ sedeId }) {
  const { can, rol } = useAuth();
  const puedeEditar = can?.("compras", "manage") || ["admin", "editor", "grupo", "encargado"].includes(rol);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(() => {
    if (!sedeId) return;
    setLoading(true);
    getCronogramaLimpieza(sedeId)
      .then(setItems)
      .catch((e) => toast.error(mensajeError(e)))
      .finally(() => setLoading(false));
  }, [sedeId]);

  useEffect(() => { load(); }, [load]);

  const cambiar = async (item, campo, valor) => {
    setSavingId(item.id);
    try {
      await updateCronogramaItem(item.id, { [campo]: valor });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, [campo]: valor } : i)));
      toast.ok("Cronograma actualizado.");
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (!loading && items.length === 0) return null;

  const semanales = items.filter((i) => i.frecuencia === "semanal");
  const quincenales = items.filter((i) => i.frecuencia === "quincenal");

  return (
    <div className="glass rounded" style={{ padding: "0.85rem 1rem", marginBottom: "1rem" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarClock size={15} style={{ color: "var(--phosphor)" }} />
          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Cronograma de limpieza · día asignado por ítem</span>
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {loading ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>Cargando...</p>
          ) : (
            <>
              <p style={{ color: "var(--text-dim)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", margin: "0 0 6px" }}>SEMANAL — DÍA FIJO</p>
              {semanales.map((it) => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <span style={{ fontSize: "0.74rem", color: "var(--text)", flex: 1 }}>{it.item_texto}</span>
                  <select
                    className="input-dark"
                    disabled={!puedeEditar || savingId === it.id}
                    value={it.dia_semana || ""}
                    onChange={(e) => cambiar(it, "dia_semana", Number(e.target.value))}
                    style={{ fontSize: "0.72rem", width: 120 }}
                  >
                    {DIAS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
                  </select>
                </div>
              ))}

              {quincenales.length > 0 && (
                <>
                  <p style={{ color: "var(--text-dim)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", margin: "12px 0 6px" }}>QUINCENAL — CADA N DÍAS</p>
                  {quincenales.map((it) => (
                    <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <span style={{ fontSize: "0.74rem", color: "var(--text)", flex: 1 }}>{it.item_texto}</span>
                      <input
                        type="number" min={1} className="input-dark"
                        disabled={!puedeEditar || savingId === it.id}
                        value={it.intervalo_dias || 14}
                        onChange={(e) => cambiar(it, "intervalo_dias", Number(e.target.value))}
                        style={{ fontSize: "0.72rem", width: 70 }}
                      />
                    </div>
                  ))}
                </>
              )}
              {!puedeEditar && (
                <p style={{ color: "var(--text-dim)", fontSize: "0.65rem", marginTop: 8 }}>Solo lectura — no tenés permiso para editar el cronograma.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
