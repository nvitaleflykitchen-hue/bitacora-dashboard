ALTER TABLE equipo.personas
  ADD COLUMN IF NOT EXISTS legajo text;

COMMENT ON COLUMN equipo.personas.legajo IS
  'Número de legajo interno del empleado.';

CREATE OR REPLACE VIEW public.v_personas AS
SELECT
  p.id,
  p.perfil_id,
  p.nombre,
  p.apellido,
  p.dni,
  p.puesto,
  p.area,
  p.sede_ids,
  p.telefono,
  p.email,
  p.fecha_ingreso,
  p.fecha_baja,
  p.activo,
  p.descripcion_puesto,
  p.procesos,
  p.foto_url,
  p.created_at,
  p.updated_at,
  COALESCE((
    SELECT round(avg(e.puntaje_calculado), 1)
    FROM equipo.evaluaciones e
    WHERE e.persona_id = p.id
  ), 0::numeric) AS puntaje_promedio,
  (
    SELECT count(*)
    FROM equipo.historial_personal h
    WHERE h.persona_id = p.id
      AND h.tipo = ANY (ARRAY[
        'apercibimiento'::text,
        'suspension'::text,
        'llamado_atencion'::text
      ])
  ) AS incidentes,
  (
    SELECT count(*)
    FROM equipo.logros_obtenidos lo
    WHERE lo.persona_id = p.id
  ) AS logros_count,
  (
    SELECT COALESCE(sum(lc.puntos), 0::bigint)
    FROM equipo.logros_obtenidos lo
    JOIN equipo.logros_config lc ON lc.id = lo.logro_id
    WHERE lo.persona_id = p.id
  ) AS puntos_total,
  p.legajo
FROM equipo.personas p
WHERE p.activo = true;
