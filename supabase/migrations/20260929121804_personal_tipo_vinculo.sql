-- Proyecto: mixyhfdlzjarvszinytk. Clasificación comercial, independiente de roles.
begin;
alter table equipo.personas add column if not exists tipo_vinculo text not null default 'staff'
  constraint personas_tipo_vinculo_check check (tipo_vinculo in ('staff', 'externo'));
comment on column equipo.personas.tipo_vinculo is 'Staff o prestador externo. Externo conserva actividad e historial, pero no integra dotación ni cronogramas.';

-- Agregar la columna al final conserva las columnas, opciones y permisos actuales
-- de la vista, incluidas las expresiones de confidencialidad de evaluaciones.
do $migration$
declare definition text;
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='v_personas' and column_name='tipo_vinculo') then
    definition := pg_get_viewdef('public.v_personas'::regclass, true);
    if position('FROM equipo.personas p' in definition) = 0 then
      raise exception 'Definición inesperada de v_personas: revisar antes de modificar';
    end if;
    definition := replace(definition, 'FROM equipo.personas p', ', p.tipo_vinculo FROM equipo.personas p');
    execute 'create or replace view public.v_personas as ' || definition;
  end if;
end
$migration$;
notify pgrst, 'reload schema';
commit;
