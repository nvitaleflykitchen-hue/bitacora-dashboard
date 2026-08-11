import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Pencil, Save, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { mensajeError } from "../lib/errores";
import { toast } from "../lib/feedback";

const emptyForm = {
  sede_id: "",
  rol_operativo_id: "",
  nuevo_rol: "",
  puesto_cct_id: "",
  funcion_real: "",
  supervisor_persona_id: "",
  modalidad: "",
  jornada: "",
  fecha_desde: new Date().toISOString().slice(0, 10),
};

function valueOrNull(value) {
  return typeof value === "string" ? value.trim() || null : value || null;
}

export default function PersonaEncuadrePanel({ persona, personas = [], sedes = [], canManage = false, onChanged }) {
  const { user, perfil } = useAuth();
  const [encuadre, setEncuadre] = useState(null);
  const [puestos, setPuestos] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [encRes, puestosRes, rolesRes] = await Promise.all([
      supabase.schema("equipo").from("persona_encuadres").select("*")
        .eq("persona_id", persona.id).is("fecha_hasta", null).eq("es_principal", true).maybeSingle(),
      supabase.schema("equipo").from("puestos_cct").select("id,codigo,nombre,nivel,area,activo,convenio_cct")
        .eq("activo", true).order("nivel").order("nombre"),
      supabase.schema("equipo").from("roles_operativos").select("id,codigo,nombre,area,sede_id,activo")
        .eq("activo", true).order("nombre"),
    ]);
    setEncuadre(encRes.data || null);
    setPuestos(puestosRes.data || []);
    setRoles(rolesRes.data || []);
  };

  useEffect(() => { load(); }, [persona.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const puesto = puestos.find((item) => item.id === encuadre?.puesto_cct_id);
  const rol = roles.find((item) => item.id === encuadre?.rol_operativo_id);
  const supervisor = personas.find((item) => item.id === encuadre?.supervisor_persona_id);
  const sede = sedes.find((item) => item.id === encuadre?.sede_id);
  const rolesDisponibles = useMemo(() => roles.filter((item) => !item.sede_id || item.sede_id === Number(form.sede_id)), [roles, form.sede_id]);
  const convenioSede = sedes.find((item) => item.id === Number(form.sede_id))?.convenio_cct;
  const puestosDisponibles = useMemo(() => convenioSede ? puestos.filter((item) => item.convenio_cct === convenioSede) : [], [puestos, convenioSede]);

  const openEditor = () => {
    setForm({
      ...emptyForm,
      sede_id: encuadre?.sede_id || persona.sede_ids?.[0] || "",
      rol_operativo_id: encuadre?.rol_operativo_id || "",
      puesto_cct_id: encuadre?.puesto_cct_id || "",
      funcion_real: encuadre?.funcion_real || "",
      supervisor_persona_id: encuadre?.supervisor_persona_id || "",
      modalidad: encuadre?.modalidad || "",
      jornada: encuadre?.jornada || "",
      fecha_desde: encuadre?.fecha_desde || emptyForm.fecha_desde,
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.sede_id) return toast.warn("Seleccioná la sede del encuadre.");
    if (!convenioSede) return toast.warn("Primero definí el convenio aplicable en la ficha de la sede.");
    if (form.puesto_cct_id && !puestosDisponibles.some((item) => item.id === form.puesto_cct_id)) return toast.warn(`El puesto seleccionado no pertenece al CCT ${convenioSede}. Elegí una categoría válida.`);
    if (!form.rol_operativo_id && !form.nuevo_rol.trim() && !form.puesto_cct_id && !form.funcion_real.trim()) {
      return toast.warn("Indicá al menos el rol, el puesto CCT o la función real.");
    }
    setSaving(true);
    try {
      let rolId = valueOrNull(form.rol_operativo_id);
      if (!rolId && form.nuevo_rol.trim()) {
        if (perfil?.rol !== "admin") throw new Error("Solo administración puede crear nuevos roles Fly.");
        const codigo = `FLY-${form.nuevo_rol.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
        const roleResult = await supabase.schema("equipo").from("roles_operativos")
          .insert({ codigo, nombre: form.nuevo_rol.trim(), sede_id: Number(form.sede_id), created_by: user?.id || null })
          .select("id").single();
        if (roleResult.error) throw roleResult.error;
        rolId = roleResult.data.id;
      }
      const payload = {
        persona_id: persona.id,
        sede_id: Number(form.sede_id),
        rol_operativo_id: rolId,
        puesto_cct_id: valueOrNull(form.puesto_cct_id),
        funcion_real: valueOrNull(form.funcion_real),
        supervisor_persona_id: valueOrNull(form.supervisor_persona_id),
        modalidad: valueOrNull(form.modalidad),
        jornada: valueOrNull(form.jornada),
        fecha_desde: form.fecha_desde,
        es_principal: true,
        updated_by: user?.id || null,
      };
      const result = encuadre
        ? await supabase.schema("equipo").from("persona_encuadres").update(payload).eq("id", encuadre.id)
        : await supabase.schema("equipo").from("persona_encuadres").insert({ ...payload, created_by: user?.id || null });
      if (result.error) throw result.error;
      toast.ok("Encuadre operativo actualizado.");
      setEditing(false);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(`No se pudo guardar el encuadre: ${mensajeError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass p-4" style={{ borderColor: "rgba(57,255,20,.16)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness size={15} style={{ color: "var(--phosphor)" }} />
          <div><p className="font-metric" style={{ color: "var(--phosphor)", fontSize: ".68rem" }}>ENCUADRE OPERATIVO</p><p style={{ color: "var(--text-dim)", fontSize: ".62rem" }}>Base común para dotación, horarios y coberturas</p></div>
        </div>
        {canManage && !editing && <button className="btn-ghost flex items-center gap-1" onClick={openEditor}><Pencil size={12} /> {encuadre ? "Editar" : "Completar"}</button>}
      </div>
      {!editing ? (
        encuadre ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[["Rol Fly", rol?.nombre], ["Categoría CCT", puesto ? `${puesto.nombre} · Nivel ${puesto.nivel}` : null], ["Función real", encuadre.funcion_real], ["Supervisor", supervisor ? `${supervisor.nombre} ${supervisor.apellido || ""}` : null], ["Sede", sede?.nombre], ["Modalidad", encuadre.modalidad], ["Jornada", encuadre.jornada], ["Vigente desde", encuadre.fecha_desde]].map(([label, value]) => value ? <div key={label}><p style={{ color: "var(--text-dim)", fontSize: ".58rem" }}>{label.toUpperCase()}</p><p style={{ color: "var(--text)", fontSize: ".76rem" }}>{value}</p></div> : null)}
        </div> : <p style={{ color: "var(--text-dim)", fontSize: ".74rem" }}>Todavía no se cargó el rol, la categoría ni la función real. No se infirió información desde el puesto libre existente.</p>
      ) : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select className="input-dark" value={form.sede_id} onChange={(e) => setForm((f) => ({ ...f, sede_id: e.target.value, rol_operativo_id: "", puesto_cct_id: "" }))}><option value="">Sede...</option>{sedes.map((item) => <option key={item.id} value={item.id}>{item.nombre}{item.convenio_cct ? ` · CCT ${item.convenio_cct}` : " · convenio sin definir"}</option>)}</select>
        <select className="input-dark" value={form.rol_operativo_id} onChange={(e) => setForm((f) => ({ ...f, rol_operativo_id: e.target.value, nuevo_rol: "" }))}><option value="">Rol operativo Fly...</option>{rolesDisponibles.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        {perfil?.rol === "admin" && <input className="input-dark" value={form.nuevo_rol} onChange={(e) => setForm((f) => ({ ...f, nuevo_rol: e.target.value, rol_operativo_id: "" }))} placeholder="O crear nuevo rol Fly" />}
        <select className="input-dark" disabled={!convenioSede} value={form.puesto_cct_id} onChange={(e) => setForm((f) => ({ ...f, puesto_cct_id: e.target.value }))}><option value="">{convenioSede ? `Puesto CCT ${convenioSede} sin confirmar...` : "Definí el convenio en la sede..."}</option>{puestosDisponibles.map((item) => <option key={item.id} value={item.id}>Categoría {item.nivel} · {item.nombre}</option>)}</select>
        <input className="input-dark" value={form.funcion_real} onChange={(e) => setForm((f) => ({ ...f, funcion_real: e.target.value }))} placeholder="Función real" />
        <select className="input-dark" value={form.supervisor_persona_id} onChange={(e) => setForm((f) => ({ ...f, supervisor_persona_id: e.target.value }))}><option value="">Supervisor directo...</option>{personas.filter((item) => item.id !== persona.id).map((item) => <option key={item.id} value={item.id}>{item.nombre} {item.apellido || ""}</option>)}</select>
        <input className="input-dark" value={form.modalidad} onChange={(e) => setForm((f) => ({ ...f, modalidad: e.target.value }))} placeholder="Modalidad (ej. efectiva/o)" />
        <input className="input-dark" value={form.jornada} onChange={(e) => setForm((f) => ({ ...f, jornada: e.target.value }))} placeholder="Jornada (sin turno ni horario)" />
        <input type="date" className="input-dark" value={form.fecha_desde} onChange={(e) => setForm((f) => ({ ...f, fecha_desde: e.target.value }))} />
        <div className="flex gap-2"><button className="btn-primary flex items-center gap-1" disabled={saving} onClick={save}><Save size={12} /> {saving ? "Guardando..." : "Guardar"}</button><button className="btn-ghost flex items-center gap-1" onClick={() => setEditing(false)}><X size={12} /> Cancelar</button></div>
      </div>}
    </div>
  );
}
