-- REVIEW ONLY — NO EJECUTAR SIN APROBACIÓN EXPLÍCITA DEL USUARIO.
-- Proyecto autorizado: mixyhfdlzjarvszinytk (cerdova-db).
begin;

alter table bitacora.perfil_permisos
  drop constraint if exists perfil_permisos_modulo_check,
  drop constraint if exists perfil_permisos_accion_check,
  drop constraint if exists perfil_permisos_scope_check;

alter table bitacora.perfil_permisos
  add constraint perfil_permisos_modulo_check
    check (modulo = any (array['compras'::text, 'personal'::text, 'mantenimiento'::text])),
  add constraint perfil_permisos_accion_check
    check (accion = any (array['request'::text, 'manage'::text, 'supervise'::text, 'invoice'::text, 'report'::text, 'manage_all'::text])),
  add constraint perfil_permisos_scope_check
    check (
      (modulo = 'compras' and accion = any (array['request'::text, 'manage'::text, 'supervise'::text, 'invoice'::text]))
      or (modulo = 'personal' and accion = 'report')
      or (modulo = 'mantenimiento' and accion = 'manage_all')
    );

alter table mantenimiento.responsables
  add column if not exists perfil_id uuid references bitacora.perfiles(id) on delete set null;

create unique index if not exists responsables_perfil_id_unique
  on mantenimiento.responsables (perfil_id)
  where perfil_id is not null;

insert into bitacora.perfil_permisos (perfil_id, modulo, accion, activo)
select p.id, 'mantenimiento', 'manage_all', true
from bitacora.perfiles p
where p.id = '97f29d27-1d15-4a2b-aa67-e9f618fe5221'::uuid
  and p.rol = 'grupo'
on conflict (perfil_id, modulo, accion)
do update set activo = excluded.activo;

insert into mantenimiento.responsables (
  nombre, rol, area, email, disponibilidad, nivel_escalacion, categorias, activo, perfil_id
)
select
  'Pablo Fernández',
  'Coordinador de Mantenimiento',
  'Todas las sedes',
  p.email,
  'A coordinar',
  2,
  array['Edificio','Equipos grandes','Equipos medianos','Equipos chicos','Vehiculos','Cuchillas','Matafuegos','Insumos','General']::text[],
  true,
  p.id
from bitacora.perfiles p
where p.id = '97f29d27-1d15-4a2b-aa67-e9f618fe5221'::uuid
  and p.rol = 'grupo'
  and not exists (
    select 1 from mantenimiento.responsables r where r.perfil_id = p.id
  );

commit;
