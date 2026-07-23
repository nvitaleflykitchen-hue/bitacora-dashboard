import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  Users,
  Search,
  Plus,
  Trophy,
  Star,
  ChevronRight,
  Phone,
  Mail,
  X,
  Save,
  Building2,
  Award,
  AlertTriangle,
  Loader2,
  Pencil,
  ClipboardList,
  MessageCircle,
  Copy,
  FileDown,
  Share2,
  ShieldCheck,
  HelpCircle,
  ShieldX,
  Clock3,
  CreditCard,
  Trash2,
  Archive,
} from "lucide-react";
import OrganigramaView from "./OrganigramaView";
import AdjuntosPanel from "../components/AdjuntosPanel";
import ContactosTab from "../components/ContactosTab";
import DocumentacionChecklist from "../components/DocumentacionChecklist";
import PersonaFormularios from "../components/PersonaFormularios";
import { PersonaAvatar, PersonaFotoEditor } from "../components/PersonaAvatar";
import CredencialPersonalModal from "../components/CredencialPersonalModal";
import CredencialesMasivasA4 from "../components/CredencialesMasivasA4";
import VacacionesPanel from "../components/VacacionesPanel";
import { PERSONA_DOCUMENTACION_TEMPLATE } from "../lib/documentacion";
import ReclutamientoBoard from "./equipo/ReclutamientoBoard";
import {
  isQualityOnlyProfile,
  isQualityTeamPerson,
  isSafetyOnlyProfile,
  canDeletePerson,
} from "../lib/access";
import { fmtFechaLarga } from "../lib/dateUtils";
import { CRITERIOS_GUIA, ESCALA_GUIA, RECORDATORIO_ESCALA } from "../data/evaluacionGuia";
import { confirmar, pedirTexto, toast } from "../lib/feedback";
import { mensajeError } from "../lib/errores";
import PersonalNovedadesReportModal from "../components/PersonalNovedadesReportModal";
import {
  downloadHistorialPersonalPdf,
  textoHistorialPersonal,
} from "../lib/historialPersonalPdf";
import {
  downloadEvaluacionPersonalPdf,
  evaluacionPersonalFile,
  textoEvaluacionPersonal,
} from "../lib/evaluacionPersonalPdf";

const PERIODO_PRUEBA_DIAS = 180;
const PLANTA_CORDOBA_SEDE_ID = 24;
function estadoPeriodoPrueba(persona, hoy = new Date()) {
  if (!persona?.fecha_ingreso || persona.sede_ids?.includes(PLANTA_CORDOBA_SEDE_ID)) return null;
  const ingreso = new Date(`${persona.fecha_ingreso}T00:00:00`);
  if (Number.isNaN(ingreso.getTime())) return null;
  const vencimiento = new Date(ingreso); vencimiento.setDate(vencimiento.getDate()+PERIODO_PRUEBA_DIAS);
  const inicioHoy = new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate());
  return { ingreso, vencimiento, diasRestantes:Math.round((vencimiento-inicioHoy)/86400000) };
}
function colorPeriodoPrueba(dias) { if (dias<=15) return "#ff4444"; if (dias<=30) return "#f97316"; if (dias<=60) return "#facc15"; return "#39FF14"; }
function textoPeriodoPrueba(dias) { if (dias<0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias)===1?"":"s"}`; if (dias===0) return "Vence hoy"; return `Vence en ${dias} día${dias===1?"":"s"}`; }

// ──────────────────────────────────────────────
// PersonaFicha — vista interna de ficha individual
// ──────────────────────────────────────────────
function PersonaFicha({ personaId, sedes = [], grupos = [], onBack }) {
  const { can, perfil, user } = useAuth();
  const canManage = can("equipo", "manage");
  const canDelete = canDeletePerson(user?.id);
  const canManageCredentials = perfil?.rol === "admin";
  const [showCredential, setShowCredential] = useState(false);
  const canRequestAnulacion = ["admin", "editor", "grupo", "encargado"].includes(
    perfil?.rol,
  );
  const canResolveAnulacion = perfil?.rol === "admin";
  const [persona, setPersona] = useState(null);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [solicitudesAnulacion, setSolicitudesAnulacion] = useState([]);
  const [anulacionTarget, setAnulacionTarget] = useState(null);
  const [anulacionMotivo, setAnulacionMotivo] = useState("");
  const [logros, setLogros] = useState([]);
  const [logrosConfig, setLogrosConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("info");
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [showHistorialForm, setShowHistorialForm] = useState(false);
  const [showEditPersona, setShowEditPersona] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evaluadorPersona, setEvaluadorPersona] = useState(null);

  const deletePersona = async () => {
    const nombreCompleto = `${persona.nombre} ${persona.apellido || ""}`.trim();
    const typed = await pedirTexto({
      titulo: "Eliminar ficha definitivamente",
      mensaje: `Esta acción no se puede deshacer. Escribí el nombre completo para continuar: ${nombreCompleto}`,
      placeholder: nombreCompleto,
      confirmText: "Continuar",
    });
    if (typed?.trim() !== nombreCompleto) {
      if (typed !== null) toast.warn("El nombre ingresado no coincide.");
      return;
    }
    if (!(await confirmar({
      titulo: "Confirmar eliminación",
      mensaje: `¿Eliminar definitivamente la ficha de ${nombreCompleto}? Para personal real usá “Dar de baja”.`,
      confirmText: "Eliminar ficha",
      peligro: true,
    }))) return;
    const { error } = await supabase.schema("equipo").from("personas").delete().eq("id", persona.id);
    if (error) {
      toast.error(error.code === "23503"
        ? "La ficha tiene registros vinculados y no puede eliminarse. Usá Dar de baja."
        : `No se pudo eliminar: ${mensajeError(error)}`);
      return;
    }
    toast.ok("Ficha eliminada definitivamente.");
    onBack();
  };

  const sendPersonaToObsolete = async () => {
    const nombreCompleto = `${persona.nombre} ${persona.apellido || ""}`.trim();
    const nota = await pedirTexto({
      titulo: "Enviar ficha a obsoletos",
      mensaje: `La ficha de ${nombreCompleto} dejará de aparecer en el equipo activo, pero conservará todo su historial vinculado. Indicá el motivo.`,
      placeholder: "Ej.: no pertenece a este servicio; registro cargado en la sede incorrecta",
      confirmText: "Continuar",
    });
    if (nota === null) return;
    if (nota.trim().length < 10) {
      toast.warn("La nota debe tener al menos 10 caracteres.");
      return;
    }
    if (!(await confirmar({
      titulo: "Confirmar envío a obsoletos",
      mensaje: "La ficha quedará inactiva y podrá reactivarse posteriormente desde el historial de bajas.",
      confirmText: "Enviar a obsoletos",
      peligro: true,
    }))) return;

    setSaving(true);
    const fecha = new Date().toISOString().slice(0, 10);
    const observacion = `Ficha enviada a obsoletos: ${nota.trim()}`;
    const { error } = await supabase
      .schema("equipo")
      .from("personas")
      .update({
        activo: false,
        fecha_baja: fecha,
        motivo_baja: "otro",
        observaciones_baja: observacion,
        baja_registrada_at: new Date().toISOString(),
        baja_registrada_por: user?.id || null,
      })
      .eq("id", persona.id);
    if (error) {
      setSaving(false);
      toast.error(`No se pudo enviar la ficha a obsoletos: ${mensajeError(error)}`);
      return;
    }

    const { error: historialError } = await supabase
      .schema("equipo")
      .from("historial_personal")
      .insert({
        persona_id: persona.id,
        tipo: "otro",
        fecha,
        descripcion: observacion,
        registrado_por: user?.email || "Sistema",
      });
    setSaving(false);
    if (historialError) {
      toast.warn("La ficha quedó obsoleta, pero no se pudo agregar la nota al historial.");
    } else {
      toast.ok("Ficha enviada a obsoletos con trazabilidad.");
    }
    onBack();
  };

  const EVAL_INICIAL = {
    evaluador_nombre: "",
    evaluador_cargo: "",
    antiguedad_con_evaluado: "",
    periodo: "",
    d1_cumple_actividades: "",
    d2_sin_supervision: "",
    d3_comprende_prioridades: "",
    e1_cooperacion: "",
    e2_comunicacion: "",
    e3_maneja_desacuerdos: "",
    e4_ambiente_confianza: "",
    e5_evita_conflictos: "",
    p1_cumple_horario: "",
    p2_aseo_personal: "",
    p3_uniforme: "",
    supero_prueba: false,
    observaciones_rrhh: "",
    sugerencias_evaluador: "",
  };
  const [evalForm, setEvalForm] = useState(EVAL_INICIAL);
  const [histForm, setHistForm] = useState({
    tipo: perfil?.rol === "admin" ? "apercibimiento" : "reconocimiento",
    fecha: new Date().toISOString().split("T")[0],
    descripcion: "",
    dias_suspension: "",
    registrado_por: "",
  });

  const periodoActual = () => {
    const fecha = new Date();
    return `Q${Math.floor(fecha.getMonth() / 3) + 1} ${fecha.getFullYear()}`;
  };

  const abrirEvaluacion = () => {
    setEvalForm({
      ...EVAL_INICIAL,
      evaluador_nombre:
        [evaluadorPersona?.nombre, evaluadorPersona?.apellido]
          .filter(Boolean)
          .join(" ") || perfil?.nombre || "",
      evaluador_cargo: evaluadorPersona?.puesto || "",
      periodo: periodoActual(),
    });
    setShowEvalForm(true);
  };

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("v_personas")
      .select("nombre,apellido,puesto")
      .eq("perfil_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setEvaluadorPersona(data || null));
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, ev, hi, lo] = await Promise.all([
      supabase.from("v_personas").select("*").eq("id", personaId).single(),
      supabase
        .from("v_evaluaciones")
        .select("*")
        .eq("persona_id", personaId)
        .order("fecha_evaluacion", { ascending: false }),
      supabase
        .from("v_historial_personal")
        .select("*")
        .eq("persona_id", personaId)
        .order("fecha", { ascending: false }),
      supabase
        .from("v_logros_obtenidos")
        .select("*")
        .eq("persona_id", personaId)
        .order("fecha", { ascending: false }),
    ]);
    setPersona(p.data);
    setEvaluaciones(ev.data || []);
    setHistorial(hi.data || []);
    setLogros(lo.data || []);
    const historialIds = (hi.data || []).map((item) => item.id);
    if (historialIds.length) {
      const solicitudes = await supabase
        .schema("equipo")
        .from("solicitudes_anulacion_historial")
        .select("*")
        .in("historial_id", historialIds)
        .order("solicitado_at", { ascending: false });
      setSolicitudesAnulacion(solicitudes.data || []);
    } else {
      setSolicitudesAnulacion([]);
    }
    setLoading(false);
  }, [personaId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    supabase
      .from("v_logros_config")
      .select("*")
      .eq("activo", true)
      .then((r) => setLogrosConfig(r.data || []));
  }, []);

  const calcPuntaje = (f) => {
    const fields = [
      "d1_cumple_actividades",
      "d2_sin_supervision",
      "d3_comprende_prioridades",
      "e1_cooperacion",
      "e2_comunicacion",
      "e3_maneja_desacuerdos",
      "e4_ambiente_confianza",
      "e5_evita_conflictos",
      "p1_cumple_horario",
      "p2_aseo_personal",
      "p3_uniforme",
    ];
    const vals = fields
      .map((k) => Number(f[k]))
      .filter((v) => v >= 1 && v <= 5);
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(avg * 10) / 10;
  };

  const getResultado = (score) => {
    if (!score) return null;
    if (score < 2) return "Bajo";
    if (score < 3) return "Aceptable";
    if (score < 4.5) return "Alto";
    return "Excelente";
  };

  const RESULTADO_COLOR = {
    Bajo: "#ff4444",
    Aceptable: "#f59e0b",
    Alto: "#3b82f6",
    Excelente: "#39FF14",
  };

  const handleEditEval = (ev) => {
    const mapped = { ...EVAL_INICIAL, id: ev.id };
    for (const k in EVAL_INICIAL) {
      if (ev[k] !== undefined && ev[k] !== null) mapped[k] = ev[k];
    }
    setEvalForm(mapped);
    setShowEvalForm(true);
  };

  const handleEditHist = (h) => {
    setHistForm({
      id: h.id,
      tipo: h.tipo,
      fecha: h.fecha
        ? h.fecha.split("T")[0]
        : new Date().toISOString().split("T")[0],
      descripcion: h.descripcion || "",
      dias_suspension: h.dias_suspension || "",
      registrado_por: h.registrado_por || "",
    });
    setShowHistorialForm(true);
  };

  const shareHistorial = async (h, channel) => {
    const text = textoHistorialPersonal(persona, h);
    if (channel === "whatsapp") {
      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (channel === "email") {
      window.open(
        `mailto:?subject=${encodeURIComponent(`${h.tipo.replace("_", " ")} - ${persona.nombre} ${persona.apellido || ""}`)}&body=${encodeURIComponent(text)}`,
        "_blank",
      );
      return;
    }
    try {
      if (navigator.share)
        await navigator.share({
          title: `${h.tipo.replace("_", " ")} - ${persona.nombre}`,
          text,
        });
      else {
        await navigator.clipboard.writeText(text);
        toast.ok("Registro copiado para compartir.");
      }
    } catch (error) {
      if (error?.name !== "AbortError")
        toast.error("No se pudo compartir el registro.");
    }
  };

  const copyEvaluacion = async (ev) => {
    try {
      await navigator.clipboard.writeText(textoEvaluacionPersonal(persona, ev));
      toast.ok("Resumen de la evaluación copiado.");
    } catch {
      toast.error("No se pudo copiar la evaluación.");
    }
  };

  const shareEvaluacion = async (ev) => {
    const text = textoEvaluacionPersonal(persona, ev);
    try {
      const file = evaluacionPersonalFile(persona, ev);
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `Evaluación de desempeño - ${persona.nombre}`, text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: `Evaluación de desempeño - ${persona.nombre}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.ok("Resumen copiado para compartir.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") toast.error("No se pudo compartir la evaluación.");
    }
  };

  const solicitarAnulacion = async (h) => {
    const motivo = anulacionMotivo.trim();
    if (motivo.length < 10) {
      toast.error("Indicá un motivo de al menos 10 caracteres.");
      return;
    }
    const ok = await confirmar({
      titulo: "Solicitar anulación del documento",
      mensaje: `El registro no se borrará. Quedará pendiente hasta que lo autorice un administrador distinto y toda la operación conservará trazabilidad. Motivo: ${motivo}`,
      confirmText: "Enviar solicitud",
      cancelText: "Cancelar",
      peligro: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("solicitar_anulacion_historial", {
        p_historial_id: h.id,
        p_motivo: motivo,
      });
      if (error) throw error;
      toast.ok("Solicitud enviada. Requiere autorización de otro administrador.");
      setAnulacionTarget(null);
      setAnulacionMotivo("");
      await load();
    } catch (error) {
      toast.error(`No se pudo solicitar la anulación: ${mensajeError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const resolverAnulacion = async (solicitud, decision) => {
    const autorizar = decision === "autorizar";
    const ok = await confirmar({
      titulo: autorizar ? "Autorizar anulación" : "Rechazar anulación",
      mensaje: autorizar
        ? "El documento quedará marcado como anulado, sin borrar el registro ni sus evidencias."
        : "El documento seguirá vigente y la solicitud quedará rechazada.",
      confirmText: autorizar ? "Autorizar" : "Rechazar",
      cancelText: "Cancelar",
      peligro: autorizar,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("resolver_anulacion_historial", {
        p_solicitud_id: solicitud.id,
        p_decision: decision,
        p_motivo: autorizar
          ? "Anulación autorizada mediante doble control."
          : "Solicitud rechazada por el administrador.",
      });
      if (error) throw error;
      toast.ok(autorizar ? "Documento anulado con trazabilidad." : "Solicitud rechazada.");
      await load();
    } catch (error) {
      toast.error(`No se pudo resolver la solicitud: ${mensajeError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveEval = async () => {
    setSaving(true);
    const puntaje = calcPuntaje(evalForm);
    const resultado = getResultado(puntaje);
    const toNum = (v) => (v === "" || v === null ? null : Number(v));

    const payload = {
      persona_id: personaId,
      evaluador_nombre: evalForm.evaluador_nombre || null,
      evaluador_cargo: evalForm.evaluador_cargo || null,
      antiguedad_con_evaluado: evalForm.antiguedad_con_evaluado || null,
      periodo: evalForm.periodo || null,
      d1_cumple_actividades: toNum(evalForm.d1_cumple_actividades),
      d2_sin_supervision: toNum(evalForm.d2_sin_supervision),
      d3_comprende_prioridades: toNum(evalForm.d3_comprende_prioridades),
      e1_cooperacion: toNum(evalForm.e1_cooperacion),
      e2_comunicacion: toNum(evalForm.e2_comunicacion),
      e3_maneja_desacuerdos: toNum(evalForm.e3_maneja_desacuerdos),
      e4_ambiente_confianza: toNum(evalForm.e4_ambiente_confianza),
      e5_evita_conflictos: toNum(evalForm.e5_evita_conflictos),
      p1_cumple_horario: toNum(evalForm.p1_cumple_horario),
      p2_aseo_personal: toNum(evalForm.p2_aseo_personal),
      p3_uniforme: toNum(evalForm.p3_uniforme),
      puntaje_calculado: puntaje,
      resultado_global: resultado,
      supero_prueba: evalForm.supero_prueba,
      observaciones_rrhh: evalForm.observaciones_rrhh || null,
      sugerencias_evaluador: evalForm.sugerencias_evaluador || null,
    };

    let res;
    if (evalForm.id) {
      res = await supabase
        .schema("equipo")
        .from("evaluaciones")
        .update(payload)
        .eq("id", evalForm.id);
    } else {
      res = await supabase
        .schema("equipo")
        .from("evaluaciones")
        .insert(payload);
    }

    setSaving(false);
    if (res.error) {
      toast.error("Error: " + mensajeError(res.error));
      return;
    }
    setShowEvalForm(false);
    setEvalForm(EVAL_INICIAL);
    load();
  };

  const saveHistorial = async () => {
    if (
      ["apercibimiento", "suspension", "llamado_atencion"].includes(histForm.tipo) &&
      perfil?.rol !== "admin"
    ) {
      toast.warn("Las sanciones deben enviarse desde Formularios para aprobación de un administrador.");
      return;
    }
    setSaving(true);
    const payload = {
      persona_id: personaId,
      tipo: histForm.tipo,
      fecha: histForm.fecha,
      descripcion: histForm.descripcion,
      dias_suspension:
        histForm.tipo === "suspension" && histForm.dias_suspension
          ? Number(histForm.dias_suspension)
          : null,
      registrado_por: histForm.registrado_por || null,
    };

    let res;
    if (histForm.id) {
      res = await supabase
        .schema("equipo")
        .from("historial_personal")
        .update(payload)
        .eq("id", histForm.id);
    } else {
      res = await supabase
        .schema("equipo")
        .from("historial_personal")
        .insert(payload);
    }

    setSaving(false);
    if (res.error) {
      toast.error("Error: " + mensajeError(res.error));
      return;
    }
    setShowHistorialForm(false);
    setHistForm({
      tipo: perfil?.rol === "admin" ? "apercibimiento" : "reconocimiento",
      fecha: new Date().toISOString().split("T")[0],
      descripcion: "",
      dias_suspension: "",
      registrado_por: "",
    });
    load();
  };

  const TIPO_COLOR = {
    apercibimiento: "#f59e0b",
    suspension: "#ef4444",
    llamado_atencion: "#f97316",
    reconocimiento: "#3b82f6",
    logro: "#39FF14",
    otro: "rgba(57,255,20,0.4)",
  };

  const [ayudaAbierta, setAyudaAbierta] = useState(null);
  const LabelCriterio = ({ campo, texto }) => {
    const g = CRITERIOS_GUIA[campo];
    const abierta = ayudaAbierta === campo;
    return (
      <div style={{ position: "relative" }}>
        <label
          className="font-metric mb-1"
          style={{ fontSize: "0.6rem", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}
        >
          {texto.toUpperCase()}
          {g && (
            <button
              type="button"
              onClick={() => setAyudaAbierta(abierta ? null : campo)}
              title="Qué evaluar en este criterio"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: abierta ? "var(--phosphor)" : "rgba(255,255,255,0.35)", display: "flex" }}
            >
              <HelpCircle size={11} />
            </button>
          )}
        </label>
        {abierta && g && (
          <div
            style={{
              position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 2,
              background: "var(--surface2, #26262E)", border: "1px solid rgba(57,255,20,0.25)",
              borderRadius: 6, padding: "8px 10px", boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
            }}
          >
            <p style={{ fontSize: "0.66rem", color: "var(--text)", margin: "0 0 5px", lineHeight: 1.4 }}>{g.intro}</p>
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {g.puntos.map((pt, i) => (
                <li key={i} style={{ fontSize: "0.62rem", color: "var(--text-dim)", lineHeight: 1.5 }}>{pt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const ScoreSelect = ({ name, value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      className="input-dark"
      style={{ width: "100%", fontSize: "0.7rem" }}
    >
      <option value="">— Sin calificar —</option>
      <option value="1">1 — Muy bajo</option>
      <option value="2">2 — Bajo</option>
      <option value="3">3 — Aceptable</option>
      <option value="4">4 — Alto</option>
      <option value="5">5 — Excelente</option>
    </select>
  );

  const setEv = (k, v) => setEvalForm((f) => ({ ...f, [k]: v }));

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          size={20}
          className="animate-spin"
          style={{ color: "var(--phosphor)" }}
        />
      </div>
    );
  if (!persona)
    return (
      <div style={{ color: "var(--text-dim)", padding: "2rem" }}>
        Persona no encontrada.
      </div>
    );

  const phoneDigits =
    persona.telefono?.replace(/\D/g, "").replace(/^0+/, "") || "";
  const whatsappNumber = phoneDigits.startsWith("549")
    ? phoneDigits
    : phoneDigits.startsWith("54")
      ? `549${phoneDigits.slice(2).replace(/^9/, "")}`
      : phoneDigits
        ? `549${phoneDigits.replace(/^9/, "")}`
        : "";
  const waLink = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null;
  const mailLink = persona.email ? `mailto:${persona.email.trim()}` : null;

  const puntaje = Math.min(5, persona.puntaje_promedio || 0);
  const resultadoLabel = puntaje > 0 ? getResultado(puntaje) : "—";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {canManageCredentials && showCredential && (
        <CredencialPersonalModal persona={persona} sedes={sedes} onClose={() => setShowCredential(false)} />
      )}
      {canManage && showEditPersona && (
        <PersonaModal
          persona={persona}
          sedes={sedes}
          grupos={grupos}
          onClose={() => setShowEditPersona(false)}
          onSaved={() => {
            setShowEditPersona(false);
            load();
          }}
          onPhotoChanged={load}
        />
      )}

      {/* Header */}
      <div
        className="px-6 pt-5 pb-4 flex items-start gap-4"
        style={{ borderBottom: "1px solid rgba(57,255,20,0.1)" }}
      >
        <button
          onClick={onBack}
          className="btn-ghost mt-0.5"
          style={{ fontSize: "0.7rem" }}
        >
          ← Volver
        </button>
        <PersonaAvatar persona={persona} size={76} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="font-title font-bold text-xl flex items-center gap-2"
              style={{ color: "var(--phosphor)" }}
            >
              {persona.nombre} {persona.apellido || ""}
              {canManage && (
                <button
                  onClick={() => setShowEditPersona(true)}
                  className="btn-ghost p-1"
                  title="Editar info y puesto"
                >
                  <Pencil size={14} />
                </button>
              )}
            </h1>
            {persona.puntos_total > 0 && (
              <span
                className="font-metric text-xs px-2 py-0.5 rounded"
                style={{
                  background: "rgba(57,255,20,0.1)",
                  color: "var(--phosphor)",
                }}
              >
                ⭐ {persona.puntos_total} pts
              </span>
            )}
          </div>
          <p
            className="font-metric text-xs mt-0.5"
            style={{ color: "var(--text-dim)" }}
          >
            {persona.puesto || "—"} {persona.area ? `· ${persona.area}` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {canManage && (
            <button
              onClick={sendPersonaToObsolete}
              disabled={saving}
              className="btn-ghost flex items-center gap-1.5"
              style={{ fontSize:"0.7rem", color:"#f59e0b" }}
            >
              <Archive size={13} /> Enviar a obsoletos
            </button>
          )}
          {canDelete && (
            <button onClick={deletePersona} className="btn-ghost flex items-center gap-1.5" style={{ fontSize:"0.7rem", color:"#ff5c5c" }}>
              <Trash2 size={13} /> Eliminar ficha
            </button>
          )}
          {canManageCredentials && (
            <button onClick={() => setShowCredential(true)} className="btn-ghost flex items-center gap-1.5" style={{ fontSize:"0.7rem" }}>
              <CreditCard size={13} /> Credencial
            </button>
          )}
          {persona.telefono && (
            <a
              href={`tel:${phoneDigits}`}
              className="btn-ghost flex items-center gap-1.5"
              style={{ fontSize: "0.7rem", textDecoration: "none" }}
            >
              <Phone size={12} /> Llamar
            </a>
          )}
          {!persona.telefono && (
            <span className="btn-ghost flex items-center gap-1.5 opacity-40" title="Cargá un teléfono para habilitar la llamada">
              <Phone size={12} /> Llamar
            </span>
          )}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="btn-primary flex items-center gap-1.5"
              style={{ fontSize: "0.7rem", textDecoration: "none" }}
            >
              <MessageCircle size={12} /> Mensaje
            </a>
          )}
          {!waLink && (
            <span className="btn-ghost flex items-center gap-1.5 opacity-40" title="Cargá un teléfono para habilitar WhatsApp">
              <MessageCircle size={12} /> Mensaje
            </span>
          )}
          {mailLink && (
            <a
              href={mailLink}
              className="btn-ghost flex items-center gap-1.5"
              style={{ fontSize: "0.7rem", textDecoration: "none" }}
            >
              <Mail size={12} /> Email
            </a>
          )}
          {!mailLink && (
            <span className="btn-ghost flex items-center gap-1.5 opacity-40" title="Cargá un email para habilitarlo">
              <Mail size={12} /> Email
            </span>
          )}
        </div>
      </div>

      {/* KPI bar */}
      <div
        className="grid grid-cols-4 gap-0"
        style={{ borderBottom: "1px solid rgba(57,255,20,0.08)" }}
      >
        {[
          {
            label: "PUNTAJE PROM.",
            value: puntaje > 0 ? puntaje.toFixed(1) : "—",
          },
          {
            label: "RESULTADO",
            value: resultadoLabel,
            color:
              puntaje > 0 ? RESULTADO_COLOR[resultadoLabel] : "var(--text-dim)",
          },
          { label: "LOGROS", value: persona.logros_count || 0 },
          {
            label: "INCIDENTES",
            value: persona.incidentes || 0,
            color: persona.incidentes > 0 ? "#f59e0b" : "var(--phosphor)",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="py-3 px-4 text-center"
            style={{ borderRight: "1px solid rgba(57,255,20,0.06)" }}
          >
            <p
              className="font-title font-bold text-lg"
              style={{ color: k.color || "var(--phosphor)" }}
            >
              {k.value}
            </p>
            <p
              className="font-metric"
              style={{
                fontSize: "0.6rem",
                color: "var(--text-dim)",
                letterSpacing: "0.08em",
              }}
            >
              {k.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0 px-6 pt-3"
        style={{ borderBottom: "1px solid rgba(57,255,20,0.08)" }}
      >
        {[
          ["info", "INFO & PUESTO"],
          ["documentacion", "DOCUMENTACIÓN"],
          ["evaluaciones", "EVALUACIONES"],
          ["historial", "HISTORIAL"],
          ["logros", "LOGROS"],
          ...(canManage ? [["formularios", "FORMULARIOS"]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="font-metric px-4 py-1.5 mr-1 rounded-t"
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.08em",
              background: tab === id ? "rgba(57,255,20,0.12)" : "transparent",
              color: tab === id ? "var(--phosphor)" : "var(--text-dim)",
              borderBottom:
                tab === id
                  ? "2px solid var(--phosphor)"
                  : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* ── INFO ── */}
        {tab === "info" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass p-4 space-y-3">
                <p
                  className="font-metric text-xs"
                  style={{ color: "var(--phosphor)", letterSpacing: "0.08em" }}
                >
                  DATOS PERSONALES
                </p>
                {[
                  ["N.º de legajo", persona.legajo],
                  ["DNI", persona.dni],
                  ["Teléfono", persona.telefono],
                  ["Email", persona.email],
                  [
                    "Fecha ingreso",
                    persona.fecha_ingreso
                      ? fmtFechaLarga(persona.fecha_ingreso)
                      : null,
                  ],
                  [
                    "Baja programada",
                    persona.fecha_baja ? fmtFechaLarga(persona.fecha_baja) : null,
                  ],
                  [
                    "Motivo de baja",
                    persona.motivo_baja ? persona.motivo_baja.replaceAll("_", " ") : null,
                  ],
                ].map(([l, v]) =>
                  v ? (
                    <div key={l}>
                      <p
                        style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
                      >
                        {l}
                      </p>
                      <p style={{ fontSize: "0.8rem", color: "var(--text)" }}>
                        {v}
                      </p>
                    </div>
                  ) : null,
                )}
              </div>
              <div className="glass p-4 space-y-3">
                <p
                  className="font-metric text-xs"
                  style={{ color: "var(--phosphor)", letterSpacing: "0.08em" }}
                >
                  CARGO Y ÁREA
                </p>
                {[
                  ["Puesto", persona.puesto],
                  ["Área", persona.area],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>
                      {l}
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text)" }}>
                      {v || "—"}
                    </p>
                  </div>
                ))}
                <div>
                  <p style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>
                    Escala / Unidad Productiva
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text)" }}>
                    {persona.sede_ids?.length
                      ? (() => {
                          const g = grupos.find((gr) => {
                            const groupSedes = sedes
                              .filter((s) => s.grupo_id === gr.id)
                              .map((s) => s.id);
                            return (
                              groupSedes.length > 0 &&
                              groupSedes.every((id) =>
                                persona.sede_ids.includes(id),
                              )
                            );
                          });
                          if (g) return `Grupo: ${g.nombre}`;
                          return persona.sede_ids
                            .map((id) => sedes.find((s) => s.id === id)?.nombre)
                            .filter(Boolean)
                            .join(" • ");
                        })()
                      : "Sin escala asignada"}
                  </p>
                </div>
              </div>
            </div>
            {persona.descripcion_puesto && (
              <div className="glass p-4">
                <p
                  className="font-metric text-xs mb-2"
                  style={{ color: "var(--phosphor)", letterSpacing: "0.08em" }}
                >
                  DESCRIPCIÓN DEL PUESTO
                </p>
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {persona.descripcion_puesto}
                </p>
              </div>
            )}
            {persona.procesos && persona.procesos.length > 0 && (
              <div className="glass p-4">
                <p
                  className="font-metric text-xs mb-2"
                  style={{ color: "var(--phosphor)", letterSpacing: "0.08em" }}
                >
                  PROCESOS QUE EJECUTA
                </p>
                <ul className="space-y-1.5">
                  {persona.procesos.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        style={{
                          color: "var(--phosphor)",
                          fontSize: "0.7rem",
                          marginTop: 1,
                        }}
                      >
                        ▸
                      </span>
                      <span
                        style={{ fontSize: "0.78rem", color: "var(--text)" }}
                      >
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── DOCUMENTACIÓN ── */}
        {tab === "documentacion" && (
          <DocumentacionChecklist
            entityType="persona"
            entityId={persona.id}
            template={PERSONA_DOCUMENTACION_TEMPLATE}
            canEdit={canManage}
            title="Documentación del puesto"
          />
        )}

        {/* ── FORMULARIOS ── */}
        {tab === "formularios" && canManage && (
          <PersonaFormularios
            persona={persona}
            onRegistered={() => {
              load();
              setTab("historial");
            }}
          />
        )}

        {/* ── EVALUACIONES ── */}
        {tab === "evaluaciones" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p
                className="font-metric text-xs"
                style={{ color: "var(--text-dim)" }}
              >
                {evaluaciones.length} evaluaciones registradas
              </p>
              {canManage && (
                <button
                  onClick={abrirEvaluacion}
                  className="btn-primary flex items-center gap-1.5"
                  style={{ fontSize: "0.7rem" }}
                >
                  <Plus size={12} /> Nueva evaluación
                </button>
              )}
            </div>
            {showEvalForm && (
              <div
                className="glass p-5 mb-4"
                style={{ border: "1px solid rgba(57,255,20,0.2)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <p
                    className="font-metric text-xs"
                    style={{ color: "var(--phosphor)" }}
                  >
                    NUEVA EVALUACIÓN DE DESEMPEÑO
                  </p>
                  <button
                    onClick={() => setShowEvalForm(false)}
                    className="btn-ghost"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div
                  className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-3"
                  style={{
                    background: "rgba(57,255,20,0.04)",
                    border: "1px solid rgba(57,255,20,0.12)",
                  }}
                >
                  {[
                    ["Personal evaluado", [persona?.nombre, persona?.apellido].filter(Boolean).join(" ")],
                    ["DNI", persona?.dni],
                    ["Legajo", persona?.legajo],
                    ["Puesto", persona?.puesto],
                    ["Sede", persona?.sede_nombre || (persona?.sede_ids || []).map(id => sedes.find(s => s.id === id)?.nombre).filter(Boolean).join(", ")],
                    ["Fecha de ingreso", persona?.fecha_ingreso ? fmtFechaLarga(persona.fecha_ingreso) : null],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label}>
                      <p className="font-metric" style={{ fontSize: "0.58rem", color: "var(--text-dim)", textTransform: "uppercase" }}>{label}</p>
                      <p style={{ fontSize: "0.76rem", color: "var(--text)", marginTop: 2 }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    [
                      "evaluador_nombre",
                      "Nombre del evaluador",
                      "Ej: María González",
                    ],
                    [
                      "evaluador_cargo",
                      "Cargo evaluador",
                      "Ej: Jefe de Cocina",
                    ],
                    ["periodo", "Período", "Ej: Q2 2026"],
                    [
                      "antiguedad_con_evaluado",
                      "Antigüedad con evaluado",
                      "Ej: 6 meses",
                    ],
                  ].map(([k, l, ph]) => (
                    <div key={k}>
                      <label
                        className="font-metric block mb-1"
                        style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
                      >
                        {l.toUpperCase()}
                      </label>
                      <input
                        className="input-dark w-full"
                        value={evalForm[k]}
                        onChange={(e) => setEv(k, e.target.value)}
                        placeholder={ph}
                        style={{ fontSize: "0.75rem" }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  className="rounded mb-3"
                  style={{
                    background: "rgba(57,255,20,0.04)",
                    border: "1px solid rgba(57,255,20,0.15)",
                    padding: "10px 12px",
                  }}
                >
                  <p style={{ fontSize: "0.66rem", color: "var(--phosphor)", fontWeight: 700, margin: "0 0 6px" }}>
                    {RECORDATORIO_ESCALA}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 8px" }}>
                    {ESCALA_GUIA.flatMap((e) => [
                      <span key={`n${e.n}`} style={{ fontSize: "0.62rem", color: "var(--text)", fontWeight: 700 }}>
                        {e.n} · {e.nivel}
                      </span>,
                      <span key={`d${e.n}`} style={{ fontSize: "0.6rem", color: "var(--text-dim)", lineHeight: 1.4 }}>
                        {e.def}
                      </span>,
                    ])}
                  </div>
                  <p style={{ fontSize: "0.6rem", color: "var(--text-dim)", margin: "6px 0 0" }}>
                    Dejá "— Sin calificar —" si no pudiste observar el ítem.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <p
                      className="font-metric mb-2"
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--phosphor)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      BLOQUE 1 — DESEMPEÑO EN EL PUESTO
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["d1_cumple_actividades", "Cumple actividades"],
                        ["d2_sin_supervision", "Sin supervisión"],
                        ["d3_comprende_prioridades", "Comprende prioridades"],
                      ].map(([k, l]) => (
                        <div key={k}>
                          <LabelCriterio campo={k} texto={l} />
                          <ScoreSelect
                            name={k}
                            value={evalForm[k]}
                            onChange={setEv}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p
                      className="font-metric mb-2"
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--phosphor)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      BLOQUE 2 — TRABAJO EN EQUIPO Y CLIMA
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["e1_cooperacion", "Cooperación"],
                        ["e2_comunicacion", "Comunicación"],
                        ["e3_maneja_desacuerdos", "Maneja desacuerdos"],
                        ["e4_ambiente_confianza", "Ambiente de confianza"],
                        ["e5_evita_conflictos", "Evita conflictos"],
                      ].map(([k, l]) => (
                        <div key={k}>
                          <LabelCriterio campo={k} texto={l} />
                          <ScoreSelect
                            name={k}
                            value={evalForm[k]}
                            onChange={setEv}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p
                      className="font-metric mb-2"
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--phosphor)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      BLOQUE 3 — PRESENTACIÓN Y PUNTUALIDAD
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["p1_cumple_horario", "Cumple horario"],
                        ["p2_aseo_personal", "Aseo personal"],
                        ["p3_uniforme", "Uniforme"],
                      ].map(([k, l]) => (
                        <div key={k}>
                          <LabelCriterio campo={k} texto={l} />
                          <ScoreSelect
                            name={k}
                            value={evalForm[k]}
                            onChange={setEv}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {(() => {
                  const s = calcPuntaje(evalForm);
                  return s ? (
                    <div
                      className="mb-3 p-3 rounded flex items-center gap-3"
                      style={{
                        background: "rgba(57,255,20,0.07)",
                        border: "1px solid rgba(57,255,20,0.2)",
                      }}
                    >
                      <span
                        className="font-title font-bold text-2xl"
                        style={{
                          color:
                            RESULTADO_COLOR[getResultado(s)] ||
                            "var(--phosphor)",
                        }}
                      >
                        {s.toFixed(1)}
                      </span>
                      <div>
                        <p style={{ fontSize: "0.7rem", color: "var(--text)" }}>
                          Resultado:{" "}
                          <strong
                            style={{ color: RESULTADO_COLOR[getResultado(s)] }}
                          >
                            {getResultado(s)}
                          </strong>
                        </p>
                        <p
                          style={{
                            fontSize: "0.6rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          Promedio de{" "}
                          {
                            Object.keys(evalForm).filter(
                              (k) =>
                                [
                                  "d1",
                                  "d2",
                                  "d3",
                                  "e1",
                                  "e2",
                                  "e3",
                                  "e4",
                                  "e5",
                                  "p1",
                                  "p2",
                                  "p3",
                                ].some((x) => k.startsWith(x)) && evalForm[k],
                            ).length
                          }{" "}
                          ítems
                        </p>
                      </div>
                    </div>
                  ) : null;
                })()}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    [
                      "observaciones_rrhh",
                      "Observaciones RRHH",
                      "Ej: Buen desempeño general, atento a indicaciones",
                    ],
                    [
                      "sugerencias_evaluador",
                      "Sugerencias",
                      "Ej: Reforzar manejo de tiempos en hora pico",
                    ],
                  ].map(([k, l, ph]) => (
                    <div key={k}>
                      <label
                        className="font-metric block mb-1"
                        style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
                      >
                        {l.toUpperCase()}
                      </label>
                      <textarea
                        className="input-dark w-full"
                        rows={2}
                        value={evalForm[k]}
                        onChange={(e) => setEv(k, e.target.value)}
                        placeholder={ph}
                        style={{ fontSize: "0.75rem", resize: "vertical" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evalForm.supero_prueba}
                      onChange={(e) => setEv("supero_prueba", e.target.checked)}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--text)" }}>
                      Superó período de prueba
                    </span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveEval}
                    disabled={saving}
                    className="btn-primary flex items-center gap-1.5"
                    style={{ fontSize: "0.72rem" }}
                  >
                    <Save size={12} />{" "}
                    {saving ? "Guardando..." : "Guardar evaluación"}
                  </button>
                  <button
                    onClick={() => setShowEvalForm(false)}
                    className="btn-ghost"
                    style={{ fontSize: "0.72rem" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {evaluaciones.length === 0 && (
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  Sin evaluaciones aún.
                </p>
              )}
              {evaluaciones.map((ev) => (
                <div key={ev.id} className="glass p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p
                        className="font-metric text-xs"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {ev.periodo || "Sin período"} ·{" "}
                        {fmtFechaLarga(ev.fecha_evaluacion)}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text)" }}>
                        {ev.evaluador_nombre || "Evaluador no especificado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {ev.puntaje_calculado && (
                        <div className="text-right">
                          <p
                            className="font-title font-bold text-2xl"
                            style={{
                              color:
                                RESULTADO_COLOR[ev.resultado_global] ||
                                "var(--phosphor)",
                            }}
                          >
                            {ev.puntaje_calculado}
                          </p>
                          <p
                            className="font-metric"
                            style={{
                              fontSize: "0.6rem",
                              color: RESULTADO_COLOR[ev.resultado_global],
                            }}
                          >
                            {ev.resultado_global}
                          </p>
                        </div>
                      )}
                      {canManage && (
                        <button
                          onClick={() => handleEditEval(ev)}
                          className="btn-ghost p-1.5"
                          title="Editar evaluación"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      [
                        "Desempeño",
                        [
                          ev.d1_cumple_actividades,
                          ev.d2_sin_supervision,
                          ev.d3_comprende_prioridades,
                        ],
                      ],
                      [
                        "Equipo/Clima",
                        [
                          ev.e1_cooperacion,
                          ev.e2_comunicacion,
                          ev.e3_maneja_desacuerdos,
                          ev.e4_ambiente_confianza,
                          ev.e5_evita_conflictos,
                        ],
                      ],
                      [
                        "Presentación",
                        [
                          ev.p1_cumple_horario,
                          ev.p2_aseo_personal,
                          ev.p3_uniforme,
                        ],
                      ],
                    ].map(([bloque, vals]) => {
                      const vs = vals.filter((v) => v != null);
                      const avg = vs.length
                        ? (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1)
                        : "—";
                      return (
                        <div
                          key={bloque}
                          className="text-center p-2 rounded"
                          style={{ background: "rgba(255,255,255,0.03)" }}
                        >
                          <p
                            className="font-title font-bold"
                            style={{
                              color: "var(--phosphor)",
                              fontSize: "1.1rem",
                            }}
                          >
                            {avg}
                          </p>
                          <p
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-dim)",
                            }}
                          >
                            {bloque}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {ev.observaciones_rrhh && (
                    <p
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-dim)",
                        marginTop: "0.5rem",
                      }}
                    >
                      📝 {ev.observaciones_rrhh}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => downloadEvaluacionPersonalPdf(persona, ev)} className="btn-ghost flex items-center gap-1.5" style={{ fontSize: "0.68rem" }}>
                      <FileDown size={12} /> Descargar PDF
                    </button>
                    <button onClick={() => shareEvaluacion(ev)} className="btn-ghost flex items-center gap-1.5" style={{ fontSize: "0.68rem" }}>
                      <Share2 size={12} /> Compartir
                    </button>
                    <button onClick={() => copyEvaluacion(ev)} className="btn-ghost flex items-center gap-1.5" style={{ fontSize: "0.68rem" }}>
                      <Copy size={12} /> Copiar resumen
                    </button>
                  </div>
                  <div
                    className="mt-3 pt-3"
                    style={{ borderTop: "1px solid rgba(57,255,20,0.1)" }}
                  >
                    <AdjuntosPanel
                      entityType="evaluacion"
                      entityId={ev.id}
                      readOnly={!canManage}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab === "historial" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p
                className="font-metric text-xs"
                style={{ color: "var(--text-dim)" }}
              >
                {historial.length} registros
              </p>
              {canManage && (
                <button
                  onClick={() => setShowHistorialForm(true)}
                  className="btn-primary flex items-center gap-1.5"
                  style={{ fontSize: "0.7rem" }}
                >
                  <Plus size={12} /> Agregar registro
                </button>
              )}
            </div>
            {showHistorialForm && (
              <div
                className="glass p-4 mb-4"
                style={{ border: "1px solid rgba(57,255,20,0.2)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p
                    className="font-metric text-xs"
                    style={{ color: "var(--phosphor)" }}
                  >
                    NUEVO REGISTRO
                  </p>
                  <button
                    onClick={() => setShowHistorialForm(false)}
                    className="btn-ghost"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label
                      className="font-metric block mb-1"
                      style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
                    >
                      TIPO
                    </label>
                    <select
                      className="input-dark w-full"
                      value={histForm.tipo}
                      onChange={(e) =>
                        setHistForm((f) => ({ ...f, tipo: e.target.value }))
                      }
                      style={{ fontSize: "0.75rem" }}
                    >
                      {perfil?.rol === "admin" && <option value="apercibimiento">Apercibimiento</option>}
                      {perfil?.rol === "admin" && <option value="suspension">Suspensión</option>}
                      {perfil?.rol === "admin" && <option value="llamado_atencion">Llamado de atención</option>}
                      <option value="reconocimiento">Reconocimiento</option>
                      <option value="logro">Logro</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className="font-metric block mb-1"
                      style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
                    >
                      FECHA *
                    </label>
                    <input
                      type="date"
                      required
                      className="input-dark w-full"
                      value={histForm.fecha}
                      onChange={(e) =>
                        setHistForm((f) => ({ ...f, fecha: e.target.value }))
                      }
                      style={{ fontSize: "0.75rem" }}
                    />
                  </div>
                  {histForm.tipo === "suspension" && (
                    <div>
                      <label
                        className="font-metric block mb-1"
                        style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
                      >
                        DÍAS DE SUSPENSIÓN
                      </label>
                      <input
                        type="number"
                        className="input-dark w-full"
                        placeholder="Ej: 3"
                        value={histForm.dias_suspension}
                        onChange={(e) =>
                          setHistForm((f) => ({
                            ...f,
                            dias_suspension: e.target.value,
                          }))
                        }
                        style={{ fontSize: "0.75rem" }}
                      />
                    </div>
                  )}
                  <div>
                    <label
                      className="font-metric block mb-1"
                      style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
                    >
                      REGISTRADO POR
                    </label>
                    <input
                      className="input-dark w-full"
                      placeholder="Ej: Carlos Ruiz"
                      value={histForm.registrado_por}
                      onChange={(e) =>
                        setHistForm((f) => ({
                          ...f,
                          registrado_por: e.target.value,
                        }))
                      }
                      style={{ fontSize: "0.75rem" }}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label
                    className="font-metric block mb-1"
                    style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
                  >
                    DESCRIPCIÓN *
                  </label>
                  <textarea
                    className="input-dark w-full"
                    rows={2}
                    required
                    placeholder="Ej: Llegó 40 minutos tarde sin avisar"
                    value={histForm.descripcion}
                    onChange={(e) =>
                      setHistForm((f) => ({
                        ...f,
                        descripcion: e.target.value,
                      }))
                    }
                    style={{ fontSize: "0.75rem", resize: "vertical" }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveHistorial}
                    disabled={saving || !histForm.descripcion}
                    className="btn-primary flex items-center gap-1.5"
                    style={{ fontSize: "0.72rem" }}
                  >
                    <Save size={12} /> {saving ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => setShowHistorialForm(false)}
                    className="btn-ghost"
                    style={{ fontSize: "0.72rem" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {historial.length === 0 && (
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  Sin registros.
                </p>
              )}
              {historial.map((h) => (
                <div
                  key={h.id}
                  className="glass p-3 flex items-start gap-3"
                  style={h.anulada ? { opacity: 0.68, borderColor: "rgba(239,68,68,0.45)" } : undefined}
                >
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{
                      background: TIPO_COLOR[h.tipo] || "var(--phosphor)",
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-metric"
                          style={{
                            fontSize: "0.6rem",
                            color: TIPO_COLOR[h.tipo],
                            textTransform: "uppercase",
                          }}
                        >
                          {h.tipo.replace("_", " ")}
                        </span>
                        <span
                          style={{
                            fontSize: "0.6rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          {fmtFechaLarga(h.fecha)}
                        </span>
                        {h.dias_suspension && (
                          <span
                            style={{ fontSize: "0.6rem", color: "#ef4444" }}
                          >
                            ({h.dias_suspension} días)
                          </span>
                        )}
                        {h.anulada && (
                          <span className="font-metric" style={{ fontSize: "0.58rem", color: "#ef4444" }}>
                            ANULADO
                          </span>
                        )}
                        {!h.anulada && solicitudesAnulacion.find(
                          (item) => item.historial_id === h.id && item.estado === "pendiente",
                        ) && (
                          <span className="font-metric flex items-center gap-1" style={{ fontSize: "0.58rem", color: "#f59e0b" }}>
                            <Clock3 size={10} /> ANULACIÓN PENDIENTE
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          onClick={() =>
                            downloadHistorialPersonalPdf(persona, h)
                          }
                          className="btn-ghost p-1"
                          title="Descargar documento"
                        >
                          <FileDown size={12} />
                        </button>
                        <button
                          onClick={() => shareHistorial(h, "whatsapp")}
                          className="btn-ghost p-1"
                          title="Compartir por WhatsApp"
                        >
                          <MessageCircle size={12} />
                        </button>
                        <button
                          onClick={() => shareHistorial(h, "email")}
                          className="btn-ghost p-1"
                          title="Compartir por email"
                        >
                          <Mail size={12} />
                        </button>
                        <button
                          onClick={() => shareHistorial(h, "native")}
                          className="btn-ghost p-1"
                          title="Compartir"
                        >
                          <Share2 size={12} />
                        </button>
                        {canManage && !h.anulada && (
                          <button
                            onClick={() => handleEditHist(h)}
                            className="btn-ghost p-1"
                            title="Editar registro"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {canRequestAnulacion && !h.anulada && !solicitudesAnulacion.find(
                          (item) => item.historial_id === h.id && item.estado === "pendiente",
                        ) && (
                          <button
                            disabled={saving}
                            onClick={() => {
                              setAnulacionTarget(h.id);
                              setAnulacionMotivo("");
                            }}
                            className="btn-ghost p-1"
                            title="Solicitar anulación por doble control"
                            style={{ color: "#ef4444" }}
                          >
                            <ShieldX size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "var(--text)" }}>
                      {h.descripcion}
                    </p>
                    {h.registrado_por && (
                      <p
                        style={{
                          fontSize: "0.6rem",
                          color: "var(--text-dim)",
                          marginTop: 2,
                        }}
                      >
                        Por: {h.registrado_por}
                      </p>
                    )}
                    {h.anulada && h.anulacion_motivo && (
                      <p style={{ fontSize: "0.65rem", color: "#ef4444", marginTop: 6 }}>
                        Motivo de anulación: {h.anulacion_motivo}
                      </p>
                    )}
                    {anulacionTarget === h.id && (
                      <div className="mt-3 p-3" style={{ border: "1px solid rgba(239,68,68,0.35)", borderRadius: 6 }}>
                        <label className="font-metric block mb-1" style={{ fontSize: "0.6rem", color: "#fca5a5" }}>
                          MOTIVO DE LA SOLICITUD *
                        </label>
                        <textarea
                          className="input-dark w-full"
                          rows={2}
                          value={anulacionMotivo}
                          onChange={(event) => setAnulacionMotivo(event.target.value)}
                          placeholder="Ej.: carga duplicada generada durante el aprendizaje de uso"
                        />
                        <div className="flex gap-2 mt-2">
                          <button className="btn-danger" disabled={saving || anulacionMotivo.trim().length < 10} onClick={() => solicitarAnulacion(h)}>
                            Enviar para autorización
                          </button>
                          <button className="btn-ghost" onClick={() => setAnulacionTarget(null)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                    {(() => {
                      const solicitud = solicitudesAnulacion.find(
                        (item) => item.historial_id === h.id && item.estado === "pendiente",
                      );
                      if (!solicitud) return null;
                      return (
                        <div className="mt-3 p-3" style={{ border: "1px solid rgba(245,158,11,0.35)", borderRadius: 6 }}>
                          <p style={{ fontSize: "0.68rem", color: "#fbbf24" }}>
                            Solicitud pendiente: {solicitud.motivo}
                          </p>
                          {canResolveAnulacion && solicitud.solicitado_por !== user?.id && (
                            <div className="flex gap-2 mt-2">
                              <button className="btn-primary flex items-center gap-1" disabled={saving} onClick={() => resolverAnulacion(solicitud, "autorizar")}>
                                <ShieldCheck size={12} /> Autorizar
                              </button>
                              <button className="btn-ghost flex items-center gap-1" disabled={saving} onClick={() => resolverAnulacion(solicitud, "rechazar")}>
                                <ShieldX size={12} /> Rechazar
                              </button>
                            </div>
                          )}
                          {canResolveAnulacion && solicitud.solicitado_por === user?.id && (
                            <p style={{ fontSize: "0.62rem", color: "var(--text-dim)", marginTop: 6 }}>
                              Debe resolverla otro administrador.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    <div className="mt-2">
                      <AdjuntosPanel
                        entityType="historial_personal"
                        entityId={h.id}
                        readOnly={!canManage}
                        label={
                          h.tipo === "apercibimiento"
                            ? "Apercibimiento firmado"
                            : "Adjuntos"
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LOGROS ── */}
        {tab === "logros" && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p
                  className="font-metric text-xs mb-3"
                  style={{ color: "var(--phosphor)", letterSpacing: "0.08em" }}
                >
                  OBTENIDOS
                </p>
                {logros.length === 0 && (
                  <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                    Aún sin logros.
                  </p>
                )}
                <div className="space-y-2">
                  {logros.map((l) => (
                    <div
                      key={l.id}
                      className="glass p-3 flex items-center gap-3"
                    >
                      <span style={{ fontSize: "1.4rem" }}>
                        {l.icono || "🏆"}
                      </span>
                      <div>
                        <p
                          style={{ fontSize: "0.78rem", color: "var(--text)" }}
                        >
                          {l.nombre}
                        </p>
                        <p
                          style={{
                            fontSize: "0.6rem",
                            color: "var(--phosphor)",
                          }}
                        >
                          +{l.puntos} pts · {fmtFechaLarga(l.fecha)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p
                  className="font-metric text-xs mb-3"
                  style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}
                >
                  CATÁLOGO COMPLETO
                </p>
                <div className="space-y-2">
                  {logrosConfig.map((lc) => {
                    const obtenido = logros.some(
                      (l) => l.logro_id === lc.id || l.nombre === lc.nombre,
                    );
                    return (
                      <div
                        key={lc.id}
                        className="glass p-3 flex items-center gap-3"
                        style={{ opacity: obtenido ? 1 : 0.45 }}
                      >
                        <span style={{ fontSize: "1.1rem" }}>{lc.icono}</span>
                        <div className="flex-1">
                          <p
                            style={{
                              fontSize: "0.75rem",
                              color: obtenido
                                ? "var(--text)"
                                : "var(--text-dim)",
                            }}
                          >
                            {lc.nombre}
                          </p>
                          <p
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-dim)",
                            }}
                          >
                            {lc.descripcion}
                          </p>
                        </div>
                        <span
                          className="font-metric"
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--phosphor)",
                          }}
                        >
                          {lc.puntos}pts
                        </span>
                        {obtenido && (
                          <span
                            style={{
                              color: "var(--phosphor)",
                              fontSize: "0.75rem",
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Modal Nueva/Editar Persona
// ──────────────────────────────────────────────
function PersonaModal({
  persona,
  sedes = [],
  grupos = [],
  defaultSedeIds = [],
  requireSede = false,
  onClose,
  onSaved,
  onPhotoChanged,
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    nombre: persona?.nombre || "",
    apellido: persona?.apellido || "",
    legajo: persona?.legajo || "",
    dni: persona?.dni || "",
    puesto: persona?.puesto || "",
    area: persona?.area || "",
    telefono: persona?.telefono || "",
    email: persona?.email || "",
    fecha_ingreso: persona?.fecha_ingreso || "",
    fecha_baja: persona?.fecha_baja || "",
    motivo_baja: persona?.motivo_baja || "",
    observaciones_baja: persona?.observaciones_baja || "",
    descripcion_puesto: persona?.descripcion_puesto || "",
    procesos_raw: persona?.procesos ? persona.procesos.join("\n") : "",
    sede_ids: persona?.sede_ids || defaultSedeIds,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleDelete = async () => {
    if (!persona?.id) return;
    if (!form.fecha_baja) return toast.warn("Indicá la fecha de baja.");
    if (!form.motivo_baja) return toast.warn("Seleccioná el motivo de la baja.");
    const esProgramada = form.fecha_baja > new Date().toISOString().slice(0, 10);
    if (
      !(await confirmar({
        titulo: esProgramada ? "Programar baja laboral" : "Registrar baja laboral",
        mensaje: esProgramada
          ? "La ficha seguirá activa hasta que se confirme la baja en la fecha indicada."
          : "La persona pasará al Historial de bajas y conservará toda su información.",
        peligro: true,
        confirmText: esProgramada ? "Programar baja" : "Confirmar baja",
      }))
    )
      return;
    setSaving(true);
    const res = await supabase
      .schema("equipo")
      .from("personas")
      .update({
        activo: esProgramada,
        fecha_baja: form.fecha_baja,
        motivo_baja: form.motivo_baja,
        observaciones_baja: form.observaciones_baja.trim() || null,
        baja_registrada_at: esProgramada ? null : new Date().toISOString(),
        baja_registrada_por: esProgramada ? null : user?.id || null,
      })
      .eq("id", persona.id);
    setSaving(false);
    if (res.error) {
      toast.error("Error al registrar la baja: " + mensajeError(res.error));
      return;
    }
    if (!esProgramada) {
      await supabase.schema("equipo").from("historial_personal").insert({
        persona_id: persona.id,
        tipo: "otro",
        fecha: form.fecha_baja,
        descripcion: `Baja laboral: ${form.motivo_baja.replaceAll("_", " ")}${form.observaciones_baja.trim() ? `. ${form.observaciones_baja.trim()}` : ""}`,
        registrado_por: user?.email || "Sistema",
      });
    }
    toast.success(esProgramada ? "Baja programada." : "Baja registrada.");
    onSaved();
  };

  const handleSelectSede = (e) => {
    const val = e.target.value;
    if (!val) {
      set("sede_ids", []);
    } else if (val.startsWith("G_")) {
      const gId = Number(val.split("_")[1]);
      const sIds = sedes.filter((s) => s.grupo_id === gId).map((s) => s.id);
      set("sede_ids", sIds);
    } else {
      set("sede_ids", [Number(val)]);
    }
  };

  const save = async () => {
    if (!form.nombre.trim()) return toast.warn("El nombre es requerido.");
    if (requireSede && !form.sede_ids.length)
      return toast.warn("Seleccioná la sede de la persona.");
    setSaving(true);
    const { data: activos, error: duplicateCheckError } = await supabase
      .schema("equipo")
      .from("personas")
      .select("id,nombre,apellido,puesto,dni,legajo")
      .eq("activo", true)
      .is("duplicado_de", null);
    if (duplicateCheckError) {
      setSaving(false);
      return toast.error("No se pudo verificar si la persona ya existe.");
    }
    const normalizar = (valor) => (valor || "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const nombreIngresado = normalizar(`${form.nombre} ${form.apellido}`);
    const existente = (activos || []).find((p) =>
      p.id !== persona?.id && (
        normalizar(`${p.nombre} ${p.apellido || ""}`) === nombreIngresado ||
        (form.dni.trim() && p.dni?.trim() === form.dni.trim()) ||
        (form.legajo.trim() && p.legajo?.trim() === form.legajo.trim())
      )
    );
    if (existente) {
      setSaving(false);
      return toast.warn(
        `${existente.nombre} ${existente.apellido || ""} ya está activo en el equipo${existente.puesto ? ` como ${existente.puesto}` : ""}. Abrí su ficha en lugar de crear otra.`,
      );
    }
    const procesos = form.procesos_raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || null,
      legajo: form.legajo.trim() || null,
      dni: form.dni.trim() || null,
      puesto: form.puesto.trim() || null,
      area: form.area.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      fecha_ingreso: form.fecha_ingreso || null,
      fecha_baja: form.fecha_baja || null,
      motivo_baja: form.motivo_baja || null,
      observaciones_baja: form.observaciones_baja.trim() || null,
      descripcion_puesto: form.descripcion_puesto.trim() || null,
      procesos: procesos.length ? procesos : null,
      sede_ids: form.sede_ids.length ? form.sede_ids : null,
    };

    let res;
    if (persona) {
      res = await supabase
        .schema("equipo")
        .from("personas")
        .update(payload)
        .eq("id", persona.id);
    } else {
      res = await supabase.schema("equipo").from("personas").insert(payload);
    }

    setSaving(false);
    if (res.error) {
      toast.error("Error: " + mensajeError(res.error));
      return;
    }
    onSaved();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 60 }}>
      <div
        className="glass fade-in w-full max-w-2xl"
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(57,255,20,0.2)",
          borderRadius: 4,
          padding: "1.5rem",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <p
            className="font-metric text-xs"
            style={{ color: "var(--phosphor)", letterSpacing: "0.1em" }}
          >
            {persona ? "EDITAR PERSONA" : "NUEVA PERSONA"}
          </p>
          <button onClick={onClose} className="btn-ghost">
            <X size={13} />
          </button>
        </div>
        {persona && <PersonaFotoEditor persona={persona} onChanged={onPhotoChanged} />}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            ["nombre", "Nombre *", "Ej: Juan"],
            ["apellido", "Apellido", "Ej: Pérez"],
            ["legajo", "N.º de legajo", "Ej: FK-00125"],
            ["dni", "DNI", "Ej: 34567890"],
            ["puesto", "Puesto", "Ej: Cocinero"],
            ["area", "Área", "Ej: Cocina"],
            ["telefono", "Teléfono", "Ej: 1145678900"],
            ["email", "Email", "Ej: juan.perez@email.com"],
            ["fecha_ingreso", "Fecha ingreso", null],
          ].map(([k, l, ph]) => (
            <div key={k}>
              <label
                className="font-metric block mb-1"
                style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
              >
                {l.toUpperCase()}
              </label>
              <input
                type={k === "fecha_ingreso" ? "date" : "text"}
                required={k === "nombre"}
                className="input-dark w-full"
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
                placeholder={ph || undefined}
                style={{ fontSize: "0.75rem" }}
              />
            </div>
          ))}
        </div>
        <div className="mb-3">
          <label
            className="font-metric block mb-1"
            style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
          >
            UNIDAD PRODUCTIVA O GRUPO
          </label>
          <select
            className="input-dark w-full"
            value={
              form.sede_ids?.length > 1
                ? (() => {
                    const g = grupos.find((g) => {
                      const groupSedes = sedes
                        .filter((s) => s.grupo_id === g.id)
                        .map((s) => s.id);
                      return (
                        groupSedes.length > 0 &&
                        groupSedes.every((id) => form.sede_ids.includes(id))
                      );
                    });
                    return g ? `G_${g.id}` : "";
                  })()
                : form.sede_ids?.[0] || ""
            }
            onChange={handleSelectSede}
            style={{ fontSize: "0.75rem", height: 34 }}
          >
            {!requireSede && <option value="">Equipo central (sin sede)</option>}
            {grupos.length > 0 && (
              <optgroup label="Grupos">
                {grupos.map((g) => (
                  <option key={`G_${g.id}`} value={`G_${g.id}`}>
                    Grupo: {g.nombre}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Sedes individuales">
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="mb-3">
          <label
            className="font-metric block mb-1"
            style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
          >
            DESCRIPCIÓN DEL PUESTO
          </label>
          <textarea
            className="input-dark w-full"
            rows={3}
            placeholder="Ej: Responsable de preparación de platos fríos y armado de pedidos"
            value={form.descripcion_puesto}
            onChange={(e) => set("descripcion_puesto", e.target.value)}
            style={{ fontSize: "0.75rem", resize: "vertical" }}
          />
        </div>
        <div className="mb-4">
          <label
            className="font-metric block mb-1"
            style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
          >
            PROCESOS QUE EJECUTA (uno por línea)
          </label>
          <textarea
            className="input-dark w-full"
            rows={4}
            placeholder="Proceso 1&#10;Proceso 2&#10;..."
            value={form.procesos_raw}
            onChange={(e) => set("procesos_raw", e.target.value)}
            style={{ fontSize: "0.75rem", resize: "vertical" }}
          />
        </div>
        {persona?.id && (
          <div className="glass p-3 mb-4" style={{ borderColor: "rgba(245,158,11,0.25)" }}>
            <p className="font-metric mb-2" style={{ fontSize: "0.65rem", color: "#f59e0b" }}>BAJA LABORAL</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="font-metric block mb-1" style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>ÚLTIMO DÍA TRABAJADO</label>
                <input type="date" className="input-dark w-full" value={form.fecha_baja} onChange={(e) => set("fecha_baja", e.target.value)} />
              </div>
              <div>
                <label className="font-metric block mb-1" style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>MOTIVO</label>
                <select className="input-dark w-full" value={form.motivo_baja} onChange={(e) => set("motivo_baja", e.target.value)}>
                  <option value="">Seleccionar...</option>
                  <option value="renuncia">Renuncia</option>
                  <option value="despido">Despido</option>
                  <option value="fin_contrato">Fin de contrato</option>
                  <option value="jubilacion">Jubilación</option>
                  <option value="fallecimiento">Fallecimiento</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            <textarea className="input-dark w-full" rows={2} placeholder="Observaciones internas del egreso" value={form.observaciones_baja} onChange={(e) => set("observaciones_baja", e.target.value)} />
            <p style={{ fontSize: "0.62rem", color: "var(--text-dim)", marginTop: 6 }}>Guardar permite programar la fecha. “Registrar baja” mueve a la persona al historial.</p>
          </div>
        )}
        <div className="flex gap-2 mt-4 justify-between">
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary flex items-center gap-1.5"
              style={{ fontSize: "0.72rem" }}
            >
              <Save size={12} /> {saving ? "Guardando..." : "Guardar persona"}
            </button>
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ fontSize: "0.72rem" }}
            >
              Cancelar
            </button>
          </div>
          {persona?.id && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="btn-ghost text-red-500 hover:bg-red-500/10"
              style={{ fontSize: "0.72rem" }}
            >
              Registrar baja
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// EquipoView — vista principal
// ──────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label
        className="font-metric block mb-1"
        style={{
          fontSize: "0.6rem",
          color: "var(--text-dim)",
          letterSpacing: "0.06em",
        }}
      >
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  );
}

function SolicitudPersonalModal({ sedes = [], personas = [], onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    puesto: "",
    sede_id: "",
    horario: "",
    fecha_apertura: today,
    urgencia: "Media",
    periodo_necesidad: "Permanente",
    motivo: "",
    cantidad: "1",
    modalidad: "",
    tareas: "",
    requisitos: "",
    experiencia: "",
    documentacion: "",
    responsable: "",
    contacto: "",
    observaciones: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const selectedSede = sedes.find((s) => String(s.id) === String(form.sede_id));

  const formatDate = (value) => {
    if (!value) return "[Completar]";
    const [y, m, d] = value.split("-");
    return y && m && d ? `${d}/${m}/${y}` : value;
  };

  const bulletLines = (raw) => {
    const lines = raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    return lines.length
      ? lines.map((x) => `* ${x}`).join("\n")
      : "* [Completar]\n* [Completar]\n* [Completar]";
  };

  const text = `SOLICITUD DE PERSONAL

📌 Puesto:
${form.puesto || "[Completar]"}

📍 Lugar de trabajo / Sede:
${selectedSede?.nombre || "[Completar]"}

🕒 Horario de trabajo:
${form.horario || "[Completar]"}

📅 Fecha de apertura de la búsqueda:
${formatDate(form.fecha_apertura)}

❗ Urgencia / Prioridad:
${form.urgencia || "[Completar]"}

📆 Período de necesidad:
${form.periodo_necesidad || "[Eventual / Permanente / Cobertura de vacaciones / Reemplazo / Refuerzo operativo]"}

🎯 Motivo de la solicitud:
${form.motivo || "[Completar]"}

👤 Cantidad de personas solicitadas:
${form.cantidad || "[Completar]"}

📃 Modalidad de contratación:
${form.modalidad || "[Completar]"}

📋 Tareas principales del puesto:
${bulletLines(form.tareas)}

✅ Requisitos del puesto:
${bulletLines(form.requisitos)}

🎓 Experiencia requerida:
${form.experiencia || "[Completar]"}

📄 Documentación / credenciales necesarias:
${form.documentacion || "[Completar]"}

🙋 Responsable solicitante:
${form.responsable || "[Completar]"}

📞 Contacto para coordinación:
${form.contacto || "[Completar]"}

📝 Observaciones:
${form.observaciones || "[Completar]"}`;

  const subject = `Solicitud de personal${form.puesto ? ` - ${form.puesto}` : ""}${selectedSede?.nombre ? ` - ${selectedSede.nombre}` : ""}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const whatsappHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.ok("Solicitud copiada al portapapeles.");
    } catch {
      toast.error(
        "No se pudo copiar automáticamente. Podés seleccionar el texto de la vista previa.",
      );
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 65 }}>
      <div
        className="glass fade-in w-full max-w-5xl"
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(57,255,20,0.2)",
          borderRadius: 4,
          maxHeight: "92vh",
          overflow: "auto",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(57,255,20,0.1)" }}
        >
          <div>
            <h2
              className="font-title font-bold"
              style={{ color: "var(--text)", fontSize: "1rem" }}
            >
              Solicitud de personal
            </h2>
            <p
              className="font-metric"
              style={{ color: "var(--text-dim)", fontSize: "0.62rem" }}
            >
              Formulario interno para RRHH / coordinación operativa
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost">
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5 p-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Puesto *">
                <input
                  className="input-dark w-full"
                  value={form.puesto}
                  onChange={(e) => set("puesto", e.target.value)}
                  placeholder="Ej: Responsable de cocina"
                  style={{ fontSize: "0.75rem" }}
                />
              </Field>
              <Field label="Sede / lugar *">
                <select
                  className="input-dark w-full"
                  value={form.sede_id}
                  onChange={(e) => set("sede_id", e.target.value)}
                  style={{ fontSize: "0.75rem", height: 34 }}
                >
                  <option value="">Seleccionar sede</option>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Horario de trabajo">
                <input
                  className="input-dark w-full"
                  value={form.horario}
                  onChange={(e) => set("horario", e.target.value)}
                  placeholder="Ej: Lunes a viernes 06:00 a 14:00"
                  style={{ fontSize: "0.75rem" }}
                />
              </Field>
              <Field label="Fecha apertura">
                <input
                  type="date"
                  className="input-dark w-full"
                  value={form.fecha_apertura}
                  onChange={(e) => set("fecha_apertura", e.target.value)}
                  style={{ fontSize: "0.75rem" }}
                />
              </Field>
              <Field label="Urgencia / prioridad">
                <select
                  className="input-dark w-full"
                  value={form.urgencia}
                  onChange={(e) => set("urgencia", e.target.value)}
                  style={{ fontSize: "0.75rem", height: 34 }}
                >
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Baja</option>
                </select>
              </Field>
              <Field label="Período de necesidad">
                <select
                  className="input-dark w-full"
                  value={form.periodo_necesidad}
                  onChange={(e) => set("periodo_necesidad", e.target.value)}
                  style={{ fontSize: "0.75rem", height: 34 }}
                >
                  <option>Eventual</option>
                  <option>Permanente</option>
                  <option>Cobertura de vacaciones</option>
                  <option>Reemplazo</option>
                  <option>Refuerzo operativo</option>
                </select>
              </Field>
              <Field label="Cantidad">
                <input
                  type="number"
                  min="1"
                  className="input-dark w-full"
                  value={form.cantidad}
                  onChange={(e) => set("cantidad", e.target.value)}
                  placeholder="Ej: 1"
                  style={{ fontSize: "0.75rem" }}
                />
              </Field>
              <Field label="Modalidad contratación">
                <input
                  className="input-dark w-full"
                  value={form.modalidad}
                  onChange={(e) => set("modalidad", e.target.value)}
                  placeholder="Ej: Relación de dependencia / eventual"
                  style={{ fontSize: "0.75rem" }}
                />
              </Field>
            </div>

            <Field label="Motivo de la solicitud">
              <textarea
                className="input-dark w-full"
                rows={2}
                value={form.motivo}
                onChange={(e) => set("motivo", e.target.value)}
                placeholder="Ej: Reemplazo por licencia / aumento de demanda / nueva operación"
                style={{ fontSize: "0.75rem", resize: "vertical" }}
              />
            </Field>
            <Field label="Tareas principales del puesto — una por línea">
              <textarea
                className="input-dark w-full"
                rows={3}
                value={form.tareas}
                onChange={(e) => set("tareas", e.target.value)}
                placeholder="Preparación de producción diaria&#10;Control de stock&#10;Limpieza del sector"
                style={{ fontSize: "0.75rem", resize: "vertical" }}
              />
            </Field>
            <Field label="Requisitos del puesto — uno por línea">
              <textarea
                className="input-dark w-full"
                rows={3}
                value={form.requisitos}
                onChange={(e) => set("requisitos", e.target.value)}
                placeholder="Disponibilidad horaria&#10;Carnet de manipulación vigente&#10;Experiencia en cocina industrial"
                style={{ fontSize: "0.75rem", resize: "vertical" }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Experiencia requerida">
                <textarea
                  className="input-dark w-full"
                  rows={2}
                  value={form.experiencia}
                  onChange={(e) => set("experiencia", e.target.value)}
                  placeholder="Ej: 1 año en comedores o cocina industrial"
                  style={{ fontSize: "0.75rem", resize: "vertical" }}
                />
              </Field>
              <Field label="Documentación / credenciales">
                <textarea
                  className="input-dark w-full"
                  rows={2}
                  value={form.documentacion}
                  onChange={(e) => set("documentacion", e.target.value)}
                  placeholder="Ej: DNI, CUIL, carnet manipulador, apto médico"
                  style={{ fontSize: "0.75rem", resize: "vertical" }}
                />
              </Field>
              <Field label="Responsable solicitante">
                <input
                  className="input-dark w-full"
                  list="responsables-equipo"
                  value={form.responsable}
                  onChange={(e) => set("responsable", e.target.value)}
                  placeholder="Ej: Nicolás Vitale"
                  style={{ fontSize: "0.75rem" }}
                />
                <datalist id="responsables-equipo">
                  {personas.map((p) => (
                    <option
                      key={p.id}
                      value={`${p.nombre} ${p.apellido || ""}`.trim()}
                    />
                  ))}
                </datalist>
              </Field>
              <Field label="Contacto coordinación">
                <input
                  className="input-dark w-full"
                  value={form.contacto}
                  onChange={(e) => set("contacto", e.target.value)}
                  placeholder="Ej: +54 9 351..."
                  style={{ fontSize: "0.75rem" }}
                />
              </Field>
            </div>
            <Field label="Observaciones">
              <textarea
                className="input-dark w-full"
                rows={2}
                value={form.observaciones}
                onChange={(e) => set("observaciones", e.target.value)}
                placeholder="Notas adicionales, restricciones, fecha ideal de ingreso..."
                style={{ fontSize: "0.75rem", resize: "vertical" }}
              />
            </Field>
          </div>

          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <p
                className="font-metric"
                style={{
                  color: "var(--phosphor)",
                  fontSize: "0.68rem",
                  letterSpacing: "0.08em",
                }}
              >
                VISTA PREVIA
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyText}
                  className="btn-ghost flex items-center gap-1.5"
                  style={{ fontSize: "0.68rem" }}
                >
                  <Copy size={11} /> Copiar
                </button>
                <a
                  href={mailHref}
                  className="btn-ghost flex items-center gap-1.5"
                  style={{ fontSize: "0.68rem", textDecoration: "none" }}
                >
                  <Mail size={11} /> Mail
                </a>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary flex items-center gap-1.5"
                  style={{ fontSize: "0.68rem", textDecoration: "none" }}
                >
                  <MessageCircle size={11} /> WhatsApp
                </a>
              </div>
            </div>
            <pre
              className="input-dark flex-1 whitespace-pre-wrap"
              style={{
                minHeight: 520,
                fontSize: "0.72rem",
                lineHeight: 1.55,
                overflow: "auto",
                padding: "1rem",
              }}
            >
              {text}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EquipoView({ onNavigate, focusId, focusType }) {
  const { can, allowedSedeIds, perfil, user } = useAuth();
  const isQualityOnly = isQualityOnlyProfile(perfil);
  const isSafetyOnly = isSafetyOnlyProfile(perfil);
  const isAdmin = perfil?.rol === "admin";
  const canManage = can("equipo", "manage") && !isSafetyOnly;
  const [personas, setPersonas] = useState([]);
  const [bajas, setBajas] = useState([]);
  const [duplicados, setDuplicados] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [search, setSearch] = useState("");
  const [sedeFilter, setSedeFilter] = useState("");
  const [tab, setTab] = useState("lista");
  const [selectedId, setSelectedId] = useState(
    !focusType || focusType === "persona" ? focusId || null : null,
  );
  const [showNew, setShowNew] = useState(false);
  const [showSolicitud, setShowSolicitud] = useState(false);
  const [showInformeNovedades, setShowInformeNovedades] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pRes, bajasRes, sRes, gRes, candidatosDuplicadosRes] = await Promise.all([
      supabase.from("v_personas").select("*").order("nombre"),
      supabase.schema("equipo").from("personas").select("id,nombre,apellido,puesto,area,sede_ids,fecha_ingreso,fecha_baja,motivo_baja,observaciones_baja,foto_url,baja_registrada_at,motivo_reactivacion").eq("activo", false).is("duplicado_de", null).not("fecha_baja", "is", null).not("motivo_baja", "is", null).order("fecha_baja", { ascending: false }),
      supabase
        .schema("bitacora")
        .from("sedes")
        .select("id, nombre, grupo_id")
        .eq("activa", true)
        .order("nombre"),
      supabase
        .schema("bitacora")
        .from("grupos")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase.schema("equipo").from("personas").select("id,nombre,apellido,puesto,email,telefono,sede_ids,activo,duplicado_de").is("duplicado_de", null),
    ]);
    const todasSedes = sRes.data || [];
    // Roles territoriales (grupo/encargado/sede) solo ven y gestionan su(s) sede(s) asignada(s)
    const sedesPermitidas =
      allowedSedeIds === null
        ? todasSedes
        : todasSedes.filter((s) => allowedSedeIds.includes(s.id));
    const gruposPermitidos =
      allowedSedeIds === null
        ? gRes.data || []
        : (gRes.data || []).filter((g) => {
            const sedesDelGrupo = todasSedes
              .filter((s) => s.grupo_id === g.id)
              .map((s) => s.id);
            return (
              sedesDelGrupo.length > 0 &&
              sedesDelGrupo.every((id) => allowedSedeIds.includes(id))
            );
          });
    const personasTerritoriales =
      allowedSedeIds === null
        ? pRes.data || []
        : (pRes.data || []).filter((p) =>
            p.sede_ids?.some((id) => allowedSedeIds.includes(id)),
          );
    const personasPermitidas = isQualityOnly
      ? personasTerritoriales.filter((p) => isQualityTeamPerson(p, perfil))
      : personasTerritoriales;
    setPersonas(personasPermitidas);
    const bajasTerritoriales = allowedSedeIds === null
      ? bajasRes.data || []
      : (bajasRes.data || []).filter((p) => p.sede_ids?.some((id) => allowedSedeIds.includes(id)));
    setBajas(isQualityOnly ? [] : bajasTerritoriales);
    const porNombre = new Map();
    for (const persona of candidatosDuplicadosRes.data || []) {
      const clave = `${persona.nombre || ""} ${persona.apellido || ""}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!clave) continue;
      porNombre.set(clave, [...(porNombre.get(clave) || []), persona]);
    }
    setDuplicados([...porNombre.values()].filter((grupo) => grupo.length > 1));
    setSedes(sedesPermitidas);
    setGrupos(gruposPermitidos);
    setLoading(false);
    hasLoadedOnce.current = true;
  };

  const reactivarPersona = async (persona) => {
    const motivo = window.prompt("Motivo de la reactivación (obligatorio):");
    if (!motivo?.trim()) return;
    if (!(await confirmar({ titulo: "Reactivar persona", mensaje: "La ficha volverá al equipo activo y la reactivación quedará registrada.", confirmText: "Reactivar" }))) return;
    const ahora = new Date().toISOString();
    const { error } = await supabase.schema("equipo").from("personas").update({
      activo: true,
      fecha_baja: null,
      motivo_baja: null,
      observaciones_baja: null,
      reactivada_at: ahora,
      reactivada_por: user?.id || null,
      motivo_reactivacion: motivo.trim(),
    }).eq("id", persona.id);
    if (error) return toast.error("No se pudo reactivar: " + mensajeError(error));
    await supabase.schema("equipo").from("historial_personal").insert({
      persona_id: persona.id,
      tipo: "otro",
      fecha: ahora.slice(0, 10),
      descripcion: `Reactivación laboral: ${motivo.trim()}`,
      registrado_por: user?.email || "Sistema",
    });
    toast.success("Persona reactivada.");
    load();
  };

  // Only re-fetch when auth-relevant fields change, not on every perfil object reference change
  const perfilRol = perfil?.rol;
  const perfilGrupoId = perfil?.grupo_id;
  const perfilSedeIds = JSON.stringify(perfil?.sede_ids);
  // load se recrea en cada render y captura los valores actuales; las deps de
  // abajo son exactamente las que deben disparar el refetch (no 'load' en sí).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [
    allowedSedeIds,
    isQualityOnly,
    isSafetyOnly,
    perfilRol,
    perfilGrupoId,
    perfilSedeIds,
  ]);
  useEffect(() => {
    if (focusType === "candidato" || focusType === "reclutamiento") {
      setSelectedId(null);
      setTab("reclutamiento");
    } else if (focusId) {
      setSelectedId(focusId);
    }
  }, [focusId, focusType]);
  useEffect(() => {
    if (
      isQualityOnly &&
      selectedId &&
      !loading &&
      !personas.some((p) => String(p.id) === String(selectedId))
    ) {
      setSelectedId(null);
    }
  }, [isQualityOnly, selectedId, loading, personas]);
  useEffect(() => {
    if (isQualityOnly && !["lista", "ranking"].includes(tab)) setTab("lista");
  }, [isQualityOnly, tab]);

  const filtered = personas.filter((p) => {
    if (sedeFilter && (!p.sede_ids || !p.sede_ids.includes(Number(sedeFilter))))
      return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.nombre +
      " " +
      (p.apellido || "") +
      " " +
      (p.legajo || "") +
      " " +
      (p.puesto || "") +
      " " +
      (p.area || "")
    )
      .toLowerCase()
      .includes(q);
  });

  const statsPersonas = sedeFilter
    ? personas.filter((p) =>
        sedeFilter === "unassigned"
          ? !p.sede_ids || p.sede_ids.length === 0
          : p.sede_ids?.includes(Number(sedeFilter)),
      )
    : personas;
  const statsPersonasEvaluadas = statsPersonas.filter(
    (p) => Number(p.puntaje_promedio || 0) > 0,
  );

  const ranking = [...personas].sort(
    (a, b) => (b.puntos_total || 0) - (a.puntos_total || 0),
  );
  const periodosPrueba = personas.map(persona=>({persona,periodo:estadoPeriodoPrueba(persona)})).filter(({periodo})=>periodo && periodo.diasRestantes>=-30 && periodo.diasRestantes<=PERIODO_PRUEBA_DIAS).sort((a,b)=>a.periodo.diasRestantes-b.periodo.diasRestantes);

  const RESULTADO_COLOR = {
    Bajo: "#ff4444",
    Aceptable: "#f59e0b",
    Alto: "#3b82f6",
    Excelente: "#39FF14",
  };

  if (
    selectedId &&
    (!isQualityOnly ||
      personas.some((p) => String(p.id) === String(selectedId)))
  )
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <PersonaFicha
          personaId={selectedId}
          sedes={sedes}
          grupos={grupos}
          onBack={() => {
            setSelectedId(null);
            load();
          }}
        />
      </div>
    );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {canManage && showNew && (
        <PersonaModal
          sedes={sedes}
          grupos={grupos}
          defaultSedeIds={allowedSedeIds?.length === 1 ? allowedSedeIds : []}
          requireSede={allowedSedeIds !== null}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
      {showSolicitud && (
        <SolicitudPersonalModal
          sedes={sedes}
          personas={personas}
          onClose={() => setShowSolicitud(false)}
        />
      )}
      {showInformeNovedades && (
        <PersonalNovedadesReportModal
          sedes={sedes}
          onClose={() => setShowInformeNovedades(false)}
        />
      )}

      {/* Header */}
      <div
        className="px-6 pt-5 pb-3 flex items-center gap-4"
        style={{ borderBottom: "1px solid rgba(57,255,20,0.1)" }}
      >
        <Users size={16} style={{ color: "var(--phosphor)", flexShrink: 0 }} />
        <div className="flex-1">
          <h1
            className="font-title font-bold text-lg"
            style={{ color: "var(--phosphor)" }}
          >
            {isQualityOnly
              ? "Equipo Calidad"
              : isSafetyOnly
                ? "Personal · consulta para Seguridad e Higiene"
                : "Equipo"}
          </h1>
          <p
            className="font-metric"
            style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
          >
            {statsPersonas.length} personas activas
          </p>
        </div>
        {!isQualityOnly && (
          <button
            onClick={() => setTab("reclutamiento")}
            className="btn-ghost flex items-center gap-1.5"
            style={{ fontSize: "0.72rem" }}
          >
            <ClipboardList size={12} /> Tablero selección
          </button>
        )}
        {(canManage || isSafetyOnly) && !isQualityOnly && (
          <button
            onClick={() => setShowInformeNovedades(true)}
            className="btn-ghost flex items-center gap-1.5"
            style={{ fontSize: "0.72rem" }}
          >
            <FileDown size={12} /> Informe de novedades
          </button>
        )}
        {canManage && !isQualityOnly && (
          <button
            onClick={() => setShowNew(true)}
            className="btn-primary flex items-center gap-1.5"
            style={{ fontSize: "0.72rem" }}
          >
            <Plus size={12} /> Nueva persona
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div
        className="grid grid-cols-4 gap-0"
        style={{ borderBottom: "1px solid rgba(57,255,20,0.06)" }}
      >
        {[
          { label: "PERSONAS", value: statsPersonas.length },
          {
            label: "PUNTAJE PROM.",
            value: statsPersonasEvaluadas.length
              ? (
                  statsPersonasEvaluadas.reduce(
                    (s, p) => s + Math.min(5, p.puntaje_promedio || 0),
                    0,
                  ) / statsPersonasEvaluadas.length
                ).toFixed(1)
              : "—",
          },
          {
            label: "LOGROS TOTALES",
            value: statsPersonas.reduce((s, p) => s + (p.logros_count || 0), 0),
          },
          {
            label: "CON INCIDENTES",
            value: statsPersonas.filter((p) => (p.incidentes || 0) > 0).length,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="py-3 px-4 text-center"
            style={{ borderRight: "1px solid rgba(57,255,20,0.06)" }}
          >
            <p
              className="font-title font-bold text-xl"
              style={{ color: "var(--phosphor)" }}
            >
              {k.value}
            </p>
            <p
              className="font-metric"
              style={{
                fontSize: "0.6rem",
                color: "var(--text-dim)",
                letterSpacing: "0.08em",
              }}
            >
              {k.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div
        className="px-6 py-2 flex items-center gap-4"
        style={{ borderBottom: "1px solid rgba(57,255,20,0.06)" }}
      >
        <div className="flex gap-0">
          {[
            ["lista", "LISTA"],
            ["ranking", "RANKING"],
            ["organigrama", "ORGANIGRAMA"],
            ["vacaciones", "VACACIONES"],
            ...(canManage ? [["periodo-prueba", `PERÍODO DE PRUEBA (${periodosPrueba.length})`]] : []),
            ...(isAdmin ? [["credenciales", "CREDENCIALES EMITIDAS"]] : []),
            ["bajas", `HISTORIAL DE BAJAS (${bajas.length})`],
            ...(canManage ? [["duplicados", `DUPLICADOS (${duplicados.length})`]] : []),
            ["reclutamiento", "SELECCIÓN"],
            ["contactos", "CONTACTOS"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                if (isQualityOnly && !["lista", "ranking"].includes(id)) return;
                setTab(id);
              }}
              className="font-metric px-4 py-1.5"
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.08em",
                background: tab === id ? "rgba(57,255,20,0.1)" : "transparent",
                color: tab === id ? "var(--phosphor)" : "var(--text-dim)",
                opacity:
                  isQualityOnly && !["lista", "ranking"].includes(id)
                    ? 0.35
                    : 1,
                borderBottom:
                  tab === id
                    ? "2px solid var(--phosphor)"
                    : "2px solid transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "lista" && (
          <div className="flex-1 flex justify-end gap-3">
            <select
              className="input-dark px-2"
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              style={{ fontSize: "0.75rem", height: 30, width: 180 }}
            >
              <option value="">Todas las escalas</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <div className="relative" style={{ width: 180 }}>
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-dim)" }}
              />
              <input
                className="input-dark w-full pl-7"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: "0.75rem", height: 30 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === "contactos" ? (
          <ContactosTab modulo="rrhh" />
        ) : tab === "reclutamiento" ? (
          <ReclutamientoBoard
            sedes={sedes}
            canManage={canManage}
            allowedSedeIds={allowedSedeIds}
            focusCandidateId={focusType === "candidato" ? focusId : null}
            onBack={() => setTab("lista")}
          />
        ) : tab === "organigrama" ? (
          <OrganigramaView onNavigate={onNavigate} />
        ) : tab === "vacaciones" ? (
          <VacacionesPanel personas={personas} sedes={sedes} canManage={canManage} />
        ) : tab === "periodo-prueba" ? (
          <div className="max-w-5xl space-y-3">
            <div className="glass p-4 flex items-center justify-between gap-4"><div><p className="font-title font-bold" style={{color:"var(--phosphor)"}}>PERÍODOS DE PRUEBA · 180 DÍAS</p><p style={{color:"var(--text-dim)",fontSize:'.72rem',marginTop:4}}>Cuenta regresiva automática desde la fecha de ingreso. Planta Córdoba no se incluye.</p></div><div className="text-right"><p className="font-title font-bold text-xl" style={{color:"var(--phosphor)"}}>{periodosPrueba.filter(({periodo})=>periodo.diasRestantes>=0).length}</p><p className="font-metric" style={{color:"var(--text-dim)",fontSize:'.58rem'}}>VIGENTES</p></div></div>
            {periodosPrueba.length===0 ? <div className="glass p-8 text-center" style={{color:"var(--text-dim)"}}>No hay personas dentro del período de prueba.</div> : periodosPrueba.map(({persona,periodo})=>{const sedeNombres=sedes.filter(s=>persona.sede_ids?.includes(s.id)).map(s=>s.nombre).join(' · ')||'Sin sede';const color=colorPeriodoPrueba(periodo.diasRestantes);return <button key={persona.id} onClick={()=>setSelectedId(persona.id)} className="glass w-full p-4 flex items-center gap-4 text-left" style={{borderLeft:`4px solid ${color}`}}><PersonaAvatar persona={persona} size={44}/><div className="flex-1 min-w-0"><p className="font-title font-bold" style={{color:'var(--text)'}}>{persona.nombre} {persona.apellido||''}</p><p style={{color:'var(--text-dim)',fontSize:'.7rem'}}>Legajo {persona.legajo||'sin cargar'} · {sedeNombres}</p><p style={{color:'var(--text-dim)',fontSize:'.66rem',marginTop:4}}>Ingreso: {fmtFechaLarga(persona.fecha_ingreso)} · Fin de prueba: {fmtFechaLarga(periodo.vencimiento.toISOString().slice(0,10))}</p></div><div className="text-right"><p className="font-title font-bold" style={{color,fontSize:'1rem'}}>{textoPeriodoPrueba(periodo.diasRestantes)}</p><p className="font-metric" style={{color:'var(--text-dim)',fontSize:'.58rem',marginTop:3}}>180 DÍAS</p></div><ChevronRight size={16} style={{color:'var(--text-dim)'}}/></button>})}
          </div>
        ) : tab === "credenciales" ? (
          <CredencialesMasivasA4 personas={personas} sedes={sedes} />
        ) : tab === "duplicados" ? (
          <div className="max-w-5xl space-y-4">
            <div className="glass p-4">
              <p className="font-title font-bold" style={{ color: "var(--phosphor)" }}>REVISIÓN DE POSIBLES DUPLICADOS</p>
              <p style={{ fontSize: "0.76rem", color: "var(--text-dim)", marginTop: 4 }}>Se comparan nombres normalizados. La consolidación nunca elimina una ficha ni su historial.</p>
            </div>
            {duplicados.length === 0 ? <div className="glass p-8 text-center" style={{ color: "var(--text-dim)" }}>No hay coincidencias pendientes.</div> :
              duplicados.map((grupo) => (
                <div key={grupo.map((p) => p.id).join("-")} className="glass p-4">
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
                    {grupo.map((p) => (
                      <div key={p.id} className="p-3" style={{ border: "1px solid rgba(57,255,20,0.15)", borderRadius: 6 }}>
                        <p className="font-title font-bold">{p.nombre} {p.apellido || ""}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{p.puesto || "Sin puesto"} · {p.activo ? "ACTIVA" : "INACTIVA"}</p>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 6 }}>{p.email || "Sin email"}{p.telefono ? ` · ${p.telefono}` : ""}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: "0.68rem", color: "#f59e0b", marginTop: 10 }}>Requiere revisión humana antes de consolidar porque ambas fichas contienen datos diferentes.</p>
                </div>
              ))}
          </div>
        ) : tab === "bajas" ? (
          <div className="max-w-5xl space-y-3">
            {personas.filter((p) => p.fecha_baja).length > 0 && (
              <div className="glass p-4" style={{ borderColor: "rgba(245,158,11,0.35)" }}>
                <p className="font-title font-bold" style={{ color: "#f59e0b" }}>BAJAS PROGRAMADAS</p>
                {personas.filter((p) => p.fecha_baja).map((p) => (
                  <div key={p.id} className="flex items-center justify-between mt-2">
                    <span>{p.nombre} {p.apellido || ""}</span>
                    <span className="font-metric" style={{ fontSize: "0.68rem" }}>{fmtFechaLarga(p.fecha_baja)}</span>
                  </div>
                ))}
              </div>
            )}
            {bajas.length === 0 ? (
              <div className="glass p-8 text-center" style={{ color: "var(--text-dim)" }}>No hay bajas registradas.</div>
            ) : bajas.map((p) => (
              <div key={p.id} className="glass p-4 flex items-center gap-4">
                <PersonaAvatar persona={p} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="font-title font-bold" style={{ color: "var(--text)" }}>{p.nombre} {p.apellido || ""}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{p.puesto || "Sin puesto"}{p.area ? ` · ${p.area}` : ""}</p>
                  {p.observaciones_baja && <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 5 }}>{p.observaciones_baja}</p>}
                </div>
                <div className="text-right">
                  <p className="font-metric" style={{ fontSize: "0.68rem", color: "#f59e0b" }}>{(p.motivo_baja || "otro").replaceAll("_", " ").toUpperCase()}</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{p.fecha_baja ? fmtFechaLarga(p.fecha_baja) : "Fecha no informada"}</p>
                  {canManage && <button className="btn-ghost mt-2" onClick={() => reactivarPersona(p)}>REACTIVAR</button>}
                </div>
              </div>
            ))}
          </div>
        ) : loading && !hasLoadedOnce.current ? (
          <div className="flex items-center justify-center h-40">
            <Loader2
              size={20}
              className="animate-spin"
              style={{ color: "var(--phosphor)" }}
            />
          </div>
        ) : tab === "lista" ? (
          <div
            className="flex gap-4 h-full overflow-x-auto pb-4"
            style={{ alignItems: "flex-start" }}
          >
            {/* Columnas por Sede */}
            {[{ id: "unassigned", nombre: "Equipo central" }, ...sedes]
              .filter((s) =>
                sedeFilter
                  ? s.id === Number(sedeFilter) ||
                    (sedeFilter === "unassigned" && s.id === "unassigned")
                  : true,
              )
              .map((sede) => {
                const isUnassigned = sede.id === "unassigned";
                const personasSede = filtered.filter((p) =>
                  isUnassigned
                    ? !p.sede_ids || p.sede_ids.length === 0
                    : p.sede_ids?.includes(sede.id),
                );

                if (personasSede.length === 0 && isUnassigned) return null; // Hide unassigned if empty
                if (
                  personasSede.length === 0 &&
                  sedeFilter !== String(sede.id) &&
                  sedeFilter !== ""
                )
                  return null; // Hide empty ones when filtered

                const personasSedeEvaluadas = personasSede.filter(
                  (p) => Number(p.puntaje_promedio || 0) > 0,
                );
                const avgSede =
                  personasSedeEvaluadas.reduce(
                    (acc, p) => acc + Math.min(5, p.puntaje_promedio || 0),
                    0,
                  ) / (personasSedeEvaluadas.length || 1);
                const incSede = personasSede.filter(
                  (p) => (p.incidentes || 0) > 0,
                ).length;

                return (
                  <div
                    key={sede.id}
                    className="flex-shrink-0 flex flex-col gap-3"
                    style={{
                      width: sedeFilter ? "100%" : 320,
                      background: "rgba(255,255,255,0.02)",
                      padding: "12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {/* Header Columna */}
                    <div
                      className="flex items-center justify-between mb-1"
                      style={{
                        borderBottom: "1px solid rgba(57,255,20,0.1)",
                        paddingBottom: "8px",
                      }}
                    >
                      <h3
                        className="font-title font-bold text-sm"
                        style={{ color: "var(--phosphor)" }}
                      >
                        {sede.nombre}
                      </h3>
                      <span
                        className="font-metric"
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--text-dim)",
                        }}
                      >
                        {personasSede.length} pers.
                      </span>
                    </div>
                    {/* KPIs Columna */}
                    {!isUnassigned && personasSede.length > 0 && (
                      <div className="flex justify-between mb-2 px-1">
                        <div className="text-center">
                          <p
                            className="font-title font-bold"
                            style={{
                              fontSize: "0.85rem",
                              color: "var(--phosphor)",
                            }}
                          >
                            {personasSedeEvaluadas.length ? avgSede.toFixed(1) : "—"}
                          </p>
                          <p
                            className="font-metric"
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-dim)",
                            }}
                          >
                            PROM.
                          </p>
                        </div>
                        <div className="text-center">
                          <p
                            className="font-title font-bold"
                            style={{
                              fontSize: "0.85rem",
                              color: "var(--phosphor)",
                            }}
                          >
                            {incSede}
                          </p>
                          <p
                            className="font-metric"
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-dim)",
                            }}
                          >
                            CON INC.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Tarjetas */}
                    <div
                      className={sedeFilter
                        ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto"
                        : "flex flex-col gap-3 overflow-y-auto"}
                      style={{ maxHeight: "calc(100vh - 280px)" }}
                    >
                      {personasSede.map((p) => {
                        const score = Math.min(5, p.puntaje_promedio || 0);
                        const periodoPrueba = estadoPeriodoPrueba(p);
                        const mostrarPeriodoPrueba = periodoPrueba && periodoPrueba.diasRestantes >= -30 && periodoPrueba.diasRestantes <= PERIODO_PRUEBA_DIAS;
                        const periodoColor = mostrarPeriodoPrueba ? colorPeriodoPrueba(periodoPrueba.diasRestantes) : null;
                        const evalColor = score
                          ? RESULTADO_COLOR[p.resultado_global] || "var(--text)"
                          : "var(--text-dim)";
                        return (
                          <div
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className="glass p-4 rounded cursor-pointer transition-colors relative group hover:border-phosphor/30"
                            style={{
                              border: periodoColor ? `2px solid ${periodoColor}` : undefined,
                              boxShadow: periodoColor ? `0 0 0 1px ${periodoColor}22, 0 0 14px ${periodoColor}12` : undefined,
                              borderLeft:
                                p.incidentes > 0
                                  ? "2px solid #ff4444"
                                  : periodoColor ? `2px solid ${periodoColor}` : "2px solid transparent",
                            }}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <PersonaAvatar persona={p} size={44} />
                                <div>
                                <h3
                                  className="font-title font-bold text-base group-hover:text-[var(--phosphor)] transition-colors"
                                  style={{ color: "var(--text)" }}
                                >
                                  {p.nombre} {p.apellido}
                                </h3>
                                <p
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-dim)",
                                  }}
                                >
                                  {p.puesto || "Sin puesto"}
                                </p>
                                </div>
                              </div>
                              <ChevronRight
                                size={16}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: "var(--phosphor)" }}
                              />
                            </div>
                            {mostrarPeriodoPrueba && (
                              <div className="flex items-center justify-between mt-3 px-2 py-1.5 rounded" style={{ background:`${periodoColor}12`, border:`1px solid ${periodoColor}44` }}>
                                <span className="font-metric" style={{ color:periodoColor, fontSize:'.62rem' }}>PERÍODO DE PRUEBA</span>
                                <span className="font-title font-bold" style={{ color:periodoColor, fontSize:'.72rem' }}>{textoPeriodoPrueba(periodoPrueba.diasRestantes)}</span>
                              </div>
                            )}
                            {(p.telefono || p.email) && (
                              <div className="flex items-center gap-2 mt-2" onClick={(event) => event.stopPropagation()}>
                                {p.telefono && (
                                  <a
                                    href={`tel:${p.telefono.replace(/\D/g, "")}`}
                                    className="btn-ghost p-1.5"
                                    title="Llamar"
                                    aria-label={`Llamar a ${p.nombre}`}
                                  >
                                    <Phone size={13} />
                                  </a>
                                )}
                                {p.telefono && (
                                  <a
                                    href={`https://wa.me/${(() => {
                                      const digits = p.telefono.replace(/\D/g, "").replace(/^0+/, "");
                                      if (digits.startsWith("549")) return digits;
                                      if (digits.startsWith("54")) return `549${digits.slice(2).replace(/^9/, "")}`;
                                      return `549${digits.replace(/^9/, "")}`;
                                    })()}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn-ghost p-1.5"
                                    title="Enviar mensaje por WhatsApp"
                                    aria-label={`Enviar mensaje a ${p.nombre}`}
                                  >
                                    <MessageCircle size={13} />
                                  </a>
                                )}
                                {p.email && (
                                  <a
                                    href={`mailto:${p.email.trim()}`}
                                    className="btn-ghost p-1.5"
                                    title="Enviar email"
                                    aria-label={`Enviar email a ${p.nombre}`}
                                  >
                                    <Mail size={13} />
                                  </a>
                                )}
                              </div>
                            )}
                            <div
                              className="flex items-center justify-between mt-3 pt-3"
                              style={{
                                borderTop: "1px solid rgba(255,255,255,0.05)",
                              }}
                            >
                              {score ? (
                                <div>
                                  <span
                                    className="font-title font-bold text-lg"
                                    style={{ color: evalColor }}
                                  >
                                    {score.toFixed(1)}
                                  </span>
                                  <span
                                    className="ml-2 font-metric"
                                    style={{
                                      fontSize: "0.65rem",
                                      color: evalColor,
                                    }}
                                  >
                                    {p.resultado_global}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className="font-metric"
                                  style={{
                                    fontSize: "0.65rem",
                                    color: "var(--text-dim)",
                                  }}
                                >
                                  Sin evaluaciones
                                </span>
                              )}
                              {p.incidentes > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded font-metric"
                                  style={{
                                    fontSize: "0.6rem",
                                    background: "rgba(255,68,68,0.1)",
                                    color: "#ff4444",
                                  }}
                                >
                                  {p.incidentes} incidentes
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {personasSede.length === 0 && (
                        <p
                          className="text-center font-metric mt-4"
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          Sin personas
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          // Ranking tab
          <div className="max-w-2xl space-y-2">
            {ranking.map((p, i) => {
              const puntaje = Math.min(5, p.puntaje_promedio || 0);
              const res =
                puntaje > 0
                  ? puntaje < 2
                    ? "Bajo"
                    : puntaje < 3
                      ? "Aceptable"
                      : puntaje < 4.5
                        ? "Alto"
                        : "Excelente"
                  : null;
              const medal =
                i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="glass w-full p-3 flex items-center gap-4 text-left"
                  style={{
                    border:
                      i < 3
                        ? "1px solid rgba(57,255,20,0.15)"
                        : "1px solid rgba(57,255,20,0.06)",
                    borderRadius: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: i < 3 ? "1.3rem" : "0.8rem",
                      minWidth: 32,
                      textAlign: "center",
                      color: "var(--text-dim)",
                    }}
                  >
                    {medal}
                  </span>
                  <div className="flex-1">
                    <p style={{ fontSize: "0.83rem", color: "var(--text)" }}>
                      {p.nombre} {p.apellido || ""}
                    </p>
                    <p
                      style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}
                    >
                      {p.puesto || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="font-title font-bold"
                      style={{ color: "var(--phosphor)", fontSize: "1rem" }}
                    >
                      {p.puntos_total || 0}
                    </p>
                    <p style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>
                      puntos
                    </p>
                  </div>
                  {res && (
                    <span
                      className="font-metric"
                      style={{
                        fontSize: "0.62rem",
                        color: RESULTADO_COLOR[res],
                        minWidth: 56,
                        textAlign: "right",
                      }}
                    >
                      {res}
                    </span>
                  )}
                  <ChevronRight
                    size={12}
                    style={{ color: "rgba(57,255,20,0.3)" }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
