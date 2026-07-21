-- APLICADA con aprobación explícita del usuario el 2026-07-20.
-- Proyecto permitido: mixyhfdlzjarvszinytk (cerdova-db).
-- Proyecto prohibido: hmyzuuujyurvyuusvyzp (OCTOPUS COQUINARIA).
--
-- Nota: `supabase migration new` 2.109.1 falló en Windows/OneDrive con
-- LegacyMigrationNewWriteError al encontrar la carpeta migrations existente.
-- El archivo se creó manualmente conservando el formato de timestamp del repo.

begin;

alter table bitacora.capa
  add column if not exists responsable_id uuid references bitacora.perfiles(id) on delete set null,
  add column if not exists prioridad text not null default 'Media',
  add column if not exists subtareas jsonb not null default '[]'::jsonb;

alter table bitacora.capa_planes
  add column if not exists responsable_id uuid references bitacora.perfiles(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='capa_prioridad_check') then
    alter table bitacora.capa add constraint capa_prioridad_check
      check (prioridad in ('Alta','Media','Baja'));
  end if;
  if not exists (select 1 from pg_constraint where conname='capa_subtareas_array_check') then
    alter table bitacora.capa add constraint capa_subtareas_array_check
      check (jsonb_typeof(subtareas)='array');
  end if;
end $$;

create index if not exists capa_responsable_estado_idx
  on bitacora.capa(responsable_id,estado,fecha_limite);
create index if not exists capa_planes_responsable_idx
  on bitacora.capa_planes(responsable_id);

-- Vincula los responsables históricos solo cuando el nombre coincide de forma
-- exacta con un único perfil activo. No inventa asignaciones ambiguas.
update bitacora.capa c
set responsable_id=p.id
from bitacora.perfiles p
where c.responsable_id is null
  and p.activo=true
  and lower(trim(c.responsable))=lower(trim(p.nombre))
  and not exists (
    select 1 from bitacora.perfiles p2
    where p2.activo=true and p2.id<>p.id
      and lower(trim(p2.nombre))=lower(trim(p.nombre))
  );

-- Si todas las acciones vinculadas del plan tienen el mismo responsable real,
-- lo propone también como dueño general del proyecto.
update bitacora.capa_planes cp
set responsable_id=x.responsable_id, updated_at=now()
from (
  select auditoria_codigo,min(responsable_id::text)::uuid as responsable_id
  from bitacora.capa
  where auditoria_codigo is not null and responsable_id is not null
  group by auditoria_codigo
  having count(distinct responsable_id)=1
) x
where cp.auditoria_codigo=x.auditoria_codigo and cp.responsable_id is null;

create or replace function bitacora_private.notify_capa_assignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.responsable_id is not null
     and (tg_op='INSERT'
       or (tg_op='UPDATE' and new.responsable_id is distinct from old.responsable_id)) then
    insert into bitacora.notificaciones(
      destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key
    ) values (
      new.responsable_id,'capa','capa',new.id::text,
      case when upper(coalesce(new.auditoria_codigo,'')) like 'FK-GEST-%'
        then 'Nueva acción de proyecto asignada' else 'Nueva acción CAPA asignada' end,
      concat(new.codigo,' · ',left(new.descripcion,180)),
      lower(new.prioridad),
      case when upper(coalesce(new.auditoria_codigo,'')) like 'FK-GEST-%'
        then '/?view=proyectosGestion' else '/?view=capa' end,
      concat('capa:asignada:',new.id,':',new.responsable_id)
    ) on conflict (destinatario_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function bitacora_private.notify_capa_assignment() from public,anon,authenticated;
drop trigger if exists notify_capa_assignment on bitacora.capa;
create trigger notify_capa_assignment
after insert or update of responsable_id on bitacora.capa
for each row execute function bitacora_private.notify_capa_assignment();

-- Un solo aviso agrupado para cada plan histórico ya abierto. Evita generar
-- once notificaciones simultáneas para el proyecto actual de Miguel.
insert into bitacora.notificaciones(
  destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key
)
select
  c.responsable_id,'capa','capa_plan',c.auditoria_codigo,
  case when upper(c.auditoria_codigo) like 'FK-GEST-%'
    then 'Proyecto de gestión asignado' else 'Plan CAPA asignado' end,
  concat(count(*),' acciones abiertas · ',c.auditoria_codigo),
  case when bool_or(c.fecha_limite<current_date) then 'alta' else 'media' end,
  '/?view=proyectosGestion',
  concat('capa:plan:',c.auditoria_codigo,':',c.responsable_id)
from bitacora.capa c
where c.responsable_id is not null
  and c.auditoria_codigo is not null
  and c.estado not in ('Completada','Verificada')
group by c.responsable_id,c.auditoria_codigo
on conflict (destinatario_id,dedupe_key) where dedupe_key is not null do nothing;

comment on column bitacora.capa.responsable_id is 'Responsable autenticado de la acción; responsable conserva el nombre histórico/visible.';
comment on column bitacora.capa.subtareas is 'Pasos operativos de la acción CAPA; no reemplazan la acción auditable.';
comment on column bitacora.capa_planes.responsable_id is 'Dueño general del proyecto/plan CAPA.';

-- Validar en BEGIN/ROLLBACK antes del COMMIT real:
-- 1. Miguel queda vinculado a CA-2026-010..020 por UUID.
-- 2. Se genera un solo aviso agrupado para FK-GEST-ESCALAS-2026-06-19.
-- 3. Asignar una CAPA nueva genera una notificación solo para el responsable.
-- 4. Repetir la misma asignación no duplica la notificación.
commit;
