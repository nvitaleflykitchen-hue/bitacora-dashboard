import { useEffect, useState } from "react";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { fmtFechaLarga } from "../lib/dateUtils";
import { mensajeError } from "../lib/errores";
import { generateFichaEntrevistaPdf } from "../lib/reclutamientoPdf";

function Dato({ label, value }) {
  const visible = value !== null && value !== undefined && value !== "";
  return (
    <div>
      <p style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>{label}</p>
      <p
        style={{
          fontSize: "0.78rem",
          color: visible ? "var(--text)" : "var(--text-dim)",
          overflowWrap: "anywhere",
        }}
      >
        {visible ? value : "Sin dato"}
      </p>
    </div>
  );
}

function Seccion({ title, children }) {
  return (
    <section className="glass p-4">
      <p
        className="font-metric text-xs mb-3"
        style={{ color: "var(--phosphor)", letterSpacing: "0.08em" }}
      >
        {title}
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">{children}</div>
    </section>
  );
}

function EntrevistaVinculada({ reclutamiento }) {
  if (!reclutamiento?.entrevista) return null;
  const { candidato, entrevista, solicitud } = reclutamiento;
  const fecha = (value) => (value ? fmtFechaLarga(value) : null);
  const pdfPayload = { candidate: candidato, entrevista, solicitud };

  return (
    <div className="space-y-4">
      <div
        className="glass p-3 flex items-center justify-between gap-4"
        style={{ borderColor: "rgba(57,255,20,0.22)" }}
      >
        <div>
          <p className="font-metric" style={{ color: "var(--phosphor)", fontSize: "0.68rem" }}>
            FICHA DE ENTREVISTA VINCULADA AL LEGAJO
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.62rem", marginTop: 3 }}>
            Conservada desde Selección de personal · {fecha(entrevista.fecha_entrevista) || "Sin fecha"}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost flex items-center gap-1.5"
          onClick={() => generateFichaEntrevistaPdf(pdfPayload)}
        >
          <Download size={13} /> PDF entrevista
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Seccion title="ENTREVISTA E INGRESO">
          <Dato label="Fecha de entrevista" value={fecha(entrevista.fecha_entrevista)} />
          <Dato label="Entrevistador" value={entrevista.entrevistador} />
          <Dato label="Fecha de ingreso" value={fecha(candidato.fecha_ingreso)} />
          <Dato label="Búsqueda / puesto" value={solicitud?.puesto} />
          <Dato label="Disponibilidad horaria" value={entrevista.disponibilidad_horaria} />
          <Dato label="Evaluación breve" value={candidato.evaluacion_breve} />
        </Seccion>
        <Seccion title="FORMACIÓN Y DOCUMENTACIÓN">
          <Dato label="Nivel de estudio" value={entrevista.nivel_estudio} />
          <Dato label="Estudios cursados" value={entrevista.estudios_cursados} />
          <Dato label="Estudia actualmente" value={entrevista.estudia_actualmente} />
          <Dato label="Carnet de conducir" value={entrevista.carnet_conducir} />
          <Dato label="Carnet sanitario" value={entrevista.carnet_sanitario ? "Sí" : "No"} />
          <Dato label="Antecedentes penales" value={entrevista.antecedentes_penales ? "Sí" : "No"} />
        </Seccion>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Seccion title="DATOS PERSONALES DE ENTREVISTA">
          <Dato label="Fecha de nacimiento" value={fecha(entrevista.fecha_nacimiento)} />
          <Dato label="Estado civil" value={entrevista.estado_civil} />
          <Dato label="Hijos menores" value={entrevista.hijos_menores} />
          <Dato label="Edades" value={entrevista.edades_hijos} />
          <Dato label="Nacionalidad" value={entrevista.nacionalidad} />
          <Dato label="Movilidad" value={entrevista.movilidad} />
          <Dato label="Enfermedades crónicas" value={entrevista.enfermedades_cronicas} />
          <Dato label="Recomendado por" value={entrevista.recomendado_por || candidato.recomendado_por} />
        </Seccion>
        <Seccion title="DOMICILIO E INDUMENTARIA">
          <Dato label="Domicilio" value={entrevista.domicilio} />
          <Dato label="Piso / Dpto." value={[entrevista.piso, entrevista.departamento].filter(Boolean).join(" / ")} />
          <Dato label="Barrio" value={entrevista.barrio} />
          <Dato label="Ciudad / CP" value={[entrevista.ciudad, entrevista.codigo_postal].filter(Boolean).join(" · ")} />
          <Dato label="Pantalón" value={entrevista.talle_pantalon} />
          <Dato label="Camisa / chomba" value={entrevista.talle_camisa} />
          <Dato label="Calzado" value={entrevista.talle_calzado} />
        </Seccion>
      </div>

      <Seccion title="OBSERVACIONES DE LA ENTREVISTA">
        <div className="col-span-2">
          <Dato label="Registro completo" value={entrevista.observaciones || candidato.notas} />
        </div>
      </Seccion>
    </div>
  );
}

export default function PersonaRrhhPanel({ personaId }) {
  const [ficha, setFicha] = useState(null);
  const [importacion, setImportacion] = useState(null);
  const [reclutamiento, setReclutamiento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      setLoading(true);
      setError("");
      const [fichaResult, candidatoResult] = await Promise.all([
        supabase.schema("equipo").from("persona_rrhh").select("*").eq("persona_id", personaId).maybeSingle(),
        supabase.schema("equipo").from("reclutamiento_candidatos").select("*").eq("persona_id", personaId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const { data, error: fichaError } = fichaResult;
      if (!vigente) return;
      if (fichaError) {
        setError(mensajeError(fichaError));
        setLoading(false);
        return;
      }
      setFicha(data || null);

      const candidato = candidatoResult.data || null;
      if (candidatoResult.error) {
        setError(mensajeError(candidatoResult.error));
        setReclutamiento(null);
      } else if (candidato) {
        const [entrevistaResult, solicitudResult] = await Promise.all([
          supabase.schema("equipo").from("reclutamiento_entrevistas").select("*").eq("candidato_id", candidato.id).maybeSingle(),
          candidato.solicitud_id
            ? supabase.schema("equipo").from("reclutamiento_solicitudes").select("*").eq("id", candidato.solicitud_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (!vigente) return;
        const recruitmentError = entrevistaResult.error || solicitudResult.error;
        if (recruitmentError) setError(mensajeError(recruitmentError));
        setReclutamiento({
          candidato,
          entrevista: entrevistaResult.data || null,
          solicitud: solicitudResult.data || null,
        });
      } else {
        setReclutamiento(null);
      }

      if (data?.importacion_id) {
        const { data: lote, error: loteError } = await supabase
          .schema("equipo")
          .from("importaciones_personal")
          .select("archivo_nombre,estado,creado_at")
          .eq("id", data.importacion_id)
          .maybeSingle();
        if (!vigente) return;
        if (loteError) setError(mensajeError(loteError));
        setImportacion(lote || null);
      } else {
        setImportacion(null);
      }
      setLoading(false);
    };
    cargar();
    return () => {
      vigente = false;
    };
  }, [personaId]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12 gap-2"
        style={{ color: "var(--text-dim)" }}
      >
        <Loader2 size={16} className="animate-spin" />
        <span className="font-metric" style={{ fontSize: "0.68rem" }}>
          CARGANDO FICHA PRIVADA...
        </span>
      </div>
    );
  }

  if (error && !ficha && !reclutamiento?.entrevista) {
    return (
      <div
        className="glass p-4"
        style={{ borderColor: "rgba(239,68,68,0.35)" }}
      >
        <p
          className="font-metric"
          style={{ color: "#ff5c5c", fontSize: "0.7rem" }}
        >
          NO SE PUDO LEER LA FICHA DE RR. HH.
        </p>
        <p
          style={{
            color: "var(--text-dim)",
            fontSize: "0.72rem",
            marginTop: 6,
          }}
        >
          {error}
        </p>
      </div>
    );
  }

  if (!ficha && !reclutamiento?.entrevista) {
    return (
      <div
        className="glass p-5"
        style={{ borderColor: "rgba(245,158,11,0.3)" }}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={20}
            style={{ color: "#f59e0b", flexShrink: 0 }}
          />
          <div>
            <p
              className="font-metric"
              style={{ color: "#f59e0b", fontSize: "0.72rem" }}
            >
              FICHA PRIVADA PENDIENTE
            </p>
            <p
              style={{
                color: "var(--text)",
                fontSize: "0.78rem",
                marginTop: 5,
              }}
            >
              Esta persona no fue incluida en la importación automática.
            </p>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.68rem",
                marginTop: 4,
              }}
            >
              Puede ser uno de los casos reservados para revisión manual o una
              persona sin datos en el archivo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fecha = (value) => (value ? fmtFechaLarga(value) : null);
  const horas = ficha?.carga_horaria_mensual
    ? `${Number(ficha.carga_horaria_mensual).toLocaleString("es-AR")} h/mes`
    : null;

  return (
    <div className="space-y-4">
      <EntrevistaVinculada reclutamiento={reclutamiento} />
      {ficha && (
        <>
      <div
        className="glass p-3 flex items-center justify-between gap-4"
        style={{ borderColor: "rgba(57,255,20,0.22)" }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} style={{ color: "var(--phosphor)" }} />
          <div>
            <p
              className="font-metric"
              style={{ color: "var(--phosphor)", fontSize: "0.68rem" }}
            >
              INFORMACIÓN PRIVADA · SOLO ADMINISTRADORES
            </p>
            <p style={{ color: "var(--text-dim)", fontSize: "0.62rem" }}>
              Datos personales y laborales protegidos por acceso restringido.
            </p>
          </div>
        </div>
        <span
          className="font-metric px-2 py-1 rounded"
          style={{
            color: "var(--phosphor)",
            background: "rgba(57,255,20,0.1)",
            fontSize: "0.6rem",
          }}
        >
          FICHA CARGADA
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Seccion title="DATOS PERSONALES">
          <Dato
            label="Fecha de nacimiento"
            value={fecha(ficha.fecha_nacimiento)}
          />
          <Dato label="Estado civil" value={ficha.estado_civil} />
          <Dato label="Movilidad" value={ficha.movilidad} />
          <Dato label="Localidad" value={ficha.localidad} />
        </Seccion>
        <Seccion title="CONTACTO DE EMERGENCIA">
          <Dato label="Teléfono" value={ficha.telefono_emergencia} />
          <Dato
            label="Vínculo / parentesco"
            value={ficha.parentesco_emergencia}
          />
        </Seccion>
      </div>

      <Seccion title="DOMICILIO">
        <Dato label="Calle" value={ficha.calle} />
        <Dato label="Numeración" value={ficha.numeracion} />
        <Dato label="Barrio" value={ficha.barrio} />
        <Dato label="Localidad" value={ficha.localidad} />
      </Seccion>

      <div className="grid grid-cols-2 gap-4">
        <Seccion title="DATOS LABORALES">
          <Dato label="Convenio" value={ficha.convenio} />
          <Dato label="Carga horaria" value={horas} />
          <Dato
            label="Categoría"
            value={[ficha.categoria_codigo, ficha.categoria_nombre]
              .filter(Boolean)
              .join(" · ")}
          />
          <Dato
            label="Antigüedad desde"
            value={fecha(ficha.fecha_antiguedad)}
          />
          <Dato label="Fecha de egreso" value={fecha(ficha.fecha_egreso)} />
          <Dato label="Sindicato" value={ficha.sindicato} />
          <Dato
            label="Centro"
            value={[ficha.centro_codigo, ficha.centro_descripcion]
              .filter(Boolean)
              .join(" · ")}
          />
          <Dato
            label="Liquidación / empresa"
            value={ficha.liquidacion_empresa_4}
          />
          <Dato label="Tarea declarada" value={ficha.tarea_empresa_4} />
          <Dato
            label="Lugar de trabajo"
            value={ficha.lugar_trabajo_declarado}
          />
          <Dato label="Puesto declarado" value={ficha.puesto_declarado} />
          <Dato label="Área declarada" value={ficha.area_declarada} />
        </Seccion>
        <Seccion title="INDUMENTARIA">
          <Dato label="Pantalón" value={ficha.talle_pantalon} />
          <Dato label="Prenda superior" value={ficha.talle_superior} />
          <Dato label="Abrigo" value={ficha.talle_abrigo} />
          <Dato label="Calzado" value={ficha.talle_calzado} />
          <Dato
            label="Foto / fuente de credencial"
            value={ficha.fotografia_credencial_fuente}
          />
        </Seccion>
      </div>

      <Seccion title="TRAZABILIDAD">
        <Dato label="Archivo fuente" value={importacion?.archivo_nombre} />
        <Dato label="Estado del lote" value={importacion?.estado} />
        <Dato label="Fila de origen" value={ficha.fuente_fila} />
        <Dato
          label="Coincidencia utilizada"
          value={ficha.criterios_coincidencia}
        />
        <Dato
          label="Fuentes consolidadas"
          value={ficha.fuentes_consolidadas}
        />
        <Dato
          label="Registros consolidados"
          value={ficha.cantidad_registros_personales}
        />
        <Dato
          label="Última actualización"
          value={
            ficha.actualizado_at
              ? new Date(ficha.actualizado_at).toLocaleString("es-AR")
              : null
          }
        />
        <Dato label="Observaciones" value={ficha.observaciones} />
      </Seccion>
        </>
      )}
      {error && (
        <p style={{ color: "#f59e0b", fontSize: "0.65rem" }}>
          La ficha se cargó, pero parte de la trazabilidad no pudo consultarse:{" "}
          {error}
        </p>
      )}
    </div>
  );
}
