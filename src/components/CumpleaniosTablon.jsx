import { useEffect, useState } from "react";
import { Cake, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { proximosCumpleanios, telefonoWhatsApp } from "../lib/cumpleanios";

export default function CumpleaniosTablon({ mobile = false }) {
  const [cumpleanios, setCumpleanios] = useState([]);

  useEffect(() => {
    let activo = true;
    supabase.from("v_personas").select("id,nombre,apellido,fecha_nacimiento,telefono")
      .eq("activo", true).not("fecha_nacimiento", "is", null)
      .then(({ data, error }) => {
        if (activo && !error) setCumpleanios(proximosCumpleanios(data || []));
      });
    return () => { activo = false; };
  }, []);

  if (!cumpleanios.length) return null;

  const saludar = (persona) => {
    const telefono = telefonoWhatsApp(persona.telefono);
    if (!telefono) return;
    const texto = encodeURIComponent(`¡Feliz cumpleaños, ${persona.nombre || ""}! 🎂 Te deseamos un gran día. ¡Un abrazo de todo el equipo de Fly Kitchen!`);
    window.open(`https://wa.me/${telefono}?text=${texto}`, "_blank", "noopener,noreferrer");
  };

  return (
    <section style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.13), rgba(57,255,20,0.06))", border: "1px solid rgba(245,158,11,0.35)", borderRadius: mobile ? 10 : 3, padding: mobile ? "0.9rem" : "1rem 1.25rem", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Cake size={17} color="#F59E0B" /><strong style={{ color: "#F59E0B", fontSize: mobile ? "0.82rem" : "0.88rem" }}>Cumpleaños del equipo</strong>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cumpleanios.map((persona) => {
          const hoy = persona.dias_hasta === 0;
          const nombre = `${persona.nombre || ""} ${persona.apellido || ""}`.trim();
          const fecha = persona.fecha_cumpleanios.toLocaleDateString("es-AR", { day: "2-digit", month: "long" });
          return <div key={persona.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: "var(--text)", fontSize: mobile ? "0.76rem" : "0.8rem" }}>{hoy ? `🎉 Hoy cumple ${nombre}` : `${nombre} · ${fecha}`}</span>
            {hoy && persona.telefono && <button onClick={() => saludar(persona)} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, cursor: "pointer", padding: "0.3rem 0.55rem", borderRadius: 6, background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.4)", color: "#25D366", fontSize: "0.68rem", fontWeight: 700 }}><MessageCircle size={12} /> Saludar</button>}
          </div>;
        })}
      </div>
    </section>
  );
}
