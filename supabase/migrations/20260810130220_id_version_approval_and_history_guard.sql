create or replace function bitacora_private.proteger_historial_id_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    old.estado = 'Aprobada'
    or exists (select 1 from bitacora.id_pruebas p where p.version_id = old.id)
  ) and (
    new.proyecto_id is distinct from old.proyecto_id
    or new.numero is distinct from old.numero
    or new.nombre is distinct from old.nombre
    or new.descripcion is distinct from old.descripcion
    or new.formulacion is distinct from old.formulacion
    or new.proceso is distinct from old.proceso
  ) then
    raise exception 'Una versión utilizada o aprobada conserva su contenido histórico';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_historial_id_version on bitacora.id_versiones;
create trigger proteger_historial_id_version
before update on bitacora.id_versiones
for each row execute function bitacora_private.proteger_historial_id_version();

drop policy if exists id_versiones_update on bitacora.id_versiones;
create policy id_versiones_update on bitacora.id_versiones
for update to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, true))
with check (bitacora_private.id_puede_acceder(proyecto_id, true));

create or replace function bitacora.aprobar_id_version(
  p_proyecto_id uuid,
  p_version_id uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  version_number integer;
begin
  select numero into version_number
  from bitacora.id_versiones
  where id = p_version_id and proyecto_id = p_proyecto_id;

  if version_number is null then
    raise exception 'La versión no pertenece al proyecto';
  end if;

  update bitacora.id_versiones
  set estado = 'Probada'
  where proyecto_id = p_proyecto_id
    and estado = 'Aprobada'
    and id <> p_version_id;

  update bitacora.id_versiones
  set estado = 'Aprobada'
  where id = p_version_id and proyecto_id = p_proyecto_id;

  update bitacora.id_proyectos
  set version_aprobada_id = p_version_id,
      etapa = 'Aprobación',
      updated_at = now()
  where id = p_proyecto_id;

  insert into bitacora.id_eventos(proyecto_id, entidad_tipo, entidad_id, tipo, resumen, datos)
  values (
    p_proyecto_id, 'version', p_version_id::text, 'version_aprobada',
    'Versión V' || lpad(version_number::text, 2, '0') || ' aprobada',
    jsonb_build_object('version_id', p_version_id)
  );
end;
$$;

revoke all on function bitacora.aprobar_id_version(uuid, uuid) from public, anon;
grant execute on function bitacora.aprobar_id_version(uuid, uuid) to authenticated;
