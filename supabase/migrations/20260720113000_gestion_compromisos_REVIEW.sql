-- APLICADA con autorización del usuario el 2026-07-20: Protocolo de Gestión de Compromisos.
-- Proyecto exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- No modifica GRANT, RLS ni políticas.

begin;

alter table bitacora.capa
  add column if not exists gestion_estado text not null default 'Sin aceptar',
  add column if not exists delegado_a_id uuid references bitacora.perfiles(id) on delete set null,
  add column if not exists fecha_compromiso date,
  add column if not exists proximo_paso text,
  add column if not exists bloqueo_motivo text,
  add column if not exists aceptado_at timestamptz,
  add column if not exists ultima_gestion_at timestamptz,
  add column if not exists gestion_historial jsonb not null default '[]'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='capa_gestion_estado_check') then
    alter table bitacora.capa add constraint capa_gestion_estado_check
      check (gestion_estado in ('Sin aceptar','Aceptada','Delegada','Bloqueada','Cumplida'));
  end if;
  if not exists (select 1 from pg_constraint where conname='capa_gestion_historial_array_check') then
    alter table bitacora.capa add constraint capa_gestion_historial_array_check
      check (jsonb_typeof(gestion_historial)='array');
  end if;
end $$;

create index if not exists capa_gestion_seguimiento_idx
  on bitacora.capa(gestion_estado,ultima_gestion_at,fecha_compromiso)
  where auditoria_codigo is not null;
create index if not exists capa_delegado_estado_idx
  on bitacora.capa(delegado_a_id,gestion_estado);

-- El plan vigente queda pendiente de aceptación expresa del responsable.
update bitacora.capa
set gestion_estado='Sin aceptar',
    fecha_compromiso=coalesce(fecha_compromiso,fecha_limite)
where upper(coalesce(auditoria_codigo,'')) like 'FK-GEST-%'
  and estado not in ('Completada','Verificada')
  and gestion_estado='Sin aceptar';

create or replace function bitacora_private.notify_gestion_commitment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.delegado_a_id is not null
     and (tg_op='INSERT' or new.delegado_a_id is distinct from old.delegado_a_id) then
    insert into bitacora.notificaciones(
      destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key
    ) values (
      new.delegado_a_id,'gestion','proyecto_accion',new.id::text,
      'Acción de proyecto delegada',
      pg_catalog.concat(new.codigo,' · ',pg_catalog.left(new.descripcion,180)),
      pg_catalog.lower(new.prioridad),'/?view=proyectosGestion',
      pg_catalog.concat('gestion:delegada:',new.id,':',new.delegado_a_id)
    ) on conflict (destinatario_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function bitacora_private.notify_gestion_commitment() from public,anon,authenticated;
drop trigger if exists notify_gestion_commitment on bitacora.capa;
create trigger notify_gestion_commitment
after insert or update of delegado_a_id on bitacora.capa
for each row execute function bitacora_private.notify_gestion_commitment();

comment on column bitacora.capa.gestion_estado is 'Aceptación y situación operativa del compromiso, separada del estado auditable.';
comment on column bitacora.capa.delegado_a_id is 'Ejecutor delegado; el responsable_id conserva la responsabilidad final.';
comment on column bitacora.capa.gestion_historial is 'Eventos de aceptación, avance, delegación, bloqueo y cumplimiento.';

commit;
