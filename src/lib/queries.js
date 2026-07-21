import { db, supabase } from "./supabase";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDaysInMonth,
} from "date-fns";
import { notifyHighPriority, notifyComentario } from "./pushNotifications";
import { buildComedoresMetricas } from "./comedoresMetricas";
import { enrichAuditRowsWithReporters } from "./auditoriaAttribution";

// ─── SEDES ────────────────────────────────────────────────────────────────────

export async function getSedes(sedeIds = null) {
  let query = db()
    .from("sedes")
    .select("*, grupos(id,nombre)")
    .eq("activa", true)
    .order("nombre");
  if (sedeIds?.length) query = query.in("id", sedeIds);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ─── REGISTROS HOY ────────────────────────────────────────────────────────────

export async function setSedePausa(sedeId, enPausa) {
  // Una sede en pausa no cuenta como "esperada" en cumplimiento ni en
  // "sin reporte hoy". Se despausa sola al ingresar un registro (trigger
  // trg_despausar_sede en la base).
  const { data, error } = await db()
    .from("sedes")
    .update({ en_pausa: enPausa })
    .eq("id", sedeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRegistrosHoy(sedeIds = null) {
  const hoy = new Date();
  const desde = startOfDay(hoy).toISOString();
  const hasta = endOfDay(hoy).toISOString();
  let query = db()
    .from("registros")
    .select("*, sedes(*)")
    .gte("fecha_reporte", desde)
    .lte("fecha_reporte", hasta)
    .order("fecha_reporte", { ascending: false });
  if (sedeIds?.length) query = query.in("sede_id", sedeIds);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ─── REGISTROS POR SEDE (últimos 30 días) ────────────────────────────────────

export async function getRegistrosBySede(sedeId, dias = 30) {
  const hace = subDays(new Date(), dias);
  let query = db()
    .from("registros")
    .select("*, sedes(*)")
    .gte("fecha_reporte", hace.toISOString())
    .lte("fecha_reporte", new Date().toISOString())
    .order("fecha_reporte", { ascending: false });
  if (sedeId) query = query.eq("sede_id", sedeId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ─── REGISTRO INDIVIDUAL ──────────────────────────────────────────────────────

export async function getRegistroById(id) {
  const { data, error } = await db()
    .from("registros")
    .select("*, sedes(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ─── REGISTROS POR RANGO DE FECHA ─────────────────────────────────────────────

export async function getRegistrosByFecha(desde, hasta, sedeIds = null) {
  let query = db()
    .from("registros")
    .select("*, sedes(*)")
    .gte("fecha_reporte", startOfDay(new Date(desde)).toISOString())
    .lte("fecha_reporte", endOfDay(new Date(hasta)).toISOString())
    .order("fecha_reporte", { ascending: false });
  if (sedeIds?.length) query = query.in("sede_id", sedeIds);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ─── ESCALAMIENTOS ────────────────────────────────────────────────────────────

export async function getComedoresMetricas(dias = 30, sedeIds = null) {
  const desde = subDays(new Date(), dias);
  let query = db()
    .from("registros")
    .select("*, sedes(id,nombre,tipo)")
    .gte("fecha_reporte", startOfDay(desde).toISOString())
    .lte("fecha_reporte", endOfDay(new Date()).toISOString())
    .order("fecha_reporte", { ascending: false });
  if (sedeIds?.length) query = query.in("sede_id", sedeIds);
  const { data, error } = await query;
  if (error) throw error;
  return buildComedoresMetricas(data || []);
}

export async function getEscalamientosItems(filtros = {}) {
  let query = db()
    .from("escalamientos")
    .select("*, registros(*)")
    .order("created_at", { ascending: false });
  if (filtros.sedeIds?.length) query = query.in("sede_id", filtros.sedeIds);
  else if (filtros.sedeId) query = query.eq("sede_id", filtros.sedeId);
  if (filtros.estado) query = query.eq("estado", filtros.estado);
  if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
  if (filtros.desde) query = query.gte("fecha_reporte", filtros.desde);
  if (filtros.hasta) query = query.lte("fecha_reporte", filtros.hasta);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createEscalamientoItem(payload) {
  const { data, error } = await db()
    .from("escalamientos")
    .insert(payload)
    .select();
  if (error) throw error;
  const created = data?.[0];
  if (created?.id)
    notifyHighPriority({ module: "escalamientos", entity_id: created.id });
  return created;
}

export async function updateEscalamientoItem(id, payload) {
  const { data, error } = await db()
    .from("escalamientos")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();
  if (error) throw error;
  return data?.[0];
}

export async function getEscalamientos(filtros = {}) {
  let query = db()
    .from("registros")
    .select(
      "*, sedes(*), tareas(id, titulo, estado, prioridad, responsable, fecha_limite, categoria)",
    )
    .eq("requiere_escalamiento", true)
    .order("fecha_reporte", { ascending: false });
  if (filtros.sedeIds?.length) query = query.in("sede_id", filtros.sedeIds);
  else if (filtros.sedeId) query = query.eq("sede_id", filtros.sedeId);
  if (filtros.desde)
    query = query.gte(
      "fecha_reporte",
      startOfDay(new Date(filtros.desde)).toISOString(),
    );
  if (filtros.hasta)
    query = query.lte(
      "fecha_reporte",
      endOfDay(new Date(filtros.hasta)).toISOString(),
    );
  else query = query.lte("fecha_reporte", new Date().toISOString());
  const { data, error } = await query;
  if (error) {
    console.error("getEscalamientos error:", error);
    throw error;
  }
  return data ?? [];
}

// ─── TAREAS ───────────────────────────────────────────────────────────────────

export async function getTareas({
  sedeId,
  sedeIds,
  prioridad,
  categoria,
  incluirResueltas,
} = {}) {
  let query = db()
    .from("tareas")
    .select(
      "*, sedes(*), registros(id, fecha_reporte, sede_nombre, requiere_escalamiento), perfiles:responsable_id(id, nombre, email, telefono), creador:creado_por(id, nombre, email), contactos:contacto_id(id, nombre, email, telefono, cargo)",
    )
    .order("created_at", { ascending: false });
  if (!incluirResueltas) {
    query = query.not("estado", "in", '("Resuelto","Cancelado")');
  }
  if (sedeIds?.length) query = query.in("sede_id", sedeIds);
  else if (sedeId) query = query.eq("sede_id", sedeId);
  if (prioridad) query = query.eq("prioridad", prioridad);
  if (categoria) query = query.eq("categoria", categoria);
  const { data, error } = await query;
  if (error) throw error;
  // El teléfono puede no estar en perfiles.telefono (login) sino en Equipo o Contactos,
  // igual que resuelve getPerfilesConDirectorio() para la pantalla de Usuarios.
  // Sin esto, "Compartir" tira "El usuario no tiene teléfono registrado" aunque el
  // teléfono sí exista en el directorio.
  const faltaTelefono = (data || []).some(
    (t) => t.perfiles && !t.perfiles.telefono,
  );
  if (faltaTelefono) {
    const directorio = await getPerfilesConDirectorio();
    const telefonoPorId = new Map(directorio.map((p) => [p.id, p.telefono]));
    for (const t of data) {
      if (t.perfiles && !t.perfiles.telefono) {
        t.perfiles.telefono = telefonoPorId.get(t.perfiles.id) || null;
      }
    }
  }
  return data;
}

export async function createTarea(payload) {
  const { data, error } = await db()
    .from("tareas")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  if (data?.id && String(data.prioridad).toLowerCase() === "alta") {
    notifyHighPriority({
      module: "tareas",
      entity_id: data.id,
      priority: data.prioridad,
    });
  }
  return data;
}

export async function updateTarea(id, payload) {
  const { data, error } = await db()
    .from("tareas")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  if (data?.id && String(data.prioridad).toLowerCase() === "alta") {
    notifyHighPriority({
      module: "tareas",
      entity_id: data.id,
      priority: data.prioridad,
    });
  }
  return data;
}

// ─── USUARIOS (resolución de nombre, evita restricción RLS de perfiles) ───────

// Resuelve un uuid de auth.users/perfiles a un nombre legible vía función
// SECURITY DEFINER (bitacora.get_usuario_nombre). Necesario porque la policy
// de SELECT en perfiles es "id = auth.uid() OR admin": un usuario normal no
// puede leer el perfil de otro directamente.
export async function getUsuarioNombre(uid) {
  if (!uid) return null;
  const { data, error } = await db().rpc("get_usuario_nombre", { uid });
  if (error) throw error;
  return data;
}

// ─── NO CONFORMIDADES ─────────────────────────────────────────────────────────

export async function getNoConformidades(filtros = {}) {
  let query = db()
    .from("no_conformidades")
    .select("*, sedes(*), capa(*)")
    .order("created_at", { ascending: false });
  if (filtros.estado) query = query.eq("estado", filtros.estado);
  if (filtros.sedeIds?.length) query = query.in("sede_id", filtros.sedeIds);
  else if (filtros.sedeId) query = query.eq("sede_id", filtros.sedeId);
  if (filtros.desde) query = query.gte("fecha_apertura", filtros.desde);
  if (filtros.hasta) query = query.lte("fecha_apertura", filtros.hasta);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createNoConformidad(payload) {
  // generar código NC-YYYY-NNN
  const anio = new Date().getFullYear();
  const { count } = await db()
    .from("no_conformidades")
    .select("*", { count: "exact", head: true })
    .like("codigo", `NC-${anio}-%`);
  const nro = String((count || 0) + 1).padStart(3, "0");
  const codigo = `NC-${anio}-${nro}`;
  const { data, error } = await db()
    .from("no_conformidades")
    .insert({ ...payload, codigo })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNoConformidad(id, payload) {
  const { data, error } = await db()
    .from("no_conformidades")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── CAPA ─────────────────────────────────────────────────────────────────────

export async function getCapa(filtros = {}) {
  let query = db()
    .from("capa")
    .select(
      "*, no_conformidades(codigo, descripcion, sede_nombre), sedes(id, nombre)",
    )
    .order("codigo", { ascending: true });
  if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
  if (filtros.estado) query = query.eq("estado", filtros.estado);
  if (filtros.responsable)
    query = query.ilike("responsable", `%${filtros.responsable}%`);
  if (filtros.auditoria_codigo)
    query = query.eq("auditoria_codigo", filtros.auditoria_codigo);
  if (filtros.sedeIds?.length) query = query.in("sede_id", filtros.sedeIds);
  else if (filtros.sede_id) query = query.eq("sede_id", filtros.sede_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCapa(payload) {
  const anio = new Date().getFullYear();
  const prefijo = payload.tipo === "Preventiva" ? "PA" : "CA";
  const { count } = await db()
    .from("capa")
    .select("*", { count: "exact", head: true })
    .like("codigo", `${prefijo}-${anio}-%`);
  const nro = String((count || 0) + 1).padStart(3, "0");
  const codigo = `${prefijo}-${anio}-${nro}`;
  const { data, error } = await db()
    .from("capa")
    .insert({ ...payload, codigo })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCapa(id, payload) {
  const { data, error } = await db()
    .from("capa")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── AUDITORÍAS INTERNAS ────────────────────────────────────────────────────

export async function getAuditoriaPlantillas() {
  const { data, error } = await db()
    .from("auditoria_plantillas")
    .select("*, auditoria_secciones(*, auditoria_preguntas(*))")
    .eq("activa", true)
    .order("nombre");
  if (error) throw error;
  return (data || []).map((p) => ({
    ...p,
    auditoria_secciones: (p.auditoria_secciones || [])
      .sort((a, b) => a.orden - b.orden)
      .map((s) => ({
        ...s,
        auditoria_preguntas: (s.auditoria_preguntas || []).sort(
          (a, b) => a.orden - b.orden,
        ),
      })),
  }));
}

export async function getAuditoriasInternas(filtros = {}) {
  let query = db()
    .from("auditorias_internas")
    .select(
      "*, sedes(id,nombre,tipo), auditoria_plantillas(id,codigo,nombre,version), auditoria_hallazgos(id,estado,criticidad,tipo)",
    )
    .order("fecha_programada", { ascending: false })
    .order("created_at", { ascending: false });
  if (filtros.sedeId) query = query.eq("sede_id", filtros.sedeId);
  if (filtros.estado) query = query.eq("estado", filtros.estado);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAuditoriaInterna(id) {
  const { data, error } = await db()
    .from("auditorias_internas")
    .select(
      "*, sedes(id,nombre,tipo), auditoria_plantillas(*, auditoria_secciones(*, auditoria_preguntas(*))), auditoria_respuestas(*), auditoria_hallazgos(*)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  if (data?.auditoria_plantillas?.auditoria_secciones) {
    data.auditoria_plantillas.auditoria_secciones.sort(
      (a, b) => a.orden - b.orden,
    );
    data.auditoria_plantillas.auditoria_secciones.forEach((s) =>
      s.auditoria_preguntas?.sort((a, b) => a.orden - b.orden),
    );
  }
  data.auditoria_hallazgos?.sort((a, b) => a.numero - b.numero);
  return data;
}

export async function createAuditoriaInterna(payload) {
  const year = new Date().getFullYear();
  const { count } = await db()
    .from("auditorias_internas")
    .select("*", { count: "exact", head: true })
    .like("codigo", `FK-AUD-${year}-%`);
  const codigo = `FK-AUD-${year}-${String((count || 0) + 1).padStart(3, "0")}`;
  const { data, error } = await db()
    .from("auditorias_internas")
    .insert({ ...payload, codigo })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAuditoriaInterna(id, payload) {
  const { data, error } = await db()
    .from("auditorias_internas")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertAuditoriaRespuestas(respuestas) {
  if (!respuestas?.length) return [];
  const { data, error } = await db()
    .from("auditoria_respuestas")
    .upsert(respuestas, { onConflict: "auditoria_id,pregunta_id" })
    .select();
  if (error) throw error;
  return data || [];
}

export async function createAuditoriaHallazgo(payload) {
  const { data, error } = await db()
    .from("auditoria_hallazgos")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAuditoriaHallazgo(id, payload) {
  const { data, error } = await db()
    .from("auditoria_hallazgos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── CAPA: METADATOS DE CABECERA DEL PLAN (para informe PDF) ────────────────

export async function getCapaPlan(auditoria_codigo) {
  if (!auditoria_codigo) return null;
  const { data, error } = await db()
    .from("capa_planes")
    .select("*")
    .eq("auditoria_codigo", auditoria_codigo)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertCapaPlan(payload) {
  const { data, error } = await db()
    .from("capa_planes")
    .upsert(
      { ...payload, updated_at: new Date().toISOString() },
      { onConflict: "auditoria_codigo" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCapaProject(plan) {
  if (!plan?.id || !plan?.auditoria_codigo) {
    throw new Error("El proyecto no tiene un identificador válido.");
  }
  const { error: actionsError } = await db()
    .from("capa")
    .delete()
    .eq("auditoria_codigo", plan.auditoria_codigo);
  if (actionsError) throw actionsError;

  const { error: planError } = await db()
    .from("capa_planes")
    .delete()
    .eq("id", plan.id)
    .eq("auditoria_codigo", plan.auditoria_codigo);
  if (planError) throw planError;
}

// ─── INDICADORES POR SEDE ─────────────────────────────────────────────────────

export async function getIndicadoresPorSede(dias = 30, sedeIds = null) {
  const desde = subDays(new Date(), dias).toISOString();
  let sedesQ = db()
    .from("sedes")
    .select("*")
    .eq("activa", true)
    .eq("en_pausa", false);
  let regsQ = db()
    .from("registros")
    .select(
      "sede_id, sede_nombre, estado_general, requiere_escalamiento, fecha_reporte",
    )
    .gte("fecha_reporte", desde);
  let tarQ = db()
    .from("tareas")
    .select("sede_id, estado, fecha_limite, created_at")
    .gte("created_at", desde);
  if (sedeIds?.length) {
    sedesQ = sedesQ.in("id", sedeIds);
    regsQ = regsQ.in("sede_id", sedeIds);
    tarQ = tarQ.in("sede_id", sedeIds);
  }
  const [
    { data: registros, error: e1 },
    { data: sedes, error: e2 },
    { data: tareas, error: e3 },
  ] = await Promise.all([regsQ, sedesQ, tarQ]);
  if (e1) throw e1;
  if (e2) throw e2;

  return (sedes || []).map((sede) => {
    const regs = (registros || []).filter((r) => r.sede_id === sede.id);
    const totalRegs = regs.length;
    const sinNovedades = regs.filter(
      (r) => r.estado_general === "Sin novedades",
    ).length;
    const escalamientos = regs.filter((r) => r.requiere_escalamiento).length;
    const tareasSede = (tareas || []).filter((t) => t.sede_id === sede.id);
    const tareasResueltas = tareasSede.filter(
      (t) => t.estado === "Resuelto",
    ).length;
    const tareasTotal = tareasSede.length;

    let diasPeriodo = 0;
    const ops = sede.dias_operacion || [1, 2, 3, 4, 5, 6, 0];
    for (let i = 0; i < dias; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (ops.includes(d.getDay())) diasPeriodo++;
    }

    // % cumplimiento carga: reportes / dias operativos del periodo
    const pctCumplimiento =
      diasPeriodo > 0
        ? Math.min(100, Math.round((totalRegs / diasPeriodo) * 100))
        : 0;
    const pctLimpias =
      totalRegs > 0 ? Math.round((sinNovedades / totalRegs) * 100) : 0;
    const tiempoMedioResolucion =
      tareasResueltas > 0
        ? Math.round(
            tareasSede
              .filter((t) => t.estado === "Resuelto" && t.fecha_limite)
              .reduce((acc, t) => {
                const dias2 = Math.abs(
                  (new Date(t.fecha_limite) - new Date(t.created_at)) /
                    86400000,
                );
                return acc + dias2;
              }, 0) / tareasResueltas,
          )
        : null;

    return {
      sede,
      totalRegs,
      sinNovedades,
      escalamientos,
      pctCumplimiento,
      pctLimpias,
      tareasTotal,
      tareasResueltas,
      tiempoMedioResolucion,
    };
  });
}

export async function getMapaCalorGestion(dias = 30, sedeIds = null) {
  const desde = format(subDays(new Date(), dias), "yyyy-MM-dd");
  const hoy = format(new Date(), "yyyy-MM-dd");
  let sedesQ = db()
    .from("sedes")
    .select("id,nombre,tipo,grupo_id")
    .eq("activa", true)
    .eq("en_pausa", false)
    .order("nombre");
  let registrosQ = db()
    .from("registros")
    .select("sede_id,requiere_escalamiento")
    .gte("fecha_reporte", desde)
    .eq("requiere_escalamiento", true);
  let tareasQ = db()
    .from("tareas")
    .select("sede_id,estado,fecha_limite")
    .not("fecha_limite", "is", null);
  let ticketsQ = supabase
    .from("mnt_tickets")
    .select("sede_id,estado,fecha_limite");
  let comprasQ = db()
    .from("requerimientos")
    .select("sede_id,estado,enviado_at,cumplido_at,sla_dias,urgencia");
  let capasQ = db()
    .from("capa")
    .select("sede_id,sede_nombre,estado,fecha_limite")
    .not("fecha_limite", "is", null);
  let activosQ = supabase
    .from("mnt_activos")
    .select(
      "sede_id,tipo,vencimiento_seguro,vencimiento_vtv,vencimiento_senasa,vencimiento_rmtsa",
    );
  let matafuegosQ = supabase
    .from("mnt_matafuegos")
    .select("sede_id,vencimiento");

  if (Array.isArray(sedeIds)) {
    if (sedeIds.length === 0) return [];
    sedesQ = sedesQ.in("id", sedeIds);
    registrosQ = registrosQ.in("sede_id", sedeIds);
    tareasQ = tareasQ.in("sede_id", sedeIds);
    ticketsQ = ticketsQ.in("sede_id", sedeIds);
    comprasQ = comprasQ.in("sede_id", sedeIds);
    capasQ = capasQ.in("sede_id", sedeIds);
    activosQ = activosQ.in("sede_id", sedeIds);
    matafuegosQ = matafuegosQ.in("sede_id", sedeIds);
  }

  const results = await Promise.all([
    sedesQ,
    registrosQ,
    tareasQ,
    ticketsQ,
    comprasQ,
    capasQ,
    activosQ,
    matafuegosQ,
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  const [
    sedes,
    registros,
    tareas,
    tickets,
    compras,
    capas,
    activos,
    matafuegos,
  ] = results.map((result) => result.data || []);

  const diasHabiles = (inicio, fin = new Date()) => {
    const start = new Date(inicio);
    const end = new Date(fin);
    if (Number.isNaN(start.getTime()) || end < start) return 0;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    let total = 0;
    for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1))
      if (![0, 6].includes(d.getDay())) total++;
    return total;
  };
  const slaCompra = (r) =>
    r.sla_dias || { alta: 3, media: 7, baja: 15 }[r.urgencia] || 7;
  const estadosCompraCerrados = ["Cumplido", "Rechazado", "Cancelado"];
  const estadosTicketCerrados = ["resuelto", "rechazado", "cerrado"];
  const docVencida = (activo) =>
    [
      "vencimiento_seguro",
      "vencimiento_vtv",
      "vencimiento_senasa",
      "vencimiento_rmtsa",
    ].some((field) => activo[field] && activo[field] < hoy);

  const buildRow = (sede) => {
    const id = sede.id;
    const metricas = {
      novedades: (registros || []).filter((r) => r.sede_id === id).length,
      tareas: (tareas || []).filter(
        (t) =>
          t.sede_id === id &&
          t.fecha_limite < hoy &&
          !["Resuelto", "Cancelado"].includes(t.estado),
      ).length,
      tickets: (tickets || []).filter(
        (t) =>
          t.sede_id === id &&
          t.fecha_limite &&
          t.fecha_limite.slice(0, 10) < hoy &&
          !estadosTicketCerrados.includes(String(t.estado).toLowerCase()),
      ).length,
      compras: (compras || []).filter(
        (r) =>
          r.sede_id === id &&
          r.enviado_at &&
          !estadosCompraCerrados.includes(r.estado) &&
          diasHabiles(r.enviado_at) > slaCompra(r),
      ).length,
      capas: (capas || []).filter(
        (c) =>
          c.sede_id === id &&
          c.fecha_limite < hoy &&
          !["Completada", "Verificada"].includes(c.estado),
      ).length,
      documentacion:
        (activos || []).filter(
          (a) => a.sede_id === id && a.tipo === "VEHICULO" && docVencida(a),
        ).length +
        (matafuegos || []).filter(
          (m) => m.sede_id === id && m.vencimiento && m.vencimiento < hoy,
        ).length,
    };
    return {
      sede,
      metricas,
      total: Object.values(metricas).reduce((sum, value) => sum + value, 0),
    };
  };

  const rows = (sedes || []).map(buildRow);
  if (!Array.isArray(sedeIds)) {
    const gestionCapas = (capas || []).filter(
      (c) =>
        !c.sede_id &&
        c.sede_nombre === "Gestión" &&
        c.fecha_limite < hoy &&
        !["Completada", "Verificada"].includes(c.estado),
    ).length;
    if (gestionCapas > 0)
      rows.push({
        sede: { id: "gestion", nombre: "Gestión", tipo: "Corporativo" },
        metricas: {
          novedades: 0,
          tareas: 0,
          tickets: 0,
          compras: 0,
          capas: gestionCapas,
          documentacion: 0,
        },
        total: gestionCapas,
      });
  }
  return rows.sort(
    (a, b) =>
      b.total - a.total || a.sede.nombre.localeCompare(b.sede.nombre, "es"),
  );
}

// ─── CUMPLIMIENTO CALENDARIO ──────────────────────────────────────────────────

export async function getCumplimientoCalendario(anio, mes) {
  const primerDia = new Date(anio, mes - 1, 1);
  const ultimoDia = endOfMonth(primerDia);
  const hoy = startOfDay(new Date());

  const [
    { data: registros, error: e1 },
    { data: sedes, error: e2 },
    { data: tareas },
  ] = await Promise.all([
    db()
      .from("registros")
      .select(
        "id, fecha_reporte, sede_id, sede_nombre, requiere_escalamiento, turno, reportante, estado_general, nivel_actividad, estado_a, estado_b, estado_c, estado_d, estado_e, estado_f, estado_g, estado_h, detalle_a, detalle_b, detalle_c, detalle_d, detalle_e, detalle_f, detalle_g, detalle_h, motivo_escalamiento, sedes(nombre)",
      )
      .gte("fecha_reporte", primerDia.toISOString())
      .lte("fecha_reporte", ultimoDia.toISOString()),
    db().from("sedes").select("id, dias_operacion").eq("activa", true),
    db()
      .from("tareas")
      .select("fecha_limite, estado")
      .gte("fecha_limite", format(primerDia, "yyyy-MM-dd"))
      .lte("fecha_limite", format(ultimoDia, "yyyy-MM-dd")),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const dias = eachDayOfInterval({ start: primerDia, end: ultimoDia });

  return dias.map((dia) => {
    const diaStr = format(dia, "yyyy-MM-dd");
    const jsDay = dia.getDay();
    const esFuturo = dia > hoy;

    const sedesOperativas = (sedes || []).filter((s) =>
      (s.dias_operacion || [1, 2, 3, 4, 5, 6, 0]).includes(jsDay),
    );
    const totalSedesOperativas = sedesOperativas.length;

    const regsDelDia = (registros || []).filter((r) =>
      r.fecha_reporte.startsWith(diaStr),
    );
    const sedesQueReportaron = new Set(regsDelDia.map((r) => r.sede_id)).size;
    const tieneEscalamiento = regsDelDia.some((r) => r.requiere_escalamiento);
    const tieneTareaVencida = (tareas || []).some(
      (t) =>
        t.fecha_limite === diaStr &&
        t.estado !== "Resuelto" &&
        t.estado !== "Cancelado",
    );

    let estado = "futuro";
    if (!esFuturo) {
      if (sedesQueReportaron === 0 && totalSedesOperativas > 0)
        estado = "ninguna";
      else if (totalSedesOperativas === 0 && sedesQueReportaron === 0)
        estado = "todas";
      else if (
        totalSedesOperativas > 0 &&
        sedesQueReportaron >= totalSedesOperativas
      )
        estado = "todas";
      else estado = "algunas";
    }

    // Enriquecer registros con nombre de sede
    const regsEnriquecidos = regsDelDia.map((r) => ({
      ...r,
      sede_nombre: r.sede_nombre || r.sedes?.nombre || String(r.sede_id),
    }));

    return {
      dia,
      diaStr,
      sedesQueReportaron,
      totalSedes: totalSedesOperativas,
      estado,
      tieneEscalamiento,
      tieneTareaVencida,
      registros: regsEnriquecidos,
    };
  });
}

// ─── ANUNCIOS / TABLÓN ────────────────────────────────────────────────────────
// No hay tabla nueva: se reutiliza bitacora.notificaciones con modulo='anuncio'.
// El insert real lo hace la Edge Function send-priority-notification (service role),
// porque notificaciones no tiene policy de INSERT para el cliente (solo select/update propios).

export async function crearAnuncio({
  titulo,
  cuerpo,
  prioridad = "media",
  sedeIds = null,
  roles = null,
  areas = null,
  perfilIds = null,
  url = null,
}) {
  const { data, error } = await supabase.functions.invoke(
    "send-priority-notification",
    {
      body: {
        module: "anuncio",
        titulo,
        cuerpo,
        prioridad,
        sede_ids: sedeIds,
        roles,
        areas,
        perfil_ids: perfilIds,
        url,
      },
    },
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (data?.skipped) throw new Error("No autorizado para publicar anuncios");
  return data; // { sent, recipients }
}

// Cada anuncio genera una fila por destinatario (mismo entidad_id). Acá se deduplica
// para mostrar un solo card por anuncio en el feed del usuario que consulta.
export async function getAnuncios(limit = 50) {
  const { data, error } = await db()
    .from("notificaciones")
    .select("*")
    .eq("modulo", "anuncio")
    .order("created_at", { ascending: false })
    .limit(limit * 3);
  if (error) throw error;
  const vistos = new Set();
  const anuncios = [];
  for (const row of data ?? []) {
    if (vistos.has(row.entidad_id)) continue;
    vistos.add(row.entidad_id);
    anuncios.push(row);
    if (anuncios.length >= limit) break;
  }
  return anuncios;
}

export async function marcarAnunciosLeidos(userId) {
  if (!userId) return;
  const { error } = await db()
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("destinatario_id", userId)
    .eq("modulo", "anuncio")
    .is("leida_at", null);
  if (error) throw error;
}

// ─── PERFILES ─────────────────────────────────────────────────────────────────

export async function getPerfiles() {
  const { data, error } = await db()
    .from("perfiles")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return data;
}

// Directorio unificado para la administración de usuarios.
// perfiles sigue siendo la fuente de permisos; Equipo y Contactos solo completan
// datos de contacto faltantes sin duplicarlos ni escribirlos en otra tabla.
export async function getPerfilesConDirectorio() {
  const perfiles = await getPerfiles();
  const [personasResult, contactosResult] = await Promise.allSettled([
    supabase
      .from("v_personas")
      .select("id, nombre, apellido, email, telefono, perfil_id"),
    db()
      .from("contactos")
      .select("id, nombre, email, telefono, perfil_id")
      .eq("activo", true),
  ]);
  const personas =
    personasResult.status === "fulfilled" && !personasResult.value.error
      ? personasResult.value.data || []
      : [];
  const contactos =
    contactosResult.status === "fulfilled" && !contactosResult.value.error
      ? contactosResult.value.data || []
      : [];
  const clean = (value) =>
    String(value || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .toLowerCase();
  const cleanName = (value) =>
    clean(value).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  const personName = (person) =>
    cleanName(`${person.nombre || ""} ${person.apellido || ""}`);
  const profileNameCount = perfiles.reduce((counts, perfil) => {
    const key = cleanName(perfil.nombre);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const personNameCount = personas.reduce((counts, persona) => {
    const key = personName(persona);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());

  return perfiles.map((perfil) => {
    const email = clean(perfil.email);
    const nombre = cleanName(perfil.nombre);
    const nombreEsUnico =
      profileNameCount.get(nombre) === 1 && personNameCount.get(nombre) === 1;
    const persona =
      personas.find((item) => item.perfil_id === perfil.id) ||
      personas.find((item) => email && clean(item.email) === email) ||
      (nombreEsUnico
        ? personas.find((item) => nombre && personName(item) === nombre)
        : null);
    const contacto =
      contactos.find((item) => item.perfil_id === perfil.id) ||
      contactos.find((item) => email && clean(item.email) === email);
    return {
      ...perfil,
      telefono:
        perfil.telefono || persona?.telefono || contacto?.telefono || null,
      telefono_origen: perfil.telefono
        ? "perfil"
        : persona?.telefono
          ? "equipo"
          : contacto?.telefono
            ? "contacto"
            : null,
      posible_duplicado: (profileNameCount.get(nombre) || 0) > 1,
      duplicados_nombre: profileNameCount.get(nombre) || 1,
    };
  });
}

// ─── GRUPOS ───────────────────────────────────────────────────────────────────

export async function getGrupos() {
  const { data, error } = await db()
    .from("grupos")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return data ?? [];
}

export async function createGrupo(payload) {
  const { data, error } = await db()
    .from("grupos")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertPerfil(payload) {
  // Update directo, no upsert: esta función solo edita perfiles ya existentes
  // (la creación de usuarios nuevos pasa por la edge function admin-user-actions).
  // Con .upsert() Postgres valida también la política de INSERT
  // (perfiles_insert_self_as_consultor) aunque el row ya exista, y la rechaza
  // por RLS al editar el perfil de otra persona.
  const { id, ...changes } = payload;
  const { data, error } = await db()
    .from("perfiles")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── PERMISOS DE MÓDULO (COMPRAS) ─────────────────────────────────────────────
// bitacora.perfil_permisos: define quién puede gestionar el circuito de Compras
// más allá de "Enviado" (trigger protect_requerimiento_after_send). RLS: solo
// admin puede insertar/editar; cada usuario puede leer sus propios permisos.

export async function getPermisosCompras() {
  const { data, error } = await db()
    .from("perfil_permisos")
    .select("id, perfil_id, accion, activo")
    .eq("modulo", "compras");
  if (error) throw error;
  return data || [];
}

export async function setPermisoCompras({
  perfilId,
  accion,
  activo,
  createdBy = null,
}) {
  const { data, error } = await db()
    .from("perfil_permisos")
    .upsert(
      {
        perfil_id: perfilId,
        modulo: "compras",
        accion,
        activo,
        created_by: createdBy,
      },
      { onConflict: "perfil_id,modulo,accion" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── KPIs HOY ─────────────────────────────────────────────────────────────────

export async function getKPIsHoy(sedeIds = null) {
  const [registrosHoy, sedes, escalamientosItems, tareas] = await Promise.all([
    getRegistrosHoy(sedeIds),
    getSedes(sedeIds),
    getEscalamientosItems({ sedeIds }),
    getTareas({ sedeIds }),
  ]);
  const sedesQueReportaron = new Set(registrosHoy.map((r) => r.sede_id));
  const escalamientosActivos = escalamientosItems.filter(
    (e) => e.estado !== "Resuelto",
  );
  return {
    totalRegistrosHoy: registrosHoy.length,
    sedesReportaronHoy: sedesQueReportaron.size,
    totalSedesActivas: sedes.filter((s) => !s.en_pausa).length,
    escalamientosActivos: escalamientosActivos.length,
    tareasPendientes: tareas.length,
    registrosHoy,
    sedes,
    escalamientosRecientes: escalamientosActivos.slice(0, 5),
  };
}

// ─── TENDENCIA ESTADO GENERAL ─────────────────────────────────────────────────

export async function getEstadoTendencia(sedeIds = null, dias = 14) {
  const desde = new Date();
  desde.setDate(desde.getDate() - (dias - 1));
  desde.setHours(0, 0, 0, 0);

  let q = db()
    .from("registros")
    .select("fecha_reporte,estado_general")
    .gte("fecha_reporte", desde.toISOString())
    .order("fecha_reporte");

  if (sedeIds?.length) q = q.in("sede_id", sedeIds);

  const { data, error } = await q;
  if (error) throw error;

  // Agrupar por fecha y contar estados
  const byDate = {};
  for (const r of data || []) {
    const d = r.fecha_reporte?.slice(0, 10);
    if (!d) continue;
    if (!byDate[d])
      byDate[d] = {
        fecha: d,
        sin_novedades: 0,
        hay_novedades: 0,
        condicionada: 0,
      };
    if (r.estado_general === "Sin novedades") byDate[d].sin_novedades++;
    else if (r.estado_general === "Hay novedades") byDate[d].hay_novedades++;
    else if (r.estado_general === "Operación condicionada")
      byDate[d].condicionada++;
  }

  // Rellenar días sin datos y ordenar
  const result = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(desde);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push(
      byDate[key] || {
        fecha: key,
        sin_novedades: 0,
        hay_novedades: 0,
        condicionada: 0,
      },
    );
  }
  return result;
}

// ─── HISTORIAL SEMANAL DE ESTADO POR SEDE ─────────────────────────────────────

export async function getHistorialSemanal(sedeIds = null, semanas = 8) {
  const desde = new Date();
  desde.setDate(desde.getDate() - semanas * 7);
  desde.setHours(0, 0, 0, 0);

  let q = db()
    .from("registros")
    .select("fecha_reporte,estado_general")
    .gte("fecha_reporte", desde.toISOString())
    .order("fecha_reporte");

  if (sedeIds?.length) q = q.in("sede_id", sedeIds);

  const { data, error } = await q;
  if (error) throw error;

  const byWeek = {};
  for (const r of data || []) {
    const d = new Date(r.fecha_reporte);
    const day = d.getDay() || 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - day + 1);
    const wk = mon.toISOString().slice(0, 10);
    if (!byWeek[wk])
      byWeek[wk] = {
        semana: wk,
        sin_novedades: 0,
        hay_novedades: 0,
        condicionada: 0,
        total: 0,
      };
    byWeek[wk].total++;
    if (r.estado_general === "Sin novedades") byWeek[wk].sin_novedades++;
    else if (r.estado_general === "Hay novedades") byWeek[wk].hay_novedades++;
    else if (r.estado_general === "Operación condicionada")
      byWeek[wk].condicionada++;
  }
  return Object.values(byWeek).sort((a, b) => a.semana.localeCompare(b.semana));
}

// ─── CHECKLISTS ────────────────────────────────────────────────────────────────

export async function getChecklistItems(tipo, sedeId = null) {
  if (sedeId) {
    const { CHECKLIST_SEDE_TEMPLATES } = await import('../data/checklistSedeTemplates')
    const plantillaSede = CHECKLIST_SEDE_TEMPLATES[Number(sedeId)]?.[tipo]
    if (plantillaSede?.length) return plantillaSede
  }
  const { data, error } = await db()
    .from("checklist_items")
    .select("*")
    .eq("tipo", tipo)
    .eq("activo", true)
    .order("orden");
  if (error) throw error;
  return data;
}

export async function getChecklistHoy(sedeId, tipo) {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("checklists")
    .select("*")
    .eq("sede_id", sedeId)
    .eq("tipo", tipo)
    .eq("fecha", hoy)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

export async function createChecklist(payload) {
  const { data, error } = await db()
    .from("checklists")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getChecklists({
  sedeId,
  tipo,
  fechaDesde,
  sedeIds,
} = {}) {
  let q = db()
    .from("checklists")
    .select("*")
    .order("created_at", { ascending: false });
  if (sedeId) q = q.eq("sede_id", sedeId);
  if (tipo) q = q.eq("tipo", tipo);
  if (fechaDesde) q = q.gte("fecha", fechaDesde);
  if (sedeIds?.length) q = q.in("sede_id", sedeIds);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function updateChecklistItems(id, updates) {
  const { error } = await db()
    .from("checklist_items")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

export function getCategoriasCONNovedad(registro) {
  const cats = [];
  for (const key of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const est = registro[`estado_${key}`];
    if (est && est !== "Sin novedad" && est !== "Sin novedades")
      cats.push(key.toUpperCase());
  }
  return cats;
}

// ─── CONTACTOS ─────────────────────────────────────────────────────────────────
export async function getContactos() {
  const { data, error } = await db()
    .from("contactos")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function upsertContacto(payload) {
  const { data, error } = await db()
    .from("contactos")
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createRegistro(payload) {
  // Sanity check: si fecha_reporte viene del futuro (device clock mal), usar now()
  const ahora = new Date();
  const fr = payload.fecha_reporte ? new Date(payload.fecha_reporte) : null;
  if (!fr || isNaN(fr) || fr - ahora > 3600000) {
    payload = { ...payload, fecha_reporte: ahora.toISOString() };
  }
  const { data, error } = await db()
    .from("registros")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMisRegistrosHoy(email) {
  if (!email) return [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const { data, error } = await db()
    .from("registros")
    .select("*, sedes(nombre, tipo)")
    .gte("fecha_reporte", hoy.toISOString())
    .eq("email_reportante", email)
    .order("fecha_reporte", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getMisTareas(userId) {
  const { data, error } = await db()
    .from("tareas")
    .select("*, sedes(nombre)")
    .eq("responsable_id", userId)
    .not("estado", "in", '("Resuelto","Cancelado")')
    .order("prioridad", { ascending: false });
  if (error) return [];
  return data ?? [];
}

// ═══════════════════════════════════════════════════════════
// NOVEDADES DE VEHÍCULO Y DE PERSONA (cargadas desde el registro)
// ═══════════════════════════════════════════════════════════

export const CATEGORIAS_NOVEDAD_PERSONA = [
  "Ausentismo",
  "Llegada tarde",
  "Desempeño",
  "Conducta",
  "Otro",
];

// Personas activas asignadas a una sede. v_personas.sede_ids puede fallar con
// .contains() (visto en sedeReportPdf.js), así que se filtra en cliente.
export async function getPersonasBySede(sedeId) {
  if (!sedeId) return [];
  const { data, error } = await supabase
    .from("v_personas")
    .select("id, nombre, apellido, puesto, sede_ids")
    .eq("activo", true);
  if (error) throw error;
  return (data || []).filter((p) => p.sede_ids && p.sede_ids.includes(sedeId));
}

export async function getPersonasMencionables() {
  const perfiles = (await getPerfiles()).filter(
    (perfil) => perfil.activo !== false,
  );
  const [personasResult, contactosResult] = await Promise.allSettled([
    supabase
      .from("v_personas")
      .select(
        "id, nombre, apellido, puesto, area, email, telefono, perfil_id, activo",
      )
      .eq("activo", true),
    db()
      .from("contactos")
      .select("id, nombre, email, telefono, cargo, perfil_id")
      .eq("activo", true),
  ]);
  const personas =
    personasResult.status === "fulfilled" && !personasResult.value.error
      ? personasResult.value.data || []
      : [];
  const contactos =
    contactosResult.status === "fulfilled" && !contactosResult.value.error
      ? contactosResult.value.data || []
      : [];
  const clean = (value) =>
    String(value || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .toLowerCase();
  const fullName = (persona) =>
    `${persona.nombre || ""} ${persona.apellido || ""}`
      .trim()
      .replace(/\s+/g, " ");

  return perfiles
    .map((perfil) => {
      const email = clean(perfil.email);
      const persona =
        personas.find((item) => item.perfil_id === perfil.id) ||
        personas.find((item) => email && clean(item.email) === email);
      const contacto =
        contactos.find((item) => item.perfil_id === perfil.id) ||
        contactos.find((item) => email && clean(item.email) === email);
      const nombre =
        fullName(persona || {}) ||
        contacto?.nombre ||
        perfil.nombre ||
        perfil.email;
      return {
        id: persona?.id || contacto?.id || perfil.id,
        perfil_id: perfil.id,
        nombre,
        apellido: "",
        puesto: persona?.puesto || contacto?.cargo || perfil.rol || "",
        area: persona?.area || "",
        email: perfil.email || persona?.email || contacto?.email || "",
        telefono:
          perfil.telefono || persona?.telefono || contacto?.telefono || "",
        rol: perfil.rol || "",
      };
    })
    .sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"),
    );
}

export async function createVehiculoNovedad(payload) {
  const { data, error } = await db()
    .from("vehiculo_novedades")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createPersonaNovedad(payload) {
  const { data, error } = await db()
    .from("persona_novedades")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  // Una novedad asociada a una persona también forma parte de su legajo.
  // Se registra como "otro" para no convertir automáticamente una novedad
  // operativa en una sanción o llamado de atención formal.
  if (data?.persona_id) {
    const referencia = data.registro_id
      ? `Registro #${data.registro_id}`
      : "Bitácora";
    const categoria = data.categoria || "Otro";
    const { data: historial, error: historialError } = await supabase
      .schema("equipo")
      .from("historial_personal")
      .insert({
        persona_id: data.persona_id,
        tipo: "otro",
        fecha: data.fecha_reporte || new Date().toISOString().slice(0, 10),
        descripcion: `[${referencia} · ${categoria}] ${data.descripcion}`,
        registrado_por: data.reportante || null,
      })
      .select("id")
      .single();
    if (historialError) throw historialError;
    return { ...data, historial_personal_id: historial?.id || null };
  }

  return data;
}

/**
 * Crea la novedad de vehículo y, si se pide, el ticket de Flota y/o el
 * escalamiento vinculado (mismo patrón que módulos → escalamientos).
 * payload: { registro_id, sede_id, sede_nombre, activo_id, activo_nombre, tipo, descripcion, reportante, fecha_reporte, crearTicket, prioridad, escalar, tipo_escalamiento }
 */
export async function createVehiculoNovedadConTicket(payload) {
  const {
    crearTicket,
    prioridad,
    escalar,
    tipo_escalamiento,
    ...novedadPayload
  } = payload;
  const novedad = await createVehiculoNovedad(novedadPayload);
  if (!novedad?.id) return { novedad, ticket: null, escalamiento: null };

  let ticket = null;
  if (crearTicket) {
    ticket = await createTicket({
      tipo: "correctivo",
      categoria: "Vehiculos",
      activo_id: novedad.activo_id,
      activo_nombre: novedad.activo_nombre,
      descripcion: novedad.descripcion,
      estado: "abierto",
      prioridad: prioridad || "media",
      sede_id: novedad.sede_id,
      sede: novedad.sede_nombre,
      // Nota: mnt_tickets NO tiene columna vehiculo_novedad_id (solo tiene
      // escalamiento_id). Antes se enviaba ese campo igual y rompía el
      // INSERT con "column vehiculo_novedad_id does not exist" — por eso
      // fallaba "Crear ticket automático" en vehículos.
    });
  }

  let escalamiento = null;
  if (escalar) {
    escalamiento = await createEscalamientoItem({
      registro_id: novedad.registro_id,
      tipo: tipo_escalamiento || "Otro",
      descripcion: `[Vehículo: ${novedad.activo_nombre || "sin nombre"}] ${novedad.descripcion}`,
      sede_id: novedad.sede_id,
      sede_nombre: novedad.sede_nombre,
      reportante: novedad.reportante,
      fecha_reporte: novedad.fecha_reporte,
      estado: "Pendiente",
    });
  }

  return { novedad, ticket, escalamiento };
}

// ═══════════════════════════════════════════════════════════
// NOVEDADES DE MÓDULO (categorías A-H del checklist de turno)
// ═══════════════════════════════════════════════════════════

export async function createModuloNovedad(payload) {
  const { data, error } = await db()
    .from("modulo_novedades")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Crea la novedad de módulo y, si se pidió escalar, el escalamiento vinculado
 * (mismo patrón que vehículo → mnt_tickets.vehiculo_novedad_id).
 * payload: { registro_id, sede_id, sede_nombre, modulo_key, modulo_label,
 *            severidad, descripcion, privada, reportante, fecha_reporte,
 *            estado, escalar, tipo_escalamiento }
 */
export async function createModuloNovedadConEscalamiento(payload) {
  const { escalar, tipo_escalamiento, ...novedadPayload } = payload;
  const novedad = await createModuloNovedad(novedadPayload);
  if (!escalar || !novedad?.id) return { novedad, escalamiento: null };
  const escalamiento = await createEscalamientoItem({
    registro_id: novedad.registro_id,
    tipo: tipo_escalamiento || "Otro",
    descripcion: `[${novedad.modulo_label || novedad.modulo_key}] ${novedad.descripcion}`,
    sede_id: novedad.sede_id,
    sede_nombre: novedad.sede_nombre,
    reportante: novedad.reportante,
    fecha_reporte: novedad.fecha_reporte,
    estado: "Pendiente",
    modulo_novedad_id: novedad.id,
  });
  return { novedad, escalamiento };
}

// ═══════════════════════════════════════════════════════════
// VUELOS POR ESCALA (plantilla semanal + novedades por vuelo)
// ═══════════════════════════════════════════════════════════

export const TIPOS_NOVEDAD_VUELO = [
  "OK",
  "Demora",
  "Cancelado",
  "Desvío",
  "Otro",
];

// Vuelos del día para una sede, en una fecha puntual (formato 'YYYY-MM-DD').
// Se usa en "Nuevo Reporte" → Vuelos del día.
// 1) Busca primero en el calendario real (vuelos_calendario), cargado mes a mes
//    desde el Excel de Aduana — refleja exactamente qué vuela ese día.
// 2) Si no hay datos de calendario para esa fecha (mes no cargado, o la tabla
//    todavía no existe), cae a la plantilla semanal aproximada (vuelos_programados),
//    por dia_semana (0=domingo..6=sábado, igual a Date.getDay()).
// 3) Excluye los vuelos que ya tienen una novedad cargada hoy para esta sede
//    (incluye 'OK': si un reporte anterior del mismo día ya lo chequeó —sea
//    "OK" o una novedad real—, no vuelve a aparecer en el siguiente reporte).
export async function getVuelosDelDia(sedeId, fecha) {
  if (!sedeId || !fecha) return [];

  let calendario = [];
  try {
    const { data, error } = await db()
      .from("vuelos_calendario")
      .select("*")
      .eq("sede_id", sedeId)
      .eq("fecha", fecha)
      .eq("activo", true)
      .order("orden");
    if (error) throw error;
    calendario = data || [];
  } catch (e) {
    console.error(
      "vuelos_calendario no disponible, uso plantilla semanal como fallback:",
      e,
    );
  }

  let lista;
  if (calendario.length > 0) {
    lista = calendario.map((v) => ({ ...v, _origen: "calendario" }));
  } else {
    const diaSemana = new Date(fecha + "T00:00:00").getDay();
    const { data, error } = await db()
      .from("vuelos_programados")
      .select("*")
      .eq("sede_id", sedeId)
      .eq("dia_semana", diaSemana)
      .eq("activo", true)
      .order("orden");
    if (error) throw error;
    lista = (data || []).map((v) => ({ ...v, _origen: "plantilla" }));
  }

  const { data: yaReportados, error: errRep } = await db()
    .from("vuelo_novedades")
    .select("vuelo_calendario_id, vuelo_programado_id")
    .eq("sede_id", sedeId)
    .eq("fecha_reporte", fecha);
  if (errRep) {
    console.error("No se pudo chequear vuelos ya reportados hoy:", errRep);
    return lista;
  }

  const idsCalendario = new Set(
    (yaReportados || [])
      .filter((n) => n.vuelo_calendario_id != null)
      .map((n) => n.vuelo_calendario_id),
  );
  const idsProgramados = new Set(
    (yaReportados || [])
      .filter((n) => n.vuelo_programado_id != null)
      .map((n) => n.vuelo_programado_id),
  );

  return lista.filter((v) =>
    v._origen === "calendario"
      ? !idsCalendario.has(v.id)
      : !idsProgramados.has(v.id),
  );
}

// Plantilla completa (los 7 días) de una sede, para la vista de administración.
export async function getVuelosPlantilla(sedeId) {
  if (!sedeId) return [];
  const { data, error } = await db()
    .from("vuelos_programados")
    .select("*")
    .eq("sede_id", sedeId)
    .order("dia_semana")
    .order("orden");
  if (error) throw error;
  return data || [];
}

export async function crearVueloPlantilla(payload) {
  const { data, error } = await db()
    .from("vuelos_programados")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarVueloPlantilla(id, payload) {
  const { data, error } = await db()
    .from("vuelos_programados")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarVueloPlantilla(id) {
  const { error } = await db().from("vuelos_programados").delete().eq("id", id);
  if (error) throw error;
}

// Novedad de un vuelo del día, ligada al registro de la bitácora.
// payload: { registro_id, sede_id, sede_nombre, vuelo_programado_id, vuelo_codigo,
//            destino, aerolinea, tipo, descripcion, reportante, fecha_reporte }
export async function createVueloNovedad(payload) {
  const { data, error } = await db()
    .from("vuelo_novedades")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getVueloNovedadesByRegistro(registroId) {
  if (!registroId) return [];
  const { data, error } = await db()
    .from("vuelo_novedades")
    .select(
      "id, registro_id, sede_id, sede_nombre, vuelo_codigo, destino, aerolinea, tipo, descripcion, estado, fecha_reporte, created_at",
    )
    .eq("registro_id", registroId)
    .order("id");
  if (error) throw error;
  return data || [];
}

export async function getPersonaNovedadesByRegistro(registroId) {
  if (!registroId) return [];
  const { data, error } = await db()
    .from("persona_novedades")
    .select(
      "id, registro_id, sede_id, sede_nombre, persona_id, persona_nombre, categoria, descripcion, reportante, fecha_reporte, estado, created_at",
    )
    .eq("registro_id", registroId)
    .order("id");
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════════════════════
// MANTENIMIENTO
// ═══════════════════════════════════════════════════════════

// ─── RESPONSABLES MNT ───────────────────────────────────────
// Sugiere responsable para un ticket nuevo usando las reglas de escalación
// (categoria+prioridad → responsable) con fallback al nivel 1 activo.
// Devuelve { id, nombre } o null si no hay a quién asignar.
export async function sugerirResponsable({
  categoria = null,
  prioridad = null,
} = {}) {
  const [{ data: reglas }, { data: resps }] = await Promise.all([
    supabase
      .schema("mantenimiento")
      .from("reglas_escalacion")
      .select("*")
      .eq("activo", true),
    supabase
      .from("mnt_responsables")
      .select("id,nombre,nivel_escalacion")
      .eq("activo", true)
      .order("nivel_escalacion"),
  ]);
  const encontrar = (id) => (resps || []).find((r) => r.id === id) || null;
  const exacta = (reglas || []).find(
    (r) =>
      r.categoria === categoria &&
      r.prioridad === prioridad &&
      r.responsable_id,
  );
  if (exacta) return encontrar(exacta.responsable_id);
  const porCategoria = (reglas || []).find(
    (r) => r.categoria === categoria && r.responsable_id,
  );
  if (porCategoria) return encontrar(porCategoria.responsable_id);
  const porPrioridad = (reglas || []).find(
    (r) => r.prioridad === prioridad && r.responsable_id,
  );
  if (porPrioridad) return encontrar(porPrioridad.responsable_id);
  return (resps || [])[0] || null;
}

export async function getResponsablesMnt() {
  const { data, error } = await supabase
    .from("mnt_responsables")
    .select("id,nombre,nivel_escalacion,rol,telefono,email")
    .eq("activo", true)
    .order("nombre");
  if (error) return [];
  return data ?? [];
}

// ─── ACTIVOS ────────────────────────────────────────────────
export async function getActivos(filtros = {}) {
  let q = supabase.from("mnt_activos").select("*").order("nombre");
  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  if (filtros.estado) q = q.eq("estado", filtros.estado);
  if (filtros.sedeIds?.length) q = q.in("sede_id", filtros.sedeIds);
  else if (filtros.sede_id) q = q.eq("sede_id", filtros.sede_id);
  if (filtros.sede) q = q.eq("sede", filtros.sede);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const registroIds = [
    ...new Set(
      rows
        .filter(
          (r) =>
            !r.usuario_nombre &&
            !r.usuario_email &&
            ["registros", "bitacora.registros"].includes(r.tabla),
        )
        .map((r) => Number(r.registro_id))
        .filter(Number.isInteger),
    ),
  ];

  if (!registroIds.length) return rows;

  const { data: registros, error: registrosError } = await db()
    .from("registros")
    .select("id,reportante,email_reportante")
    .in("id", registroIds);

  if (registrosError) {
    console.warn(
      "[audit] No se pudieron recuperar los reportantes:",
      registrosError.message,
    );
    return rows;
  }

  return enrichAuditRowsWithReporters(rows, registros || []);
}
export async function upsertActivo(payload) {
  const { data, error } = await supabase
    .from("mnt_activos")
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getActivoById(id) {
  const { data, error } = await supabase
    .from("mnt_activos")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ─── TICKETS ────────────────────────────────────────────────
export const TICKET_TIPOS_VALIDOS = ["correctivo", "preventivo"];

export async function getTickets(filtros = {}) {
  let q = supabase
    .from("mnt_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (filtros.estado) q = q.eq("estado", filtros.estado);
  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  if (filtros.activo_id) q = q.eq("activo_id", filtros.activo_id);
  if (filtros.responsable_id)
    q = q.eq("responsable_id", filtros.responsable_id);
  if (filtros.sedeIds?.length) q = q.in("sede_id", filtros.sedeIds);
  else if (filtros.sede_id) q = q.eq("sede_id", filtros.sede_id);
  if (filtros.sede) q = q.eq("sede", filtros.sede);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getTicketsActivo({ id, nombre } = {}) {
  const queries = [];
  if (id)
    queries.push(supabase.from("mnt_tickets").select("*").eq("activo_id", id));
  if (nombre)
    queries.push(
      supabase.from("mnt_tickets").select("*").eq("activo_nombre", nombre),
    );
  if (!queries.length) return [];

  const results = await Promise.all(queries);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;

  const ticketsById = new Map();
  results.forEach(({ data }) =>
    (data || []).forEach((ticket) => ticketsById.set(ticket.id, ticket)),
  );
  return [...ticketsById.values()].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  );
}
export async function getTicketsByEscalamientoIds(ids = []) {
  if (!ids?.length) return [];
  const { data, error } = await supabase
    .from("mnt_tickets")
    .select("id, numero, estado, escalamiento_id")
    .in("escalamiento_id", ids);
  if (error) throw error;
  return data ?? [];
}
function normalizeTicketPayload(payload = {}) {
  const { sede_nombre, ...normalized } = payload;
  if (!normalized.sede && sede_nombre) normalized.sede = sede_nombre;
  if (normalized.tipo && !TICKET_TIPOS_VALIDOS.includes(normalized.tipo)) {
    throw new Error(
      `Tipo de ticket no válido: ${normalized.tipo}. Elegí Correctivo o Preventivo.`,
    );
  }
  return normalized;
}

export async function createTicket(payload) {
  const { data, error } = await supabase
    .from("mnt_tickets")
    .insert(normalizeTicketPayload(payload))
    .select()
    .single();
  if (error) throw error;
  if (
    data?.id &&
    ["alta", "critica"].includes(String(data.prioridad).toLowerCase())
  ) {
    notifyHighPriority({
      module: "mantenimiento",
      entity_id: data.id,
      priority: data.prioridad,
    });
  }
  return data;
}
export async function updateTicket(id, payload) {
  const normalized = normalizeTicketPayload(payload);
  const { data, error } = await supabase
    .from("mnt_tickets")
    .update({ ...normalized, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  if (
    data?.id &&
    ["alta", "critica"].includes(String(data.prioridad).toLowerCase())
  ) {
    notifyHighPriority({
      module: "mantenimiento",
      entity_id: data.id,
      priority: data.prioridad,
    });
  }
  return data;
}

// ─── PROVEEDORES ────────────────────────────────────────────
export async function getProveedores(sedeIds = null) {
  let q = supabase.from("mnt_proveedores").select("*").order("nombre");
  const { data, error } = await q;
  if (error) throw error;
  const all = data ?? [];
  if (!sedeIds?.length) return all;
  // Proveedor sin sede asignada (sede_ids vacío) = general, visible para todas las sedes.
  return all.filter(
    (p) => !p.sede_ids?.length || p.sede_ids.some((id) => sedeIds.includes(id)),
  );
}
export async function upsertProveedor(payload) {
  const { data, error } = await supabase
    .from("mnt_proveedores")
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── PLANES PREVENTIVOS ─────────────────────────────────────
export async function getPlanes(activoId) {
  let q = supabase.from("mnt_planes").select("*").order("proxima_fecha");
  if (activoId) q = q.eq("activo_id", activoId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ─── MATAFUEGOS ─────────────────────────────────────────────
export async function getMatafuegos(filtros = {}) {
  let q = supabase
    .from("mnt_matafuegos")
    .select("*")
    .order("sede")
    .order("codigo");
  if (filtros.sedeIds?.length) q = q.in("sede_id", filtros.sedeIds);
  else if (filtros.sede_id) q = q.eq("sede_id", filtros.sede_id);
  if (filtros.sede) q = q.eq("sede", filtros.sede);
  if (filtros.activo_id) q = q.eq("activo_id", filtros.activo_id);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertMatafuego(payload) {
  const { data, error } = await supabase
    .from("mnt_matafuegos")
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── DOCUMENTOS / POEs DE FLOTA ─────────────────────────────
export async function getPoes(filtros = {}) {
  let q = supabase
    .from("mnt_documentos_flota")
    .select("*")
    .order("vencimiento", { ascending: true });
  if (filtros.activo_id) q = q.eq("activo_id", filtros.activo_id);
  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  if (filtros.estado) q = q.eq("estado", filtros.estado);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertPoe(payload) {
  const { data, error } = await supabase
    .from("mnt_documentos_flota")
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePoe(id) {
  const { error } = await supabase
    .from("mnt_documentos_flota")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── INSUMOS ────────────────────────────────────────────────
export async function getInsumos(filtros = {}) {
  let q = supabase.from("mnt_insumos").select("*").order("nombre");
  if (filtros.sedeIds?.length) q = q.in("sede_id", filtros.sedeIds);
  else if (filtros.sede_id) q = q.eq("sede_id", filtros.sede_id);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function registrarMovimiento(payload) {
  // Registrar movimiento y actualizar stock
  const { data: insumo } = await supabase
    .from("mnt_insumos")
    .select("stock_actual")
    .eq("id", payload.insumo_id)
    .single();
  const delta =
    payload.tipo === "salida" ? -payload.cantidad : payload.cantidad;
  await supabase
    .from("mnt_insumos")
    .update({ stock_actual: (insumo?.stock_actual || 0) + delta })
    .eq("id", payload.insumo_id);
  const { data, error } = await supabase
    .from("mnt_movimientos")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── KPIs MANTENIMIENTO ─────────────────────────────────────
export async function getKPIsMantenimiento(sedeId = null, sedeIds = null) {
  let tq = supabase
    .from("mnt_tickets")
    .select("estado, tipo, prioridad, sede_id");
  let aq = supabase
    .from("mnt_activos")
    .select(
      "estado, tipo, sede_id, vencimiento_seguro, vencimiento_vtv, vencimiento_senasa, vencimiento_rmtsa",
    );
  let mq = supabase
    .from("mnt_matafuegos")
    .select("estado, vencimiento, sede_id");
  if (sedeIds?.length) {
    tq = tq.in("sede_id", sedeIds);
    aq = aq.in("sede_id", sedeIds);
    mq = mq.in("sede_id", sedeIds);
  } else if (sedeId) {
    tq = tq.eq("sede_id", sedeId);
    aq = aq.eq("sede_id", sedeId);
    mq = mq.eq("sede_id", sedeId);
  }
  const [{ data: tickets }, { data: activos }, { data: matafuegos }] =
    await Promise.all([tq, aq, mq]);
  const hoy = new Date().toISOString().split("T")[0];
  const docVencida = (a) =>
    [
      a.vencimiento_seguro,
      a.vencimiento_vtv,
      a.vencimiento_senasa,
      a.vencimiento_rmtsa,
    ].some((f) => f && f < hoy);
  return {
    ticketsAbiertos: (tickets || []).filter((t) => t.estado === "abierto")
      .length,
    ticketsCriticos: (tickets || []).filter(
      (t) => t.prioridad === "critica" && t.estado !== "resuelto",
    ).length,
    activosEnReparacion: (activos || []).filter(
      (a) => a.estado === "en_reparacion",
    ).length,
    matafuegosVencidos: (matafuegos || []).filter(
      (m) => m.vencimiento && m.vencimiento < hoy,
    ).length,
    vehiculosDocVencida: (activos || []).filter(
      (a) => a.tipo === "VEHICULO" && docVencida(a),
    ).length,
    totalActivos: (activos || []).length,
    totalTickets: (tickets || []).length,
  };
}

// ═══════════════════════════════════════════════════════════
// SEDE CONTACTOS (responsables por sede)
// ═══════════════════════════════════════════════════════════
// Teléfonos útiles de una sede: responsables cargados (auto) + contactos del
// directorio fijados a esa sede (manual). Devuelve forma unificada para UI.
export async function getTelefonosUtilesSede(sedeId) {
  if (!sedeId) return [];
  const [resp, { data: dir }] = await Promise.all([
    getSedeContactos(sedeId),
    db().from("directorio_contactos").select("*").eq("activo", true).or(`sede_ids.cs.{${sedeId}},sede_id.eq.${sedeId}`).order("orden"),
  ]);
  const soloDigitos = (t) => String(t || "").replace(/[^\d]/g, "");
  const deResp = (resp || [])
    .filter((r) => r.contactos)
    .map((r) => ({
      id: `resp-${r.id}`,
      nombre: r.contactos.nombre,
      rol: r.rol || r.contactos.cargo || "Responsable",
      telefono: r.contactos.telefono,
      tel: soloDigitos(r.contactos.telefono),
      wa: soloDigitos(r.contactos.telefono),
      email: r.contactos.email,
      icono: "👤",
      origen: "responsable",
    }));
  const deDir = (dir || []).map((c) => ({
    id: `dir-${c.id}`,
    nombre: c.nombre,
    rol: c.descripcion || "Contacto",
    telefono: c.telefono,
    tel: c.tel || soloDigitos(c.telefono),
    wa: c.wa || soloDigitos(c.telefono),
    email: c.email,
    icono: c.icono || "📇",
    origen: "directorio",
  }));
  return [...deResp, ...deDir].filter((c) => c.telefono || c.email);
}

export async function getSedeContactos(sedeId) {
  const { data, error } = await db()
    .from("sede_contactos")
    .select(
      "id, rol, activo, contactos(id, nombre, email, telefono, cargo, perfil_id)",
    )
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .order("rol");
  if (error) return [];
  return data ?? [];
}

export async function getAllSedeContactos(sedeIds = null) {
  let query = db()
    .from("sede_contactos")
    .select(
      "id, sede_id, contacto_id, rol, activo, sedes(nombre), contactos(id, nombre, email, telefono, cargo, perfil_id)",
    )
    .order("sede_id");
  if (sedeIds?.length) query = query.in("sede_id", sedeIds);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function updateContacto(id, payload) {
  const { data, error } = await db()
    .from("contactos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Vincula un contacto a un usuario del sistema y sincroniza sede_ids del perfil
export async function linkContactoToPerfil(contactoId, perfilId) {
  // 1. Obtener todas las sedes donde aparece este contacto
  const { data: asignaciones } = await db()
    .from("sede_contactos")
    .select("sede_id")
    .eq("contacto_id", contactoId)
    .eq("activo", true);
  const sedeIds = (asignaciones || []).map((a) => a.sede_id);

  // 2. Actualizar contacto con perfil_id
  await db()
    .from("contactos")
    .update({ perfil_id: perfilId || null })
    .eq("id", contactoId);

  // 3. Sincronizar sede_ids del perfil (si se vinculó uno)
  if (perfilId && sedeIds.length > 0) {
    await db()
      .from("perfiles")
      .update({ sede_ids: sedeIds })
      .eq("id", perfilId);
  }
}

export async function upsertSedeContacto(payload) {
  const { data, error } = await db()
    .from("sede_contactos")
    .upsert(payload, { onConflict: "sede_id,contacto_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSedeContacto(id) {
  const { error } = await db().from("sede_contactos").delete().eq("id", id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// REQUERIMIENTOS DE COMPRAS
// ═══════════════════════════════════════════════════════════
export async function getRequerimientos(filtros = {}) {
  let q = db()
    .from("requerimientos")
    .select("*, sedes(nombre)")
    .order("created_at", { ascending: false });
  if (filtros.estado) q = q.eq("estado", filtros.estado);
  if (filtros.urgencia) q = q.eq("urgencia", filtros.urgencia);
  if (filtros.sedeIds?.length) q = q.in("sede_id", filtros.sedeIds);
  else if (filtros.sedeId) q = q.eq("sede_id", filtros.sedeId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createRequerimiento(payload) {
  const { data, error } = await db()
    .from("requerimientos")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  if (data?.id && data.urgencia === "alta") {
    notifyHighPriority({
      module: "compras",
      entity_id: data.id,
      priority: data.urgencia,
    });
  }
  return data;
}

export async function updateRequerimiento(id, payload) {
  const { data, error } = await db()
    .from("requerimientos")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  if (data?.id && data.urgencia === "alta") {
    notifyHighPriority({
      module: "compras",
      entity_id: data.id,
      priority: data.urgencia,
    });
  }
  return data;
}

export async function crearEntregaCompras({ sedeId, requerimientoIds, contactoId = null }) {
  const ids = (requerimientoIds || []).map(Number).filter(Number.isInteger);
  if (!Number.isInteger(Number(sedeId)) || !ids.length) {
    throw new Error("La sede y los requerimientos del retiro son obligatorios.");
  }
  const { data, error } = await supabase.rpc("crear_entrega_compras", {
    p_sede_id: Number(sedeId),
    p_requerimiento_ids: ids,
    p_contacto_id: contactoId || null,
  });
  if (error) throw error;
  return data;
}

export async function registrarAvisoEntregaCompras(entregaId) {
  if (!entregaId) throw new Error("Falta el identificador del retiro.");
  const { data, error } = await supabase.rpc("registrar_aviso_entrega_compras", {
    p_entrega_id: entregaId,
  });
  if (error) throw error;
  return data;
}

export async function confirmarEntregaCompras({ entregaId, items, observaciones = null }) {
  if (!entregaId || !Array.isArray(items) || !items.length) {
    throw new Error("El retiro y sus artículos son obligatorios.");
  }
  const { data, error } = await supabase.rpc("confirmar_entrega_compras", {
    p_entrega_id: entregaId,
    p_items: items,
    p_observaciones: observaciones || null,
  });
  if (error) throw error;
  return data;
}

export async function bulkInsertContactos(contactos) {
  // Normalizar: email vacío → null para respetar el UNIQUE constraint
  const normalized = contactos.map((c) => ({
    ...c,
    email: c.email?.trim() || null,
  }));
  // Split: with email (upsert) vs without email (insert only)
  const conEmail = normalized.filter((c) => c.email);
  const sinEmail = normalized.filter((c) => !c.email);
  const results = [];

  if (conEmail.length > 0) {
    const { data, error } = await db()
      .from("contactos")
      .upsert(conEmail, { onConflict: "email", ignoreDuplicates: false })
      .select();
    if (error) throw error;
    results.push(...(data || []));
  }
  if (sinEmail.length > 0) {
    const { data, error } = await db()
      .from("contactos")
      .insert(sinEmail)
      .select();
    if (error) throw error;
    results.push(...(data || []));
  }
  return results;
}

// ═══════════════════════════════════════════════════════════
// AUDITORÍA UNIVERSAL
// ═══════════════════════════════════════════════════════════

/**
 * Inserta un registro manual en la auditoría (para acciones sin trigger DB).
 * tabla: string, registro_id: string|null, accion: string, descripcion: string, extras: {}
 */
export async function logAuditoria({
  tabla,
  registro_id,
  accion,
  descripcion,
  campo,
  valor_antes,
  valor_nuevo,
  sede_id,
  sede_nombre,
} = {}) {
  try {
    await supabase.rpc("log_auditoria", {
      p_tabla: tabla,
      p_registro_id: registro_id ? String(registro_id) : null,
      p_accion: accion,
      p_descripcion: descripcion,
      p_campo: campo || null,
      p_valor_antes: valor_antes || null,
      p_valor_nuevo: valor_nuevo || null,
      p_sede_id: sede_id || null,
      p_sede_nombre: sede_nombre || null,
    });
  } catch (e) {
    // Audit log nunca debe romper el flujo
    console.warn("[audit]", e?.message);
  }
}

/**
 * Lee el log de auditoría con filtros opcionales.
 * filtros: { tabla, registro_id, usuario_id, accion, desde, hasta, limit }
 */
export async function getAuditoria(filtros = {}) {
  let q = supabase
    .from("v_auditoria")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filtros.limit || 500);

  if (filtros.tabla) q = q.eq("tabla", filtros.tabla);
  if (filtros.registro_id) q = q.eq("registro_id", String(filtros.registro_id));
  if (filtros.usuario_id) q = q.eq("usuario_id", filtros.usuario_id);
  if (filtros.accion) q = q.eq("accion", filtros.accion);
  if (filtros.desde) q = q.gte("created_at", filtros.desde);
  if (filtros.hasta) q = q.lte("created_at", filtros.hasta);
  if (filtros.buscar) q = q.ilike("descripcion", `%${filtros.buscar}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Alias: auditoría específica de un ticket
 */
export async function getAuditoriaTicket(ticketId) {
  return getAuditoria({
    tabla: "mantenimiento.tickets",
    registro_id: ticketId,
    limit: 100,
  });
}

// ═══════════════════════════════════════════════════════════
// ALERTAS / NOTIFICACIONES INTERNAS
// ═══════════════════════════════════════════════════════════

/**
 * Devuelve un objeto con conteos de alertas activas.
 * Se llama al cargar la app y se puede refrescar cada N minutos.
 */
export async function getAlertas() {
  try {
    const [ticketsRes, matafuegosRes, capaRes, vehiculosRes] =
      await Promise.all([
        supabase
          .from("mnt_tickets")
          .select(
            "id, responsable_id, prioridad, estado, fecha_limite, created_at",
          ),
        supabase.from("mnt_matafuegos").select("id, vencimiento, estado"),
        db()
          .from("capa")
          .select("id, codigo, estado, fecha_limite, sede_nombre")
          .not("estado", "in", '("Completada","Verificada")')
          .not("fecha_limite", "is", null),
        supabase
          .from("mnt_activos")
          .select(
            "id, nombre, vencimiento_seguro, vencimiento_vtv, vencimiento_senasa, vencimiento_rmtsa",
          )
          .eq("tipo", "VEHICULO"),
      ]);

    const tickets = ticketsRes.data ?? [];
    const matafuegos = matafuegosRes.data ?? [];
    const capas = capaRes.data ?? [];
    const vehiculos = vehiculosRes.data ?? [];
    const ahora = new Date();
    const en7dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const en30dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);

    const abiertos = tickets.filter(
      (t) => !["resuelto", "cerrado"].includes(t.estado),
    );
    const sinAsignar = abiertos.filter((t) => !t.responsable_id);
    const vencidosSLA = abiertos.filter(
      (t) => t.fecha_limite && new Date(t.fecha_limite) < ahora,
    );
    const criticos = abiertos.filter((t) => t.prioridad === "critica");

    // Tickets abiertos hace más de 30 días
    const diasAbiertoMax = 30;
    const antiguos = abiertos.filter((t) => {
      const dias = (ahora - new Date(t.created_at)) / (1000 * 60 * 60 * 24);
      return dias > diasAbiertoMax;
    });

    const matafuegosVencidos = matafuegos.filter(
      (m) => m.vencimiento && new Date(m.vencimiento) < ahora,
    );
    const matafuegosPorVencer = matafuegos.filter(
      (m) =>
        m.vencimiento &&
        new Date(m.vencimiento) >= ahora &&
        new Date(m.vencimiento) <= en30dias,
    );

    const DOC_FIELDS = [
      "vencimiento_seguro",
      "vencimiento_vtv",
      "vencimiento_senasa",
      "vencimiento_rmtsa",
    ];
    const vehiculosDocVencida = vehiculos.filter((v) =>
      DOC_FIELDS.some((f) => v[f] && new Date(v[f]) < ahora),
    );
    const vehiculosDocPorVencer = vehiculos.filter(
      (v) =>
        !DOC_FIELDS.some((f) => v[f] && new Date(v[f]) < ahora) &&
        DOC_FIELDS.some(
          (f) => v[f] && new Date(v[f]) >= ahora && new Date(v[f]) <= en30dias,
        ),
    );

    const alertas = [];

    if (criticos.length > 0) {
      alertas.push({
        id: "criticos",
        nivel: "critico",
        mensaje: `${criticos.length} ticket${criticos.length > 1 ? "s" : ""} CRÍTICO${criticos.length > 1 ? "S" : ""} abierto${criticos.length > 1 ? "s" : ""}`,
        count: criticos.length,
        navegarA: "mntTickets",
      });
    }

    if (vencidosSLA.length > 0) {
      alertas.push({
        id: "vencidos_sla",
        nivel: "critico",
        mensaje: `${vencidosSLA.length} ticket${vencidosSLA.length > 1 ? "s" : ""} con SLA vencido`,
        count: vencidosSLA.length,
        navegarA: "mntTickets",
      });
    }

    if (matafuegosVencidos.length > 0) {
      alertas.push({
        id: "matafuegos_vencidos",
        nivel: "critico",
        mensaje: `${matafuegosVencidos.length} matafuego${matafuegosVencidos.length > 1 ? "s" : ""} vencido${matafuegosVencidos.length > 1 ? "s" : ""}`,
        count: matafuegosVencidos.length,
        navegarA: "mntMatafuegos",
      });
    }

    if (vehiculosDocVencida.length > 0) {
      alertas.push({
        id: "flota_doc_vencida",
        nivel: "critico",
        mensaje: `${vehiculosDocVencida.length} vehículo${vehiculosDocVencida.length > 1 ? "s" : ""} con documentación vencida`,
        count: vehiculosDocVencida.length,
        navegarA: "flotaGestion",
      });
    }

    if (sinAsignar.length > 0) {
      alertas.push({
        id: "sin_asignar",
        nivel: "advertencia",
        mensaje: `${sinAsignar.length} ticket${sinAsignar.length > 1 ? "s" : ""} sin asignar`,
        count: sinAsignar.length,
        navegarA: "mntKanban",
      });
    }

    if (matafuegosPorVencer.length > 0) {
      alertas.push({
        id: "matafuegos_por_vencer",
        nivel: "advertencia",
        mensaje: `${matafuegosPorVencer.length} matafuego${matafuegosPorVencer.length > 1 ? "s" : ""} vencen en 30 días`,
        count: matafuegosPorVencer.length,
        navegarA: "mntMatafuegos",
      });
    }

    if (vehiculosDocPorVencer.length > 0) {
      alertas.push({
        id: "flota_doc_por_vencer",
        nivel: "advertencia",
        mensaje: `${vehiculosDocPorVencer.length} vehículo${vehiculosDocPorVencer.length > 1 ? "s" : ""} con documentación vence en 30 días`,
        count: vehiculosDocPorVencer.length,
        navegarA: "flotaGestion",
      });
    }

    if (antiguos.length > 0) {
      alertas.push({
        id: "antiguos",
        nivel: "info",
        mensaje: `${antiguos.length} ticket${antiguos.length > 1 ? "s" : ""} abierto${antiguos.length > 1 ? "s" : ""} hace +30 días`,
        count: antiguos.length,
        navegarA: "mntTickets",
      });
    }

    // CAPA vencidas
    const capaVencidas = capas.filter((c) => new Date(c.fecha_limite) < ahora);
    if (capaVencidas.length > 0) {
      alertas.push({
        id: "capa_vencidas",
        nivel: "critico",
        mensaje: `${capaVencidas.length} CAPA${capaVencidas.length > 1 ? "s" : ""} vencida${capaVencidas.length > 1 ? "s" : ""}`,
        count: capaVencidas.length,
        navegarA: "capa",
      });
    }

    const capaPorVencer = capas.filter(
      (c) =>
        c.fecha_limite &&
        new Date(c.fecha_limite) >= ahora &&
        new Date(c.fecha_limite) <= en7dias,
    );
    if (capaPorVencer.length > 0) {
      alertas.push({
        id: "capa_por_vencer",
        nivel: "advertencia",
        mensaje: `${capaPorVencer.length} CAPA${capaPorVencer.length > 1 ? "s" : ""} vence${capaPorVencer.length > 1 ? "n" : ""} en 7 días`,
        count: capaPorVencer.length,
        navegarA: "capa",
      });
    }

    return alertas;
  } catch (err) {
    console.error("[getAlertas]", err);
    return [];
  }
}

// ── Eventos de mantenimiento para Calendario ──────────────────────────────────
// Retorna eventos de todas las áreas visibles para la sesión actual.
export async function getEventosCalendario(anio, mes) {
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const hasta = format(endOfMonth(new Date(anio, mes - 1, 1)), "yyyy-MM-dd");

  const resultados = await Promise.allSettled([
    supabase
      .from("mnt_tickets")
      .select("id, numero, descripcion, fecha_limite, estado, prioridad, sede")
      .gte("fecha_limite", desde)
      .lte("fecha_limite", hasta)
      .not("estado", "in", '("resuelto","cerrado")'),

    db()
      .from("capa")
      .select(
        "id, codigo, descripcion, responsable, fecha_limite, estado, sede_nombre",
      )
      .gte("fecha_limite", desde)
      .lte("fecha_limite", hasta)
      .not("estado", "in", '("Completada","Verificada")'),

    db()
      .from("tareas")
      .select("id, titulo, responsable, fecha_limite, estado, prioridad")
      .gte("fecha_limite", desde)
      .lte("fecha_limite", hasta)
      .not("estado", "in", '("Resuelto","Cancelado")'),

    db()
      .from("requerimientos")
      .select(
        "id, numero, descripcion, sede_nombre, estado, urgencia, fecha_necesidad, fecha_compromiso",
      )
      .or(
        `and(fecha_necesidad.gte.${desde},fecha_necesidad.lte.${hasta}),and(fecha_compromiso.gte.${desde},fecha_compromiso.lte.${hasta})`,
      )
      .not("estado", "in", '("Cumplido","Rechazado","Cancelado")'),

    supabase
      .from("mnt_planes")
      .select(
        "id, nombre, proxima_fecha, frecuencia, activo_nombre, responsable_nombre, estado, activo",
      )
      .gte("proxima_fecha", desde)
      .lte("proxima_fecha", hasta)
      .eq("activo", true),

    supabase
      .from("mnt_matafuegos")
      .select("id, codigo, sede_nombre, ubicacion, vencimiento, estado")
      .gte("vencimiento", desde)
      .lte("vencimiento", hasta),

    supabase
      .from("mnt_activos")
      .select(
        "id, nombre, vencimiento_seguro, vencimiento_vtv, vencimiento_senasa, vencimiento_rmtsa",
      )
      .eq("tipo", "VEHICULO"),

    db()
      .from("documentacion_items")
      .select(
        "id, entity_type, entity_id, titulo, seccion, estado, fecha_vencimiento, aviso_dias",
      )
      .gte("fecha_vencimiento", desde)
      .lte("fecha_vencimiento", hasta),

    supabase
      .schema("equipo")
      .from("reclutamiento_entrevistas")
      .select(
        "id, candidato_id, fecha_entrevista, hora_entrevista, entrevistador, nombre_apellido",
      )
      .gte("fecha_entrevista", desde)
      .lte("fecha_entrevista", hasta),

    supabase
      .schema("equipo")
      .from("reclutamiento_candidatos")
      .select(
        "id, nombre_apellido, estado, fecha_preocupacional, fecha_ingreso, induccion_at",
      )
      .or(
        `and(fecha_preocupacional.gte.${desde},fecha_preocupacional.lte.${hasta}),and(fecha_ingreso.gte.${desde},fecha_ingreso.lte.${hasta}),and(induccion_at.gte.${desde}T00:00:00,induccion_at.lte.${hasta}T23:59:59)`,
      ),
  ]);

  const nombres = [
    "tickets",
    "capas",
    "tareas",
    "requerimientos",
    "planes",
    "matafuegos",
    "vehiculos",
    "documentacion",
    "entrevistas",
    "candidatos",
  ];
  const datos = Object.fromEntries(
    nombres.map((nombre, index) => {
      const resultado = resultados[index];
      if (resultado.status === "rejected" || resultado.value?.error) {
        const error =
          resultado.status === "rejected"
            ? resultado.reason
            : resultado.value.error;
        console.warn(
          `[calendario] No se pudo cargar ${nombre}:`,
          error?.message || error,
        );
        return [nombre, []];
      }
      return [nombre, resultado.value.data || []];
    }),
  );

  const mapa = {};
  const agregar = (diaStr, color, label, sub = "", categoria = "general") => {
    if (!diaStr) return;
    const fecha = diaStr.slice(0, 10);
    if (fecha < desde || fecha > hasta) return;
    if (!mapa[fecha]) mapa[fecha] = [];
    mapa[fecha].push({ color, label, sub, categoria });
  };

  for (const t of datos.tickets) {
    const color =
      t.prioridad === "critica"
        ? "#FF2A2A"
        : t.prioridad === "alta"
          ? "#F59E0B"
          : "#50b4ff";
    agregar(
      t.fecha_limite,
      color,
      `Ticket #${t.numero || ""}: ${t.descripcion || "Sin descripción"}`,
      t.sede || "",
      "mantenimiento",
    );
  }

  for (const c of datos.capas) {
    agregar(
      c.fecha_limite,
      "#a78bfa",
      `CAPA ${c.codigo || ""}: ${c.descripcion || "Acción pendiente"}`,
      [c.sede_nombre, c.responsable].filter(Boolean).join(" · "),
      "calidad",
    );
  }

  for (const t of datos.tareas) {
    agregar(
      t.fecha_limite,
      "#34d399",
      `Tarea: ${t.titulo || "Sin título"}`,
      t.responsable || "",
      "tareas",
    );
  }

  for (const r of datos.requerimientos) {
    const titulo = `Compra #${r.numero || r.id}: ${r.descripcion || "Requerimiento"}`;
    const detalle = [r.sede_nombre, r.estado].filter(Boolean).join(" · ");
    agregar(
      r.fecha_necesidad,
      "#f97316",
      `${titulo} — fecha de necesidad`,
      detalle,
      "compras",
    );
    agregar(
      r.fecha_compromiso,
      "#fb7185",
      `${titulo} — compromiso`,
      detalle,
      "compras",
    );
  }

  for (const p of datos.planes) {
    agregar(
      p.proxima_fecha,
      "#38bdf8",
      `Preventivo: ${p.nombre || "Plan"}`,
      [p.activo_nombre, p.responsable_nombre, p.frecuencia]
        .filter(Boolean)
        .join(" · "),
      "mantenimiento",
    );
  }

  for (const m of datos.matafuegos) {
    agregar(
      m.vencimiento,
      "#ef4444",
      `Matafuego ${m.codigo || ""}: vencimiento`,
      [m.sede_nombre, m.ubicacion].filter(Boolean).join(" · "),
      "vencimientos",
    );
  }

  const DOC_LABELS = {
    vencimiento_seguro: "Seguro",
    vencimiento_vtv: "VTV",
    vencimiento_senasa: "SENASA",
    vencimiento_rmtsa: "RMTSA",
  };
  for (const v of datos.vehiculos) {
    for (const [key, label] of Object.entries(DOC_LABELS)) {
      agregar(
        v[key],
        "#FF2A2A",
        `Vehículo ${v.nombre}: ${label} vence`,
        "",
        "vencimientos",
      );
    }
  }

  const DOC_ENTITY_LABELS = {
    sede: "Sede",
    equipo: "Equipo",
    flota: "Flota",
    vehiculo: "Vehículo",
    activo: "Activo",
    persona: "Persona",
  };
  const hoy = new Date().toISOString().slice(0, 10);
  for (const d of datos.documentacion) {
    const fechaVence = d.fecha_vencimiento?.slice(0, 10);
    const vencida = fechaVence < hoy && d.estado !== "vigente";
    const color = vencida ? "#FF2A2A" : "#F59E0B";
    const entidad =
      DOC_ENTITY_LABELS[d.entity_type] || d.entity_type || "Entidad";
    const avisoDias = Number.isFinite(Number(d.aviso_dias))
      ? Number(d.aviso_dias)
      : 30;
    agregar(
      fechaVence,
      color,
      `Documentación: ${d.titulo || "Ítem documental"} vence`,
      `${entidad}${d.seccion ? ` · ${d.seccion}` : ""} · aviso ${avisoDias} d`,
      "vencimientos",
    );
  }

  for (const e of datos.entrevistas) {
    agregar(
      e.fecha_entrevista,
      "#e879f9",
      `Entrevista: ${e.nombre_apellido || "Candidato"}`,
      [
        e.hora_entrevista ? `${e.hora_entrevista.slice(0, 5)} hs` : "",
        e.entrevistador,
      ]
        .filter(Boolean)
        .join(" · ") || "RRHH",
      "rrhh",
    );
  }

  for (const c of datos.candidatos) {
    const detalle = c.nombre_apellido || "Candidato";
    agregar(
      c.fecha_preocupacional,
      "#c084fc",
      `Preocupacional: ${detalle}`,
      c.estado || "",
      "rrhh",
    );
    agregar(
      c.fecha_ingreso,
      "#8b5cf6",
      `Ingreso programado: ${detalle}`,
      c.estado || "",
      "rrhh",
    );
    agregar(
      c.induccion_at,
      "#7c3aed",
      `Inducción: ${detalle}`,
      c.estado || "",
      "rrhh",
    );
  }

  for (const eventos of Object.values(mapa)) {
    eventos.sort(
      (a, b) =>
        a.categoria.localeCompare(b.categoria) ||
        a.label.localeCompare(b.label),
    );
  }

  return mapa;
}

// ── Auto-escalar tickets críticos/vencidos ────────────────────────────────────
export async function autoEscalarTickets() {
  try {
    const ahora = new Date().toISOString();
    const { data: tickets } = await supabase
      .schema("mantenimiento")
      .from("tickets")
      .select("id, descripcion, prioridad, fecha_limite, sede_id, sede")
      .in("estado", ["abierto", "en_progreso"])
      .or(`prioridad.eq.critica,fecha_limite.lt.${ahora}`)
      .limit(20);

    if (!tickets?.length) return;

    const fechaHoy = new Date().toISOString().slice(0, 10);

    await Promise.all(
      tickets.map((t) =>
        db()
          .from("escalamientos")
          .upsert(
            {
              tipo: "Mantenimiento",
              descripcion: `Ticket ${t.prioridad === "critica" ? "crítico" : "vencido"}: ${t.descripcion}`,
              sede_id: t.sede_id || null,
              sede_nombre: t.sede || "",
              reportante: "Sistema",
              fecha_reporte: fechaHoy,
              estado: "Pendiente",
              registro_id: null,
            },
            {
              onConflict: "tipo,descripcion,fecha_reporte,sede_id",
              ignoreDuplicates: true,
            },
          ),
      ),
    );
  } catch (err) {
    console.error("[autoEscalarTickets]", err);
  }
}

// ─── COMENTARIOS POR REGISTRO ─────────────────────────────────────────────────
// entidadTipo: 'ticket' | 'tarea' | 'escalamiento' | 'no_conformidad'

// ─── CRONOGRAMA DE LIMPIEZA ───────────────────────────────────────────────────
export async function getCronogramaLimpieza(sedeId) {
  const { data, error } = await db().from("limpieza_cronograma")
    .select("*").eq("sede_id", sedeId).eq("activo", true).order("frecuencia").order("dia_semana");
  if (error) throw error;
  return data || [];
}

export async function updateCronogramaItem(id, cambios) {
  const { error } = await db().from("limpieza_cronograma")
    .update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Qué limpieza está pendiente HOY para una sede (diaria/semanal por día fijo/quincenal).
export async function getLimpiezaPendienteHoy(sedeId) {
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);
  const diaSemana = hoy.getDay() === 0 ? 7 : hoy.getDay(); // 1=lun … 7=dom
  const [{ data: crono }, { data: hechos }] = await Promise.all([
    db().from("limpieza_cronograma").select("*").eq("sede_id", sedeId).eq("activo", true),
    db().from("checklists").select("tipo,fecha,created_at")
      .eq("sede_id", sedeId).like("tipo", "limpieza_%")
      .order("created_at", { ascending: false }).limit(60),
  ]);
  const ultimo = (tipo) => (hechos || []).find(h => h.tipo === tipo);
  const diariaHoy = (hechos || []).some(h => h.tipo === "limpieza_diaria" && h.fecha === hoyISO);

  const semanalHoy = (crono || []).filter(c => c.frecuencia === "semanal" && c.dia_semana === diaSemana).map(c => c.item_texto);

  const ultQuincenal = ultimo("limpieza_quincenal");
  const diasQuincenal = ultQuincenal ? Math.floor((Date.now() - new Date(ultQuincenal.created_at)) / 86400000) : 999;
  const quincenalVence = diasQuincenal >= 14;

  return {
    diariaPendiente: !diariaHoy,
    semanalItems: semanalHoy,
    quincenalVence,
    diasSinQuincenal: ultQuincenal ? diasQuincenal : null,
  };
}

// ─── REACCIONES DE COMENTARIOS ────────────────────────────────────────────────
export async function getReacciones(comentarioIds) {
  if (!comentarioIds?.length) return [];
  const { data, error } = await db()
    .from("comentario_reacciones")
    .select("*")
    .in("comentario_id", comentarioIds);
  if (error) throw error;
  return data || [];
}

// Alterna una reacción del usuario actual (agrega si no está, quita si ya está).
export async function toggleReaccion({ comentarioId, usuarioId, usuarioNombre, emoji }) {
  const { data: existente } = await db()
    .from("comentario_reacciones")
    .select("id")
    .eq("comentario_id", comentarioId)
    .eq("usuario_id", usuarioId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existente?.id) {
    const { error } = await db().from("comentario_reacciones").delete().eq("id", existente.id);
    if (error) throw error;
    return { accion: "quitada" };
  }
  const { error } = await db().from("comentario_reacciones").insert({
    comentario_id: comentarioId, usuario_id: usuarioId, usuario_nombre: usuarioNombre, emoji,
  });
  if (error) throw error;
  return { accion: "agregada" };
}

export async function getComentarios(entidadTipo, entidadId) {
  if (!entidadId) return [];
  const { data, error } = await db()
    .from("comentarios")
    .select("*")
    .eq("entidad_tipo", entidadTipo)
    .eq("entidad_id", String(entidadId))
    .is("eliminado_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function crearComentario({
  entidadTipo,
  entidadId,
  autorId,
  autorNombre,
  texto,
  mencionadoUserIds = [],
}) {
  const { data, error } = await db()
    .from("comentarios")
    .insert({
      entidad_tipo: entidadTipo,
      entidad_id: String(entidadId),
      autor_id: autorId,
      autor_nombre: autorNombre || "Usuario",
      texto: texto.trim(),
    })
    .select();
  if (error) throw error;
  const created = data?.[0];
  if (created?.id) notifyComentario(created.id, mencionadoUserIds);
  return created;
}

export async function eliminarComentario(id) {
  const { error } = await db()
    .from("comentarios")
    .update({ eliminado_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
// DIRECTORIO DE CONTACTOS (bitacora.directorio_contactos)
// Contactos por módulo: rrhh | mantenimiento | flota | emergencias
// Distinto de bitacora.contactos que es el directorio de responsables de sede.
// ═══════════════════════════════════════════════════════════

export async function getDirectorio(modulo = null) {
  let q = db().from("directorio_contactos").select("*").eq("activo", true);
  if (modulo) q = q.eq("modulo", modulo);
  const { data, error } = await q.order("orden").order("nombre");
  if (error) throw error;
  return data || [];
}

export async function saveDirectorioContacto(payload) {
  const { id, ...rest } = payload;
  rest.updated_at = new Date().toISOString();
  if (id) {
    const { data, error } = await db()
      .from("directorio_contactos")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await db()
    .from("directorio_contactos")
    .insert(rest)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeDirectorioContacto(id) {
  const { error } = await db()
    .from("directorio_contactos")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
