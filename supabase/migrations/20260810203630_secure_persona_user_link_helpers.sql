create or replace function bitacora.get_persona_for_user_enable(p_persona_id uuid)
returns table (
  id uuid,
  perfil_id uuid,
  nombre text,
  apellido text,
  email text,
  telefono text,
  sede_ids bigint[],
  activo boolean
)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.perfil_id, p.nombre, p.apellido, p.email, p.telefono, p.sede_ids, p.activo
  from equipo.personas p
  where p.id = p_persona_id
  limit 1;
$$;

revoke all on function bitacora.get_persona_for_user_enable(uuid) from public, anon, authenticated;
grant execute on function bitacora.get_persona_for_user_enable(uuid) to service_role;

create or replace function bitacora.link_persona_to_profile(p_persona_id uuid, p_perfil_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update equipo.personas
  set perfil_id = p_perfil_id
  where id = p_persona_id and activo = true;
  return found;
end;
$$;

revoke all on function bitacora.link_persona_to_profile(uuid, uuid) from public, anon, authenticated;
grant execute on function bitacora.link_persona_to_profile(uuid, uuid) to service_role;
