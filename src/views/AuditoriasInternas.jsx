import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  ClipboardCheck,
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

function AuditDetail({ id, sedes, plantillas, perfiles, onBack }) {
  const { user, perfil, can } = useAuth();
  const [audit, setAudit] = useState(null),
    [answers, setAnswers] = useState({}),
    [busy, setBusy] = useState(false),
    [finding, setFinding] = useState(false),
    [editing, setEditing] = useState(false),
    [resumenFinal, setResumenFinal] = useState(""),
    [conclusiones, setConclusiones] = useState(""),
    [modoEdicion, setModoEdicion] = useState(false);
  const load = useCallback(async () => {
    try {
      const a = await getAuditoriaInterna(id);
      setAudit(a);
      setResumenFinal(a.resumen || "");
      setConclusiones(a.conclusiones || "");
      setAnswers(
        Object.fromEntries(
          (a.auditoria_respuestas || []).map((r) => [
            r.pregunta_id,
            { valor: r.valor, observacion: r.observacion || "" },
          ]),
        ),
      );
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }, [id]);
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
  const save = async (finalize = false) => {
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
      toast.ok(finalize ? "Auditoría finalizada." : "Avance guardado.");
      await load();
    } catch (e) {
      toast.error(mensajeError(e));
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

export default function AuditoriasInternas({ sedeId = null }) {
  const { perfil } = useAuth();
  const [rows, setRows] = useState([]),
    [sedes, setSedes] = useState([]),
    [plantillas, setPlantillas] = useState([]),
    [perfiles, setPerfiles] = useState([]),
    [loading, setLoading] = useState(true),
    [modal, setModal] = useState(false),
    [selected, setSelected] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s, p, u] = await Promise.all([
        getAuditoriasInternas({ sedeId }),
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
  }, [sedeId]);
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
  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-4 pr-1 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-title font-bold text-lg flex items-center gap-2">
            <ClipboardCheck style={{ color: "var(--phosphor)" }} /> Auditorías
            internas
          </h2>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Planificación, relevamiento, hallazgos, evidencias y seguimiento
            CAPA por sede.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={load}>
            <RefreshCw size={14} />
          </button>
          {canCreate && (
            <button className="btn-primary" onClick={() => setModal(true)}>
              <Plus size={14} /> Nueva auditoría
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <p className="p-8 text-center" style={{ color: "var(--text-dim)" }}>
          Cargando...
        </p>
      ) : rows.length === 0 ? (
        <div
          className="glass rounded p-8 text-center"
          style={{ color: "var(--text-dim)" }}
        >
          Todavía no hay auditorías para este alcance.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rows.map((a) => {
            const open = (a.auditoria_hallazgos || []).filter(
              (h) => !["Cerrado", "Descartado"].includes(h.estado),
            ).length;
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className="glass rounded p-4 text-left"
                style={{ border: "1px solid rgba(57,255,20,.12)" }}
              >
                <div className="flex justify-between">
                  <div>
                    <strong style={{ color: "var(--phosphor)" }}>
                      {a.codigo}
                    </strong>
                    <div className="font-title font-bold mt-1">
                      {a.sedes?.nombre}
                    </div>
                  </div>
                  <span
                    className="chip"
                    style={{ color: STATUS_COLOR[a.estado] }}
                  >
                    {a.estado}
                  </span>
                </div>
                <p
                  className="text-xs mt-2"
                  style={{ color: "var(--text-dim)" }}
                >
                  {a.tipo_auditoria} · {a.fecha_programada || "Sin fecha"} ·{" "}
                  {a.auditor_nombre}
                </p>
                <div className="flex gap-4 mt-3 text-xs">
                  <span>
                    {a.porcentaje_cumplimiento == null
                      ? "Sin puntaje"
                      : `${a.porcentaje_cumplimiento}% cumplimiento`}
                  </span>
                  <span>{open} hallazgos abiertos</span>
                </div>
              </button>
            );
          })}
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
