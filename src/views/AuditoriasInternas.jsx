import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  ClipboardCheck,
  CalendarDays,
  UserRound,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Share2,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  createAuditoriaHallazgo,
  createAuditoriaInterna,
  createCapa,
  createNoConformidad,
  getAuditoriaInterna,
  getAuditoriaPlantillas,
  getAuditoriasInternas,
  getPerfiles,
  getSedes,
  updateAuditoriaHallazgo,
  updateAuditoriaInterna,
  upsertAuditoriaRespuestas,
} from "../lib/queries";
import AdjuntosPanel from "../components/AdjuntosPanel";
import AuditoriaInforme from "./AuditoriaInforme";
import { generarInformeAuditoriaPDF } from "../lib/auditoriaReportPdf";
import { toast } from "../lib/feedback";
import { mensajeError } from "../lib/errores";
import {
  AUDITORIA_PUNTOS,
  calcularCumplimientoAuditoria,
  clasificarAuditoria,
  filtrarAuditoresElegibles,
  resumirPuntajeAuditoria,
} from "../lib/auditoriaScore";

const VALUES = ["Cumple", "Parcial", "No cumple", "No observado"];
const STATUS_COLOR = {
  Borrador: "#9ca3af",
  Programada: "#60a5fa",
  "En curso": "#f59e0b",
  Finalizada: "#a78bfa",
  Cerrada: "#39ff14",
  Cancelada: "#ef4444",
};
const SPECIAL_ALL = new Set([
  "tecnica@flykitchen.com.ar",
  "rrhh.higieneyseguridad.emp@gmail.com",
]);
const canManageAudit = (perfil, sedeTipo = "") => {
  const email = String(perfil?.email || "").toLowerCase();
  if (email === "mriviere@flykitchen.com.ar")
    return String(sedeTipo).toLowerCase() === "aeropuerto";
  return ["admin", "editor"].includes(perfil?.rol) || SPECIAL_ALL.has(email);
};

const auditoriaUrl = () =>
  "https://bitacora-dashboard.vercel.app/?view=calidadHub";

function textoCompartirAuditoria(
  audit,
  score,
  scoreSummary,
  resumen,
  conclusiones,
) {
  const hallazgos = (audit.auditoria_hallazgos || [])
    .map((h) => `- ${h.numero}. ${h.titulo} (${h.criticidad} · ${h.estado})`)
    .join("\n");
  return [
    `AUDITORÍA ${audit.codigo}`,
    `Sede: ${audit.sedes?.nombre || "—"}`,
    `Fecha: ${audit.fecha_programada || "—"}`,
    `Resultado: ${clasificarAuditoria(score) || audit.resultado || "En evaluación"}`,
    `Cumplimiento: ${score == null ? "—" : `${score}%`} (${scoreSummary.obtenido}/${scoreSummary.maximo} puntos)`,
    `Respuestas: ${scoreSummary.cumple} cumple · ${scoreSummary.parcial} parcial · ${scoreSummary.noCumple} no cumple · ${scoreSummary.noObservado} no observado`,
    resumen ? `\nResumen ejecutivo:\n${resumen}` : "",
    conclusiones ? `\nConclusiones y prioridades:\n${conclusiones}` : "",
    hallazgos ? `\nHallazgos:\n${hallazgos}` : "\nSin hallazgos registrados.",
    `\nConsultar en Fly Gestión: ${auditoriaUrl()}`,
    "El acceso al detalle requiere iniciar sesión y contar con permisos para la sede.",
  ]
    .filter(Boolean)
    .join("\n");
}

function Modal({ children, onClose, wide = false }) {
  return (
    <div className="modal-overlay">
      <div
        className="glass rounded max-h-[92vh] overflow-y-auto"
        style={{ width: wide ? "min(1100px,96vw)" : "min(620px,94vw)" }}
      >
        {children}
      </div>
    </div>
  );
}

function NewAudit({
  sedes,
  plantillas,
  perfiles,
  fixedSedeId,
  initialAudit = null,
  onClose,
  onCreated,
}) {
  const { user, perfil } = useAuth();
  const [busy, setBusy] = useState(false);
  const draftKey = `fly-gestion.auditoria-draft.${initialAudit?.id || fixedSedeId || "nueva"}`;
  const initialForm = initialAudit
    ? {
        sede_id: initialAudit.sede_id || "",
        plantilla_id: initialAudit.plantilla_id || "",
        tipo_auditoria: initialAudit.tipo_auditoria || "Integral",
        fecha_programada: initialAudit.fecha_programada || "",
        objetivo: initialAudit.objetivo || "",
        alcance: initialAudit.alcance || "",
        normativa: initialAudit.normativa || "",
        participantes: initialAudit.participantes || [],
      }
    : {
        sede_id: fixedSedeId || "",
        plantilla_id: plantillas[0]?.id || "",
        tipo_auditoria: "Integral",
        fecha_programada: new Date().toISOString().slice(0, 10),
        objetivo: "",
        alcance: "",
        normativa: plantillas[0]?.normativa || "",
        participantes: [],
      };
  const [form, setForm] = useState(() => {
    try {
      return {
        ...initialForm,
        ...JSON.parse(localStorage.getItem(draftKey) || "{}"),
      };
    } catch {
      return initialForm;
    }
  });
  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [draftKey, form]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const sedeSeleccionada = sedes.find(
    (s) => String(s.id) === String(form.sede_id),
  );
  const auditores = filtrarAuditoresElegibles(perfiles, sedeSeleccionada?.tipo);
  const toggleParticipante = (nombre) =>
    set(
      "participantes",
      form.participantes.includes(nombre)
        ? form.participantes.filter((x) => x !== nombre)
        : [...form.participantes, nombre],
    );
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, sede_id: Number(form.sede_id) };
      const row = initialAudit
        ? await updateAuditoriaInterna(initialAudit.id, payload)
        : await createAuditoriaInterna({
            ...payload,
            auditor_id: user.id,
            auditor_nombre: perfil?.nombre || user.email,
            estado: "Programada",
            created_by: user.id,
          });
      localStorage.removeItem(draftKey);
      toast.ok(
        initialAudit
          ? "Datos de la auditoría actualizados."
          : `Auditoría ${row.codigo} creada.`,
      );
      onCreated(row);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(57,255,20,.12)" }}
        >
          <div>
            <h2 className="font-title font-bold">
              {initialAudit
                ? "Editar auditoría interna"
                : "Nueva auditoría interna"}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              La auditoría quedará vinculada a la sede y a su plan de acción.
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs">
            Sede
            <select
              required
              className="input-dark mt-1"
              value={form.sede_id}
              onChange={(e) => set("sede_id", e.target.value)}
              disabled={Boolean(fixedSedeId)}
            >
              <option value="">Seleccionar</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} · {s.tipo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Fecha programada
            <input
              required
              type="date"
              className="input-dark mt-1"
              value={form.fecha_programada}
              onChange={(e) => set("fecha_programada", e.target.value)}
            />
          </label>
          <label className="text-xs col-span-2">
            Plantilla
            <select
              required
              disabled={Boolean(initialAudit)}
              className="input-dark mt-1"
              value={form.plantilla_id}
              onChange={(e) => {
                const p = plantillas.find((x) => x.id === e.target.value);
                set("plantilla_id", e.target.value);
                set("tipo_auditoria", p?.tipo_auditoria || "Integral");
                set("normativa", p?.normativa || "");
              }}
            >
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · V{p.version}
                </option>
              ))}
            </select>
            {initialAudit && (
              <small style={{ color: "var(--text-dim)" }}>
                La plantilla no se cambia para conservar las respuestas
                existentes.
              </small>
            )}
          </label>
          <label className="text-xs">
            Tipo
            <select
              className="input-dark mt-1"
              value={form.tipo_auditoria}
              onChange={(e) => set("tipo_auditoria", e.target.value)}
            >
              {[
                "Integral",
                "Operativa",
                "Calidad e Inocuidad",
                "Seguridad e Higiene",
                "Seguimiento",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <fieldset className="text-xs">
            <legend>Equipo auditor / participantes</legend>
            <div
              className="mt-1 rounded p-2 max-h-36 overflow-y-auto space-y-1"
              style={{
                border: "1px solid rgba(255,255,255,.14)",
                background: "var(--bg-deep)",
              }}
            >
              {!form.sede_id ? (
                <p style={{ color: "var(--text-dim)" }}>
                  Primero seleccioná una sede.
                </p>
              ) : auditores.length === 0 ? (
                <p style={{ color: "var(--text-dim)" }}>
                  No hay usuarios habilitados.
                </p>
              ) : (
                auditores.map((p) => {
                  const nombre = p.nombre || p.email;
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded px-2 py-1 cursor-pointer hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={form.participantes.includes(nombre)}
                        onChange={() => toggleParticipante(nombre)}
                      />
                      <span>{nombre}</span>
                      <small style={{ color: "var(--text-dim)" }}>
                        {p.rol} · {p.email}
                      </small>
                    </label>
                  );
                })
              )}
            </div>
          </fieldset>
          <label className="text-xs col-span-2">
            Objetivo
            <textarea
              className="input-dark mt-1"
              rows="2"
              value={form.objetivo}
              onChange={(e) => set("objetivo", e.target.value)}
            />
          </label>
          <label className="text-xs col-span-2">
            Alcance
            <textarea
              className="input-dark mt-1"
              rows="2"
              value={form.alcance}
              onChange={(e) => set("alcance", e.target.value)}
            />
          </label>
          <label className="text-xs col-span-2">
            Normativa / criterios
            <textarea
              className="input-dark mt-1"
              rows="2"
              value={form.normativa}
              onChange={(e) => set("normativa", e.target.value)}
              placeholder="ISO 9001, BPM, requisitos del cliente..."
            />
          </label>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={busy || !form.sede_id}>
            {busy
              ? "Guardando..."
              : initialAudit
                ? "Guardar cambios"
                : "Crear auditoría"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FindingForm({ audit, onClose, onSaved }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const next = (audit.auditoria_hallazgos?.length || 0) + 1;
  const [f, setF] = useState({
    numero: next,
    tipo: "Observación",
    criticidad: "Media",
    titulo: "",
    descripcion: "",
    contencion_inmediata: "",
    accion_propuesta: "",
    responsable_nombre: "",
    fecha_limite: "",
    criterio_cierre: "",
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const h = await createAuditoriaHallazgo({
        ...f,
        auditoria_id: audit.id,
        fecha_limite: f.fecha_limite || null,
        created_by: user.id,
      });
      toast.ok("Hallazgo agregado.");
      onSaved(h);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <div className="flex justify-between px-6 py-4">
          <h2 className="font-title font-bold">Nuevo hallazgo #{next}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            className="input-dark"
            value={f.tipo}
            onChange={(e) => set("tipo", e.target.value)}
          >
            {["Observación", "Oportunidad de mejora", "No conformidad"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
          <select
            className="input-dark"
            value={f.criticidad}
            onChange={(e) => set("criticidad", e.target.value)}
          >
            {["Crítica", "Alta", "Media", "Baja"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input
            required
            className="input-dark col-span-2"
            placeholder="Título"
            value={f.titulo}
            onChange={(e) => set("titulo", e.target.value)}
          />
          <textarea
            required
            className="input-dark col-span-2"
            rows="3"
            placeholder="Descripción y evidencia observada"
            value={f.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
          />
          <textarea
            className="input-dark col-span-2"
            rows="2"
            placeholder="Contención inmediata"
            value={f.contencion_inmediata}
            onChange={(e) => set("contencion_inmediata", e.target.value)}
          />
          <textarea
            className="input-dark col-span-2"
            rows="2"
            placeholder="Acción correctiva o preventiva propuesta"
            value={f.accion_propuesta}
            onChange={(e) => set("accion_propuesta", e.target.value)}
          />
          <input
            className="input-dark"
            placeholder="Responsable"
            value={f.responsable_nombre}
            onChange={(e) => set("responsable_nombre", e.target.value)}
          />
          <input
            type="date"
            className="input-dark"
            value={f.fecha_limite}
            onChange={(e) => set("fecha_limite", e.target.value)}
          />
          <input
            className="input-dark col-span-2"
            placeholder="Criterio o evidencia requerida para el cierre"
            value={f.criterio_cierre}
            onChange={(e) => set("criterio_cierre", e.target.value)}
          />
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Guardando..." : "Guardar hallazgo"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function AuditDetail({ id, sedes, plantillas, perfiles, onBack, mobile = false }) {
  const { user, perfil, can } = useAuth();
  const [audit, setAudit] = useState(null),
    [answers, setAnswers] = useState({}),
    [busy, setBusy] = useState(false),
    [finding, setFinding] = useState(false),
    [editing, setEditing] = useState(false),
    [resumenFinal, setResumenFinal] = useState(""),
    [conclusiones, setConclusiones] = useState(""),
    [modoEdicion, setModoEdicion] = useState(false),
    [mobileQuestionIndex, setMobileQuestionIndex] = useState(0);
  const load = useCallback(async () => {
    try {
      const a = await getAuditoriaInterna(id);
      setAudit(a);
      setResumenFinal(a.resumen || "");
      setConclusiones(a.conclusiones || "");
      const loadedAnswers = Object.fromEntries(
        (a.auditoria_respuestas || []).map((r) => [
          r.pregunta_id,
          { valor: r.valor, observacion: r.observacion || "" },
        ]),
      );
      setAnswers(loadedAnswers);
      if (mobile) {
        const loadedQuestions = a.auditoria_plantillas?.auditoria_secciones?.flatMap(
          (section) => section.auditoria_preguntas || [],
        ) || [];
        const firstPending = loadedQuestions.findIndex((question) => !loadedAnswers[question.id]?.valor);
        setMobileQuestionIndex(firstPending >= 0 ? firstPending : loadedQuestions.length);
      }
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }, [id, mobile]);
  useEffect(() => {
    load();
  }, [load]);
  const questions = useMemo(
    () =>
      audit?.auditoria_plantillas?.auditoria_secciones?.flatMap(
        (s) => s.auditoria_preguntas || [],
      ) || [],
    [audit],
  );
  const score = useMemo(
    () => calcularCumplimientoAuditoria(questions, answers),
    [questions, answers],
  );
  const scoreSummary = useMemo(
    () => resumirPuntajeAuditoria(questions, answers),
    [questions, answers],
  );
  const answered = questions.filter((q) => answers[q.id]?.valor).length;
  if (!audit)
    return (
      <div className="p-8 text-center" style={{ color: "var(--text-dim)" }}>
        Cargando auditoría...
      </div>
    );
  const canManage = canManageAudit(perfil, audit.sedes?.tipo);
  // Finalizada/Cerrada se muestran como informe de lectura, no como formulario.
  const esInforme =
    ["Finalizada", "Cerrada"].includes(audit.estado) && !modoEdicion;
  const canShare =
    perfil?.rol === "admin" && ["Finalizada", "Cerrada"].includes(audit.estado);
  const shareText = () =>
    textoCompartirAuditoria(
      audit,
      score,
      scoreSummary,
      resumenFinal,
      conclusiones,
    );
  const shareWhatsApp = () =>
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText())}`,
      "_blank",
      "noopener,noreferrer",
    );
  const shareEmail = () =>
    window.open(
      `mailto:?subject=${encodeURIComponent(`${audit.codigo} · ${audit.sedes?.nombre || "Auditoría"}`)}&body=${encodeURIComponent(shareText())}`,
      "_blank",
    );
  const shareChatGPT = async () => {
    await navigator.clipboard.writeText(
      `Analizá esta auditoría, identificá prioridades y proponé mejoras concretas:\n\n${shareText()}`,
    );
    toast.ok("Informe copiado. Pegalo en el chat de ChatGPT que se abrirá.");
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  };
  const shareNative = async () => {
    const data = {
      title: `${audit.codigo} · ${audit.sedes?.nombre || "Auditoría"}`,
      text: shareText(),
      url: auditoriaUrl(),
    };
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
      toast.ok("Informe copiado para compartir.");
    }
  };
  const save = async (finalize = false, quiet = false, reloadAfter = true) => {
    setBusy(true);
    try {
      const rows = questions
        .filter((q) => answers[q.id]?.valor)
        .map((q) => ({
          auditoria_id: audit.id,
          pregunta_id: q.id,
          valor: answers[q.id].valor,
          puntaje:
            answers[q.id].valor === "No observado"
              ? null
              : AUDITORIA_PUNTOS[answers[q.id].valor],
          observacion: answers[q.id].observacion || null,
          respondido_por: user.id,
        }));
      await upsertAuditoriaRespuestas(rows);
      if (canManage) {
        await updateAuditoriaInterna(audit.id, {
          porcentaje_cumplimiento: score,
          resultado: clasificarAuditoria(score),
          resumen: resumenFinal || null,
          conclusiones: conclusiones || null,
          estado: finalize ? "Finalizada" : "En curso",
          fecha_inicio: audit.fecha_inicio || new Date().toISOString(),
          ...(finalize ? { fecha_finalizacion: new Date().toISOString() } : {}),
        });
      }
      if (!quiet) toast.ok(finalize ? "Auditoría finalizada." : "Avance guardado.");
      if (reloadAfter) await load();
      return true;
    } catch (e) {
      toast.error(mensajeError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const makeNC = async (h) => {
    try {
      const nc = await createNoConformidad({
        sede_id: audit.sede_id,
        sede_nombre: audit.sedes?.nombre,
        descripcion: `${audit.codigo} · ${h.titulo}\n${h.descripcion}`,
        categoria:
          audit.tipo_auditoria === "Seguridad e Higiene"
            ? "Seguridad, Higiene y Medio Ambiente"
            : "Higiene",
        responsable: h.responsable_nombre || null,
        estado: "Abierta",
        created_by: user.id,
      });
      await updateAuditoriaHallazgo(h.id, { no_conformidad_id: nc.id });
      toast.ok(`${nc.codigo} generada.`);
      load();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  };
  const makeCapa = async (h) => {
    try {
      let ncId = h.no_conformidad_id;
      if (!ncId) {
        const nc = await createNoConformidad({
          sede_id: audit.sede_id,
          sede_nombre: audit.sedes?.nombre,
          descripcion: `${audit.codigo} · ${h.titulo}\n${h.descripcion}`,
          categoria: "Higiene",
          responsable: h.responsable_nombre || null,
          estado: "Abierta",
          created_by: user.id,
        });
        ncId = nc.id;
      }
      const capa = await createCapa({
        tipo: "Correctiva",
        no_conformidad_id: ncId,
        descripcion: `Hallazgo: ${h.descripcion} Acción: ${h.accion_propuesta || "Definir acción correctiva."}`,
        responsable: h.responsable_nombre || null,
        fecha_limite: h.fecha_limite || null,
        estado: "Pendiente",
        created_by: user.id,
        sede_id: audit.sede_id,
        sede_nombre: audit.sedes?.nombre,
        auditoria_codigo: audit.codigo,
        notas: h.criterio_cierre
          ? `Evidencia de cierre esperada: ${h.criterio_cierre}`
          : null,
      });
      await updateAuditoriaHallazgo(h.id, {
        no_conformidad_id: ncId,
        capa_id: capa.id,
      });
      toast.ok(`${capa.codigo} generada.`);
      load();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  };
  if (mobile && !esInforme) {
    const currentQuestion = questions[mobileQuestionIndex] || null;
    const currentAnswer = currentQuestion ? (answers[currentQuestion.id] || {}) : {};
    const currentSection = currentQuestion
      ? audit.auditoria_plantillas?.auditoria_secciones?.find((section) =>
          section.auditoria_preguntas?.some((question) => question.id === currentQuestion.id),
        )
      : null;
    const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;
    const continueMobile = async () => {
      if (!currentAnswer.valor) {
        toast.warn("Elegí el resultado del punto antes de continuar.");
        return;
      }
      if (["Parcial", "No cumple"].includes(currentAnswer.valor) && !currentAnswer.observacion?.trim()) {
        toast.warn("Describí el desvío antes de continuar.");
        return;
      }
      if (await save(false, true, false)) {
        setMobileQuestionIndex((index) => Math.min(index + 1, questions.length));
        window.requestAnimationFrame(() => document.getElementById("mobile-audit-top")?.scrollIntoView());
      }
    };

    return (
      <div id="mobile-audit-top" className="mobile-scroll" style={{ height:"100%", overflowY:"auto", padding:"0.75rem 1rem 7rem" }}>
        <button type="button" className="btn-ghost" onClick={onBack} style={{ minHeight:44, marginBottom:8 }}>← Auditorías</button>
        <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start" }}>
          <div>
            <h2 style={{ color:"var(--phosphor)", fontWeight:800, fontSize:"1.05rem" }}>{audit.codigo}</h2>
            <p style={{ color:"var(--text-dim)", fontSize:"0.78rem", marginTop:3 }}>{audit.sedes?.nombre} · {audit.tipo_auditoria}</p>
          </div>
          <span className="chip" style={{ color:STATUS_COLOR[audit.estado], flexShrink:0 }}>{audit.estado}</span>
        </div>

        <div style={{ margin:"14px 0 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", color:"var(--text-dim)", fontSize:"0.72rem", marginBottom:6 }}>
            <span>{answered} de {questions.length} puntos</span><strong style={{ color:"var(--phosphor)" }}>{progress}%</strong>
          </div>
          <div style={{ height:8, borderRadius:999, background:"rgba(255,255,255,.08)", overflow:"hidden" }}>
            <div style={{ width:`${progress}%`, height:"100%", background:"var(--phosphor)", transition:"width .2s ease" }} />
          </div>
        </div>

        {currentQuestion ? (
          <section className="glass rounded" style={{ padding:"1rem", border:"1px solid rgba(57,255,20,.14)" }}>
            <p style={{ color:"var(--text-dim)", fontSize:"0.7rem", marginBottom:8 }}>
              {currentSection?.codigo}. {currentSection?.nombre} · Punto {mobileQuestionIndex + 1} de {questions.length}
            </p>
            <h3 style={{ color:"var(--text)", fontWeight:750, fontSize:"1rem", lineHeight:1.45 }}>
              {currentQuestion.codigo} {currentQuestion.pregunta}
              {currentQuestion.requisito_critico && <span style={{ color:"#ef4444" }}> · CRÍTICO</span>}
            </h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:16 }}>
              {VALUES.map((value) => {
                const active = currentAnswer.valor === value;
                const color = value === "Cumple" ? "#39ff14" : value === "Parcial" ? "#f59e0b" : value === "No cumple" ? "#ef4444" : "#94a3b8";
                return <button type="button" key={value} onClick={() => setAnswers((state) => ({ ...state, [currentQuestion.id]:{ ...currentAnswer, valor:value } }))}
                  style={{ minHeight:52, borderRadius:8, border:`1px solid ${active ? color : "rgba(255,255,255,.12)"}`, background:active ? `${color}18` : "rgba(255,255,255,.03)", color:active ? color : "var(--text-dim)", fontWeight:750, fontSize:"0.8rem" }}>
                  {value}
                </button>;
              })}
            </div>
            {currentAnswer.valor && currentAnswer.valor !== "Cumple" && (
              <label style={{ display:"block", color:"var(--text-dim)", fontSize:"0.75rem", marginTop:16 }}>
                {currentAnswer.valor === "No observado" ? "Motivo u observación" : "Describí el desvío *"}
                <textarea className="input-dark" rows="3" style={{ marginTop:6, fontSize:"0.9rem" }} placeholder="Qué observaste y qué acción inmediata se tomó"
                  value={currentAnswer.observacion || ""} onChange={(event) => setAnswers((state) => ({ ...state, [currentQuestion.id]:{ ...currentAnswer, observacion:event.target.value } }))} />
              </label>
            )}
            <div style={{ marginTop:16 }}>
              <AdjuntosPanel entityType="auditoria_respuesta_evidencia" entityId={`${audit.id}:${currentQuestion.id}`} compact camera label="Foto o evidencia del punto" />
            </div>
            {["Parcial", "No cumple"].includes(currentAnswer.valor) && (
              <button type="button" className="btn-ghost" onClick={() => setFinding(true)} style={{ width:"100%", minHeight:48, marginTop:12 }}>
                <Plus size={15} /> Registrar también como hallazgo
              </button>
            )}
          </section>
        ) : (
          <section className="glass rounded" style={{ padding:"1rem" }}>
            <h3 style={{ color:"var(--phosphor)", fontWeight:800 }}>Revisión final</h3>
            <p style={{ color:"var(--text-dim)", fontSize:"0.8rem", lineHeight:1.5, marginTop:5 }}>Revisá el resultado, completá el cierre y finalizá cuando no queden puntos pendientes.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
              {[["Cumple",scoreSummary.cumple,"#39ff14"],["Parcial",scoreSummary.parcial,"#f59e0b"],["No cumple",scoreSummary.noCumple,"#ef4444"],["Sin responder",scoreSummary.sinResponder,"#94a3b8"]].map(([label,value,color]) =>
                <div key={label} style={{ border:"1px solid rgba(255,255,255,.08)", borderRadius:8, padding:10 }}><small style={{ color }}>{label}</small><strong style={{ display:"block", marginTop:3 }}>{value}</strong></div>)}
            </div>
            <label style={{ display:"block", color:"var(--text-dim)", fontSize:"0.75rem", marginTop:14 }}>Resumen ejecutivo<textarea className="input-dark" rows="3" style={{ marginTop:5 }} value={resumenFinal} onChange={(event) => setResumenFinal(event.target.value)} /></label>
            <label style={{ display:"block", color:"var(--text-dim)", fontSize:"0.75rem", marginTop:12 }}>Conclusiones y prioridades<textarea className="input-dark" rows="3" style={{ marginTop:5 }} value={conclusiones} onChange={(event) => setConclusiones(event.target.value)} /></label>
            <button type="button" className="btn-ghost" onClick={() => setFinding(true)} style={{ width:"100%", minHeight:48, marginTop:12 }}><Plus size={15} /> Agregar hallazgo</button>
            <button type="button" className="btn-primary" disabled={busy || scoreSummary.sinResponder > 0} onClick={() => save(true)} style={{ width:"100%", minHeight:52, marginTop:10 }}>Finalizar auditoría</button>
          </section>
        )}

        {currentQuestion && <div style={{ position:"fixed", left:0, right:0, bottom:"calc(64px + env(safe-area-inset-bottom))", zIndex:30, display:"flex", gap:8, padding:"0.65rem 1rem", background:"var(--surface)", borderTop:"1px solid rgba(57,255,20,.15)" }}>
          <button type="button" className="btn-ghost" disabled={mobileQuestionIndex === 0 || busy} onClick={() => setMobileQuestionIndex((index) => Math.max(0, index - 1))} style={{ minHeight:48, flex:"0 0 42%" }}>← Anterior</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={continueMobile} style={{ minHeight:48, flex:1 }}>{busy ? "Guardando…" : mobileQuestionIndex === questions.length - 1 ? "Revisar cierre" : "Guardar y seguir →"}</button>
        </div>}
        {finding && <FindingForm audit={audit} onClose={() => setFinding(false)} onSaved={() => { setFinding(false); load(); }} />}
      </div>
    );
  }
  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-4 pr-1 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button className="btn-ghost mb-2" onClick={onBack}>
            ← Volver
          </button>
          <h2
            className="font-title font-bold text-xl"
            style={{ color: "var(--phosphor)" }}
          >
            {audit.codigo}
          </h2>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            {audit.sedes?.nombre} · {audit.tipo_auditoria} ·{" "}
            {audit.auditor_nombre}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && !esInforme && (
            <button className="btn-ghost" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Editar
            </button>
          )}
          {canManage && esInforme && (
            <button
              className="btn-ghost"
              title="Volver al modo edición del recorrido"
              onClick={() => setModoEdicion(true)}
            >
              <Pencil size={14} /> Reabrir edición
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={() =>
              generarInformeAuditoriaPDF({
                ...audit,
                resumen: resumenFinal,
                conclusiones,
                auditoria_respuestas: Object.entries(answers).map(
                  ([pregunta_id, a]) => ({ pregunta_id, ...a }),
                ),
              })
            }
          >
            <Download size={14} /> PDF
          </button>
          {canShare && (
            <>
              <button
                className="btn-ghost"
                onClick={shareWhatsApp}
                title="Compartir auditoría por WhatsApp"
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
              <button
                className="btn-ghost"
                onClick={shareEmail}
                title="Compartir auditoría por email"
              >
                <Mail size={14} /> Email
              </button>
              <button
                className="btn-ghost"
                onClick={shareChatGPT}
                title="Copiar auditoría y abrir ChatGPT"
              >
                <Bot size={14} /> ChatGPT
              </button>
              <button
                className="btn-ghost"
                onClick={shareNative}
                title="Abrir el menú para compartir"
              >
                <Share2 size={14} /> Compartir
              </button>
            </>
          )}
          {!esInforme && (
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => save(false)}
            >
              <Save size={14} /> Guardar
            </button>
          )}
          {canManage && !esInforme && (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => save(true)}
            >
              Finalizar
            </button>
          )}
        </div>
      </div>
      {esInforme && (
        <AuditoriaInforme
          audit={audit}
          answers={answers}
          score={score}
          scoreSummary={scoreSummary}
          resultado={clasificarAuditoria(score) || audit.resultado}
        />
      )}
      {!esInforme && (
      <>
      <div
        className="rounded p-3 text-sm"
        style={{
          border: "1px solid rgba(96,165,250,.25)",
          background: "rgba(96,165,250,.05)",
        }}
      >
        <b>Recorrido guiado:</b> completá cada punto, agregá una observación
        cuando corresponda y usá “Tomar foto” para dejar evidencia. Avance:{" "}
        <b>
          {answered}/{questions.length}
        </b>
        . Al detectar un desvío, registralo también como hallazgo para asignar
        responsable y seguimiento.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ["Estado", audit.estado],
          ["Cumplimiento", score == null ? "—" : `${score}%`],
          ["Resultado", audit.resultado || "En evaluación"],
          ["Hallazgos", audit.auditoria_hallazgos?.length || 0],
        ].map(([l, v]) => (
          <div key={l} className="glass rounded p-3">
            <div
              className="font-metric text-xs"
              style={{ color: "var(--text-dim)" }}
            >
              {l}
            </div>
            <div className="font-title font-bold mt-1">{v}</div>
          </div>
        ))}
      </div>
      {(audit.auditoria_plantillas?.auditoria_secciones || []).map((s) => (
        <section key={s.id} className="glass rounded p-4">
          <h3
            className="font-title font-bold mb-3"
            style={{ color: "var(--phosphor)" }}
          >
            {s.codigo}. {s.nombre}
          </h3>
          {(s.auditoria_preguntas || []).map((q) => {
            const a = answers[q.id] || {};
            return (
              <div
                key={q.id}
                className="py-3"
                style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}
              >
                <div className="flex justify-between gap-4">
                  <p className="text-sm flex-1">
                    {q.codigo} {q.pregunta}
                    {q.requisito_critico && (
                      <span style={{ color: "#ef4444" }}> · CRÍTICO</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {VALUES.map((v) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() =>
                          setAnswers((x) => ({
                            ...x,
                            [q.id]: { ...a, valor: v },
                          }))
                        }
                        className="chip"
                        style={{
                          borderColor:
                            a.valor === v ? "#39ff14" : "rgba(255,255,255,.12)",
                          color: a.valor === v ? "#39ff14" : "var(--text-dim)",
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                {a.valor && a.valor !== "Cumple" && (
                  <textarea
                    className="input-dark mt-2"
                    rows="2"
                    placeholder="Observación, desvío o acción inmediata"
                    value={a.observacion || ""}
                    onChange={(e) =>
                      setAnswers((x) => ({
                        ...x,
                        [q.id]: { ...a, observacion: e.target.value },
                      }))
                    }
                  />
                )}
                <div className="mt-2">
                  <AdjuntosPanel
                    entityType="auditoria_respuesta_evidencia"
                    entityId={`${audit.id}:${q.id}`}
                    compact
                    camera
                    label="Evidencias del punto"
                  />
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <section className="glass rounded p-4 space-y-4">
        <div>
          <h3
            className="font-title font-bold"
            style={{ color: "var(--phosphor)" }}
          >
            Puntaje y resumen final
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
            Síntesis inspirada en la auditoría externa de Rosario: cumplimiento,
            desvíos y conclusión ejecutiva.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            ["Cumple", scoreSummary.cumple, "#39ff14"],
            ["Parcial", scoreSummary.parcial, "#f59e0b"],
            ["No cumple", scoreSummary.noCumple, "#ef4444"],
            ["No observado", scoreSummary.noObservado, "#94a3b8"],
          ].map(([label, value, color]) => (
            <div
              key={label}
              className="rounded p-3"
              style={{ border: "1px solid rgba(255,255,255,.08)" }}
            >
              <div className="font-metric text-xs" style={{ color }}>
                {label}
              </div>
              <div className="font-title font-bold text-lg mt-1">{value}</div>
            </div>
          ))}
        </div>
        <div
          className="rounded p-3 text-sm"
          style={{
            background: "rgba(57,255,20,.04)",
            border: "1px solid rgba(57,255,20,.15)",
          }}
        >
          <b>Puntaje:</b> {scoreSummary.obtenido} de {scoreSummary.maximo}{" "}
          puntos posibles · <b>Cumplimiento:</b>{" "}
          {score == null ? "—" : `${score}%`} · <b>Resultado:</b>{" "}
          {clasificarAuditoria(score) || "En evaluación"}
          {scoreSummary.sinResponder > 0 && (
            <span style={{ color: "#f59e0b" }}>
              {" "}
              · {scoreSummary.sinResponder} puntos sin responder
            </span>
          )}
        </div>
        <label className="text-xs block">
          Resumen ejecutivo
          <textarea
            className="input-dark mt-1"
            rows="4"
            value={resumenFinal}
            onChange={(e) => setResumenFinal(e.target.value)}
            placeholder="Principales resultados, fortalezas, desvíos y porcentaje alcanzado..."
          />
        </label>
        <label className="text-xs block">
          Conclusiones y prioridades
          <textarea
            className="input-dark mt-1"
            rows="4"
            value={conclusiones}
            onChange={(e) => setConclusiones(e.target.value)}
            placeholder="Prioridades, riesgos relevantes, plazos y próximos pasos..."
          />
        </label>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          Guardá el avance antes de salir. Este cierre también se incorpora al
          informe PDF.
        </p>
      </section>
      <section className="glass rounded p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-title font-bold" style={{ color: "#a78bfa" }}>
            Hallazgos y acciones
          </h3>
          <button className="btn-ghost" onClick={() => setFinding(true)}>
            <Plus size={14} /> Agregar hallazgo
          </button>
        </div>
        <div className="space-y-3 mt-3">
          {(audit.auditoria_hallazgos || []).length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Sin hallazgos registrados.
            </p>
          )}
          {(audit.auditoria_hallazgos || []).map((h) => (
            <div
              key={h.id}
              className="rounded p-3"
              style={{ border: "1px solid rgba(167,139,250,.25)" }}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <strong>
                    {h.numero}. {h.titulo}
                  </strong>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {h.tipo} · {h.criticidad} · {h.estado}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    {!h.no_conformidad_id && (
                      <button className="btn-ghost" onClick={() => makeNC(h)}>
                        Generar NC
                      </button>
                    )}
                    {!h.capa_id && (
                      <button className="btn-ghost" onClick={() => makeCapa(h)}>
                        Generar NC + CAPA
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm mt-2">{h.descripcion}</p>
              {h.accion_propuesta && (
                <p className="text-sm mt-1">
                  <b>Acción:</b> {h.accion_propuesta}
                </p>
              )}
              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <AdjuntosPanel
                  entityType="auditoria_hallazgo"
                  entityId={h.id}
                  camera
                  label="Evidencia del hallazgo"
                />
                <AdjuntosPanel
                  entityType="auditoria_hallazgo_cierre"
                  entityId={h.id}
                  camera
                  label="Evidencia de corrección / cierre"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      </>
      )}
      {finding && (
        <FindingForm
          audit={audit}
          onClose={() => setFinding(false)}
          onSaved={() => {
            setFinding(false);
            load();
          }}
        />
      )}
      {editing && (
        <NewAudit
          sedes={sedes}
          plantillas={plantillas}
          perfiles={perfiles}
          fixedSedeId={audit.sede_id}
          initialAudit={audit}
          onClose={() => setEditing(false)}
          onCreated={() => {
            setEditing(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AuditExecutiveCard({ audit, onOpen, mobile = false }) {
  const e = audit.ejecutivo || {};
  const scheduled = audit.estado === "Programada";
  const auditDate = audit.fecha_auditoria || audit.fecha_programada;
  const responsible = audit.responsable_interno_nombre || audit.auditor_nombre;
  const risk = e.criticos > 0 || e.capa_vencidas > 0 ? {label:"Requiere intervención",color:"#ef4444"}
    : e.hallazgos_total > 0 || e.capa_total > e.capa_cerradas ? {label:"Atención",color:"#f59e0b"}
    : {label:"Controlado",color:"#39ff14"};
  const variation = e.variacion_pp == null ? null : `${e.variacion_pp > 0 ? "↑" : e.variacion_pp < 0 ? "↓" : "→"} ${Math.abs(e.variacion_pp)} pp`;
  return <button onClick={onOpen} className="glass rounded p-3 text-left w-full group transition-transform hover:-translate-y-0.5"
    style={{border:"1px solid rgba(255,255,255,.11)",color:"inherit",background:"linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012))",minHeight:mobile?0:250}}>
    <div className="flex justify-between gap-3"><div className="min-w-0"><strong className="font-metric text-sm" style={{color:"var(--phosphor)"}}>{audit.codigo}</strong><div className="font-title font-bold mt-1 truncate">{audit.sedes?.nombre}</div><div className="text-xs mt-1" style={{color:"var(--text-dim)"}}>{audit.origen || "Interna"}{audit.organismo_auditor ? ` · ${audit.organismo_auditor}` : ""}</div></div><span className="chip shrink-0" style={{color:STATUS_COLOR[audit.estado]||"var(--text-dim)"}}>{audit.estado}</span></div>
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] mt-2 pb-3" style={{color:"var(--text-dim)",borderBottom:"1px solid rgba(255,255,255,.08)"}}>{auditDate&&<span className="flex items-center gap-1"><CalendarDays size={12}/>{auditDate}</span>}{responsible&&<span className="flex items-center gap-1"><UserRound size={12}/>{responsible}</span>}</div>
    {scheduled ? <div className="grid grid-cols-[70px_1fr] gap-3 pt-3 text-xs"><div className="flex items-center justify-center"><div className="w-14 h-14 rounded-full flex items-center justify-center" style={{border:"1px solid rgba(96,165,250,.45)",color:STATUS_COLOR.Programada}}><CalendarDays size={24}/></div></div><div className="space-y-1"><span style={{color:"var(--text-dim)"}}>Próxima auditoría</span><strong className="block text-sm">{auditDate||"Fecha pendiente"}</strong>{audit.auditoria_plantillas?.nombre&&<div>Checklist · {audit.auditoria_plantillas.nombre}</div>}{audit.normativa&&<div>Documentación / criterio informado</div>}{responsible&&<div>Responsable asignado</div>}</div>{audit.alcance&&<div className="col-span-2 truncate" style={{color:"var(--text-dim)"}}>Alcance: {audit.alcance}</div>}</div> : <>
      <div className="grid grid-cols-[105px_1fr] gap-3 py-3" style={{borderBottom:"1px solid rgba(255,255,255,.08)"}}><div className="rounded p-2" style={{border:"1px solid rgba(255,255,255,.08)",background:"rgba(0,0,0,.16)"}}>{audit.porcentaje_cumplimiento!=null&&<div className="font-title font-bold text-2xl">{Number(audit.porcentaje_cumplimiento).toLocaleString("es-AR",{maximumFractionDigits:1})}%</div>}{variation&&<div className="font-metric text-sm mt-1">{variation}</div>}{e.puntaje_anterior!=null&&<div className="text-[10px] mt-1" style={{color:"var(--text-dim)"}}>vs. {Number(e.puntaje_anterior).toLocaleString("es-AR",{maximumFractionDigits:1})}% anterior</div>}</div><div><div className="font-title font-bold flex items-center gap-1.5"><AlertTriangle size={14}/>{e.hallazgos_total||0} hallazgos</div><div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mt-1.5" style={{color:"var(--text-dim)"}}><span>● {e.hallazgos_nuevos||0} nuevos</span><span>● {e.reincidentes||0} reincidentes</span><span style={{color:e.criticos?"#ef4444":"var(--text-dim)"}}>● {e.criticos||0} críticos</span><span>● {e.nc_abiertas||0} NC abiertas</span></div>{e.riesgo_principal&&<div className="text-xs mt-2"><span style={{color:"var(--text-dim)"}}>Riesgo principal · </span>{e.riesgo_principal}</div>}</div></div>
      <div className="grid grid-cols-2 gap-3 pt-3 text-xs"><div><span className="flex items-center gap-1" style={{color:"var(--text-dim)"}}><CheckCircle2 size={12}/>CAPA vinculado</span><strong className="block mt-1">{e.capa_cerradas||0}/{e.capa_total||0} cerradas · {e.capa_vencidas||0} vencidas</strong></div><div><span style={{color:"var(--text-dim)"}}>Estado</span><strong className="block mt-1" style={{color:risk.color}}>● {risk.label}</strong></div>{(e.proxima_accion||e.proximo_vencimiento)&&<div className="col-span-2 flex items-center gap-1" style={{color:"var(--text-dim)"}}><Clock3 size={12}/>Próxima acción: {[e.proxima_accion,e.proximo_vencimiento].filter(Boolean).join(" · ")}</div>}</div>
    </>}
    {mobile&&<span style={{display:"block",color:"var(--phosphor)",fontSize:"0.78rem",fontWeight:700,marginTop:12}}>{["Finalizada","Cerrada"].includes(audit.estado)?"Ver informe →":"Continuar auditoría →"}</span>}
  </button>;
}

export default function AuditoriasInternas({ sedeId = null, mobile = false }) {
  const { perfil } = useAuth();
  const [rows, setRows] = useState([]),
    [sedes, setSedes] = useState([]),
    [plantillas, setPlantillas] = useState([]),
    [perfiles, setPerfiles] = useState([]),
    [loading, setLoading] = useState(true),
    [filters, setFilters] = useState({ busqueda:"", sedeId:sedeId || "", origen:"", estado:"", organismo:"", desde:"", hasta:"" }),
    [modal, setModal] = useState(false),
    [selected, setSelected] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s, p, u] = await Promise.all([
        getAuditoriasInternas({ sedeId: sedeId || filters.sedeId, origen:filters.origen, estado:filters.estado, organismo:filters.organismo, desde:filters.desde, hasta:filters.hasta }),
        getSedes(),
        getAuditoriaPlantillas(),
        getPerfiles(),
      ]);
      setRows(a);
      setSedes(s);
      setPlantillas(p);
      setPerfiles(u);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setLoading(false);
    }
  }, [sedeId, filters.sedeId, filters.origen, filters.estado, filters.organismo, filters.desde, filters.hasta]);
  useEffect(() => {
    load();
  }, [load]);
  if (selected)
    return (
      <AuditDetail
        id={selected}
        sedes={sedes}
        plantillas={plantillas}
        perfiles={perfiles}
        mobile={mobile}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  const selectedSede = sedes.find((s) => String(s.id) === String(sedeId));
  const email = String(perfil?.email || "").toLowerCase();
  const sedesDisponibles =
    email === "mriviere@flykitchen.com.ar"
      ? sedes.filter((s) => String(s.tipo).toLowerCase() === "aeropuerto")
      : sedes;
  const canCreate = !sedeId
    ? ["admin", "editor"].includes(perfil?.rol) ||
      SPECIAL_ALL.has(email) ||
      email === "mriviere@flykitchen.com.ar"
    : canManageAudit(perfil, selectedSede?.tipo);
  const normalizedSearch = filters.busqueda.trim().toLowerCase();
  const visibleRows = normalizedSearch ? rows.filter((a) => [a.codigo,a.sedes?.nombre,a.organismo_auditor,a.auditor_nombre,a.responsable_interno_nombre].some((value) => String(value || "").toLowerCase().includes(normalizedSearch))) : rows;
  const setFilter = (key, value) => setFilters((current) => ({...current,[key]:value}));
  const clearFilters = () => setFilters({busqueda:"",sedeId:sedeId || "",origen:"",estado:"",organismo:"",desde:"",hasta:""});
  return (
    <div className={mobile ? "mobile-scroll" : "h-full min-h-0 overflow-y-auto space-y-4 pr-1 pb-6"} style={mobile ? { height:"100%", overflowY:"auto", padding:"0.75rem 1rem 1rem" } : undefined}>
      <div className={mobile ? "flex flex-col gap-3" : "flex items-center justify-between"}>
        <div>
          <h2 className="font-title font-bold text-lg flex items-center gap-2">
            <ClipboardCheck style={{ color: "var(--phosphor)" }} /> Auditorías
          </h2>
          <p className="text-sm" style={{ color: "var(--text-dim)", lineHeight:1.45 }}>
            Planificación, relevamiento, hallazgos, evidencias y seguimiento
            CAPA por sede.
          </p>
        </div>
        <div className="flex gap-2" style={mobile ? { width:"100%" } : undefined}>
          <button className="btn-ghost" onClick={load} aria-label="Actualizar auditorías" style={mobile ? { minWidth:48, minHeight:48 } : undefined}>
            <RefreshCw size={14} />{mobile ? " Actualizar" : null}
          </button>
          {canCreate && (
            <button className="btn-primary" onClick={() => setModal(true)} style={mobile ? { flex:1, minHeight:48 } : undefined}>
              <Plus size={14} /> Nueva auditoría
            </button>
          )}
        </div>
      </div>
      <div className="glass rounded p-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2" style={{border:"1px solid rgba(255,255,255,.09)"}}>
        <input className="input-dark col-span-2" placeholder="Buscar código, sede, organismo o responsable..." value={filters.busqueda} onChange={(e)=>setFilter("busqueda",e.target.value)} />
        {!sedeId && <select className="input-dark" value={filters.sedeId} onChange={(e)=>setFilter("sedeId",e.target.value)}><option value="">Todas las sedes</option>{sedes.map((s)=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select>}
        <select className="input-dark" value={filters.origen} onChange={(e)=>setFilter("origen",e.target.value)}><option value="">Internas y externas</option><option value="Interna">Internas</option><option value="Externa">Externas</option></select>
        <select className="input-dark" value={filters.estado} onChange={(e)=>setFilter("estado",e.target.value)}><option value="">Todos los estados</option>{Object.keys(STATUS_COLOR).map((state)=><option key={state}>{state}</option>)}</select>
        <input className="input-dark" placeholder="Organismo auditor" value={filters.organismo} onChange={(e)=>setFilter("organismo",e.target.value)} />
        <input type="date" className="input-dark" aria-label="Auditorías desde" value={filters.desde} onChange={(e)=>setFilter("desde",e.target.value)} />
        <input type="date" className="input-dark" aria-label="Auditorías hasta" value={filters.hasta} onChange={(e)=>setFilter("hasta",e.target.value)} />
        <button className="btn-ghost" onClick={clearFilters}>Limpiar</button>
      </div>
      {loading ? (
        <p className="p-8 text-center" style={{ color: "var(--text-dim)" }}>
          Cargando...
        </p>
      ) : visibleRows.length === 0 ? (
        <div
          className="glass rounded p-8 text-center"
          style={{ color: "var(--text-dim)" }}
        >
          Todavía no hay auditorías para este alcance.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {visibleRows.map((a) => <AuditExecutiveCard key={a.id} audit={a} mobile={mobile} onOpen={()=>setSelected(a.id)} />)}
        </div>
      )}
      {modal && (
        <NewAudit
          sedes={sedesDisponibles}
          plantillas={plantillas}
          perfiles={perfiles}
          fixedSedeId={sedeId}
          onClose={() => setModal(false)}
          onCreated={(a) => {
            setModal(false);
            setSelected(a.id);
          }}
        />
      )}
    </div>
  );
}
