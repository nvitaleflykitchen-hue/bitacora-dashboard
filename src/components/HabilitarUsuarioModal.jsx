import { useState } from "react";
import { CheckCircle2, MessageCircle, UserPlus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/feedback";
import { whatsappDigits } from "../lib/phoneUtils";

const ROLES = [
  ["operario", "Operario"], ["sede", "Usuario de sede"],
  ["encargado", "Encargado"], ["consultor", "Consultor"],
  ["grupo", "Responsable de grupo"], ["editor", "Editor"],
  ["flota", "Flota"], ["mnt_editor", "Gestión Mantenimiento"],
];

export default function HabilitarUsuarioModal({ persona, onClose, onCreated }) {
  const [rol, setRol] = useState("operario");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const nombre = [persona?.nombre, persona?.apellido].filter(Boolean).join(" ");
  const email = String(persona?.email || "").trim().toLowerCase();
  const whatsapp = whatsappDigits(persona?.telefono);
  const bienvenida = created?.linked_existing
    ? `Hola ${nombre}! Ya tenés acceso a Fly Gestión.\n\nIngresá desde: https://bitacora-dashboard.vercel.app\nUsuario: ${email}`
    : `Hola ${nombre}! Te damos la bienvenida a Fly Gestión.\n\nIngresá desde: https://bitacora-dashboard.vercel.app\nUsuario: ${email}\nContraseña temporal: 123456\n\nEl sistema te pedirá cambiar la contraseña en el primer ingreso.`;
  const whatsappBienvenida = `https://wa.me/${whatsapp || ""}?text=${encodeURIComponent(bienvenida)}`;

  const habilitar = async () => {
    if (!email) return toast.warn("Completá el email en la ficha antes de habilitar el acceso.");
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("La sesión venció. Volvé a ingresar.");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          persona_id: persona.id,
          email,
          nombre,
          telefono: persona.telefono || null,
          rol,
        }),
      });
      const raw = await response.text();
      let result = {};
      try { result = raw ? JSON.parse(raw) : {}; } catch { /* respuesta no JSON */ }
      if (!response.ok) throw new Error(result.error || raw || "No se pudo habilitar el usuario.");
      setCreated(result.data || {});
      toast.ok(result.data?.linked_existing ? "La persona quedó vinculada a su usuario existente." : "Usuario habilitado correctamente.");
      onCreated?.();
    } catch (error) {
      toast.error(error.message || "No se pudo habilitar el usuario.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 80 }}>
      <div className="glass fade-in w-full max-w-md p-6" style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-title font-bold" style={{ color: "var(--text)" }}>Habilitar como usuario</p>
            <p className="font-metric mt-1" style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}>Acceso a Fly Gestión vinculado con este legajo</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar"><X size={14} /></button>
        </div>
        {created ? (
          <div className="text-center py-4">
            <CheckCircle2 size={30} className="mx-auto mb-3" style={{ color: "var(--phosphor)" }} />
            <p className="font-title font-bold">{created.linked_existing ? "Usuario vinculado" : "Usuario creado"}</p>
            <p className="font-metric mt-2" style={{ color: "var(--text-dim)", fontSize: "0.68rem" }}>{email}</p>
            {!created.linked_existing && <p className="font-metric mt-4 p-3" style={{ color: "var(--text)", fontSize: "0.68rem", background: "rgba(57,255,20,0.06)" }}>Contraseña temporal: <strong>123456</strong>. Deberá cambiarla en el primer ingreso.</p>}
            <div className="flex flex-col gap-2 mt-5">
              <a
                href={whatsappBienvenida}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex items-center justify-center gap-2"
                style={{ textDecoration: "none" }}
                title={whatsapp ? `Enviar bienvenida a ${persona.telefono}` : "Elegir contacto en WhatsApp"}
              >
                <MessageCircle size={14} /> Enviar bienvenida por WhatsApp
              </a>
              {!whatsapp && <p className="font-metric" style={{ color: "#f59e0b", fontSize: "0.6rem" }}>El legajo no tiene un teléfono válido; WhatsApp te permitirá elegir el contacto.</p>}
              <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
            </div>
          </div>
        ) : <>
          <div className="p-3 mb-4" style={{ border: "1px solid rgba(57,255,20,0.15)", background: "rgba(57,255,20,0.04)" }}>
            <p className="font-title font-bold" style={{ fontSize: "0.82rem" }}>{nombre}</p>
            <p className="font-metric mt-1" style={{ color: email ? "var(--text-dim)" : "#f59e0b", fontSize: "0.66rem" }}>{email || "La ficha no tiene email cargado"}</p>
          </div>
          <label className="font-metric block mb-1" style={{ color: "var(--text-dim)", fontSize: "0.62rem" }}>TIPO DE ACCESO</label>
          <select className="input-dark w-full" value={rol} onChange={(event) => setRol(event.target.value)}>
            {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="font-metric mt-3" style={{ color: "var(--text-dim)", fontSize: "0.62rem", lineHeight: 1.5 }}>El alcance territorial se toma de la sede o grupo asignado en la ficha de la persona.</p>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn-primary flex items-center gap-2" disabled={loading || !email} onClick={habilitar}><UserPlus size={13} /> {loading ? "Habilitando..." : "Habilitar usuario"}</button>
          </div>
        </>}
      </div>
    </div>
  );
}
