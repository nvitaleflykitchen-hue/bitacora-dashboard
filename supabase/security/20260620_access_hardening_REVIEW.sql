-- REVIEW ONLY - NO EJECUTAR SIN APROBACION EXPLICITA DEL USUARIO.
-- Proyecto permitido: mixyhfdlzjarvszinytk (cerdova-db).
-- Proyecto prohibido: hmyzuuujyurvyuusvyzp.
--
-- Objetivos:
-- 1. Cerrar perfiles a anon y evitar auto-escalacion de privilegios.
-- 2. Corregir roles capitalizados en el INSERT de escalamientos.
-- 3. Retirar politicas amplias que anulan el scoping de registros.

begin;

create schema if not exists bitacora_private;
revoke all on schema bitacora_private from public, anon, authenticated;
grant usage on schema bitacora_private to authenticated;

create or replace function bitacora_private.is_bitacora_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, bitacora
as $$
  select exists (
    select 1
    from bitacora.perfiles
    where id = auth.uid()
      and rol = 'admin'
      and activo = true
  );
$$;

revoke all on function bitacora_private.is_bitacora_admin() from public, anon;
grant execute on function bitacora_private.is_bitacora_admin() to authenticated;

create or replace function bitacora_private.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, bitacora, bitacora_private
as $$
begin
  if bitacora_private.is_bitacora_admin() then
    return new;
  end if;

  if auth.uid() is null or auth.uid() <> old.id then
    raise exception 'No autorizado para modificar este perfil';
  end if;

  if new.id is distinct from old.id
     or new.rol is distinct from old.rol
     or new.sede_ids is distinct from old.sede_ids
     or new.grupo_id is distinct from old.grupo_id
     or new.activo is distinct from old.activo
     or new.email is distinct from old.email then
    raise exception 'Solo un administrador puede modificar permisos y alcance';
  end if;

  return new;
end;
$$;

revoke all on function bitacora_private.protect_profile_security_fields() from public, anon, authenticated;

drop trigger if exists protect_profile_security_fields on bitacora.perfiles;
create trigger protect_profile_security_fields
before update on bitacora.perfiles
for each row execute function bitacora_private.protect_profile_security_fields();

drop policy if exists read_perfiles on bitacora.perfiles;
drop policy if exists insert_perfiles on bitacora.perfiles;
drop policy if exists update_perfiles on bitacora.perfiles;

create policy perfiles_select_self_or_admin
on bitacora.perfiles
for select
to authenticated
using (id = auth.uid() or bitacora_private.is_bitacora_admin());

create policy perfiles_insert_self_as_consultor
on bitacora.perfiles
for insert
to authenticated
with check (
  id = auth.uid()
  and rol = 'consultor'
  and activo = true
  and grupo_id is null
  and coalesce(cardinality(sede_ids), 0) = 0
);

create policy perfiles_update_self
on bitacora.perfiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy perfiles_update_admin
on bitacora.perfiles
for update
to authenticated
using (bitacora_private.is_bitacora_admin())
with check (bitacora_private.is_bitacora_admin());

alter policy staff_insert_esc
on bitacora.escalamientos
to authenticated
with check (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and p.rol in ('admin', 'editor', 'grupo', 'encargado', 'sede')
  )
);

drop policy if exists insert_registros on bitacora.registros;
drop policy if exists read_registros on bitacora.registros;
drop policy if exists update_registros on bitacora.registros;

-- Antes de COMMIT se deben ejecutar pruebas BEGIN/ROLLBACK para los seis roles:
-- anon sin acceso; consultor solo lectura; sede/encargado/grupo limitados a su alcance;
-- editor operativo global; admin con administracion de perfiles.

commit;
