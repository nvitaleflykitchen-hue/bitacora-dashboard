-- AUTORIZADO («autorizo») y aplicado 2026-09-17. No volver a ejecutar.
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Guarda sugerencias aprendidas para personas, sedes, vehículos e I+D y expone
-- la confianza/origen del análisis. No cambia RLS, GRANT ni vínculos confirmados.
begin;

alter table bitacora.correos
  add column if not exists sugerido_persona_id uuid references equipo.personas(id),
  add column if not exists sugerido_sede_id integer references bitacora.sedes(id),
  add column if not exists sugerido_vehiculo_id uuid references mantenimiento.activos(id),
  add column if not exists sugerido_id_proyecto_id uuid references bitacora.id_proyectos(id),
  add column if not exists ai_confianza smallint,
  add column if not exists ai_fuente text;

alter table bitacora.correos
  drop constraint if exists correos_ai_confianza_check,
  add constraint correos_ai_confianza_check
    check (ai_confianza is null or ai_confianza between 0 and 100),
  drop constraint if exists correos_ai_fuente_check,
  add constraint correos_ai_fuente_check
    check (ai_fuente is null or ai_fuente in ('ollama','aprendizaje','referencia'));

comment on column bitacora.correos.ai_confianza is
  'Confianza de la sugerencia aprendida; no autoriza por sí sola un vínculo automático.';
comment on column bitacora.correos.ai_fuente is
  'Origen del análisis: ollama, aprendizaje de vínculos confirmados o referencia explícita.';

commit;
