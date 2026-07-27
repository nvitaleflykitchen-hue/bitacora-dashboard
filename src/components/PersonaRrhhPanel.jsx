import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { fmtFechaLarga } from "../lib/dateUtils";
import { mensajeError } from "../lib/errores";

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

export default function PersonaRrhhPanel({ personaId }) {
  const [ficha, setFicha] = useState(null);
  const [importacion, setImportacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      setLoading(true);
      setError("");
      const { data, error: fichaError } = await supabase
        .schema("equipo")
        .from("persona_rrhh")
        .select("*")
        .eq("persona_id", personaId)
        .maybeSingle();
      if (!vigente) return;
      if (fichaError) {
        setError(mensajeError(fichaError));
        setLoading(false);
        return;
      }
      setFicha(data || null);

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

  if (error && !ficha) {
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

  if (!ficha) {
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
  const horas = ficha.carga_horaria_mensual
    ? `${Number(ficha.carga_horaria_mensual).toLocaleString("es-AR")} h/mes`
    : null;

  return (
    <div className="space-y-4">
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
      {error && (
        <p style={{ color: "#f59e0b", fontSize: "0.65rem" }}>
          La ficha se cargó, pero parte de la trazabilidad no pudo consultarse:{" "}
          {error}
        </p>
      )}
    </div>
  );
}
