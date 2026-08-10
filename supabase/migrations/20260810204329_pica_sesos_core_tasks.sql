-- Pica Sesos · etapa 1: núcleo transversal + integración con Tareas.
-- No integra todavía CAPA, Compras ni comentarios.

create table if not exists bitacora.pica_sesos_config (
  id smallint primary key default 1 check (id = 1),
  recordatorio_previo_horas integer not null default 24 check (recordatorio_previo_horas >= 0),
  segundo_seguimiento_horas integer not null default 48 check (segundo_seguimiento_horas > 0),
  escalamiento_horas integer not null default 96 check (escalamiento_horas > segundo_seguimiento_horas),
  criticidad_alta_inmediata boolean not null default true,
  activo boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into bitacora.pica_sesos_config (id) values (1) on conflict (id) do nothing;

create table if not exists bitacora.compromisos (
  id uuid primary key default gen_random_uuid(),
  origen_tipo text not null,
  origen_id text not null,
  origen_url text,
  idempotency_key text not null unique,
  solicitante_id uuid not null references auth.users(id),
  responsable_id uuid not null references auth.users(id),
  accion_requerida text not null check (length(trim(accion_requerida)) > 0),
  fecha_asignacion timestamptz not null default now(),
  fecha_objetivo timestamptz not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptado','en_curso','bloqueado','cumplido','cerrado','cancelado')),
  prioridad text not null default 'Media' check (prioridad in ('Baja','Media','Alta')),
  evidencia_esperada text,
  ultimo_avance_at timestamptz,
  ultimo_avance text,
  proximo_seguimiento_at timestamptz,
  nivel_seguimiento smallint not null default 0 check (nivel_seguimiento between 0 and 4),
  cantidad_recordatorios integer not null default 0 check (cantidad_recordatorios >= 0),
  bloqueado_at timestamptz,
  bloqueo_motivo text,
  proximo_actor_id uuid references auth.users(id),
  escalado_at timestamptz,
  cerrado_at timestamptz,
  cerrado_por uuid references auth.users(id),
  motivo_cierre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column bitacora.compromisos.idempotency_key is
  'Evita repetir la misma creación técnica. No restringe varios compromisos legítimos para un mismo origen.';

create index if not exists compromisos_origen_idx on bitacora.compromisos (origen_tipo, origen_id);
create index if not exists compromisos_responsable_estado_idx on bitacora.compromisos (responsable_id, estado, fecha_objetivo);
create index if not exists compromisos_solicitante_estado_idx on bitacora.compromisos (solicitante_id, estado, fecha_objetivo);
create index if not exists compromisos_motor_idx on bitacora.compromisos (proximo_seguimiento_at)
  where estado in ('pendiente','aceptado','en_curso');

create table if not exists bitacora.compromiso_eventos (
  id bigint generated always as identity primary key,
  compromiso_id uuid not null references bitacora.compromisos(id) on delete restrict,
  tipo text not null check (tipo in ('creacion','asignacion','aceptacion','actualizacion','respuesta','recordatorio','reclamo','cambio_fecha','evidencia','bloqueo','escalamiento','cierre','reapertura','cancelacion')),
  actor_id uuid references auth.users(id),
  detalle text,
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists compromiso_eventos_compromiso_fecha_idx
  on bitacora.compromiso_eventos (compromiso_id, created_at desc);

alter table bitacora.tareas
  add column if not exists seguimiento_activo boolean not null default true,
  add column if not exists evidencia_esperada text;

grant select on bitacora.pica_sesos_config to authenticated;
grant select on bitacora.compromisos to authenticated;
grant select on bitacora.compromiso_eventos to authenticated;
grant usage, select on sequence bitacora.compromiso_eventos_id_seq to authenticated;

alter table bitacora.pica_sesos_config enable row level security;
alter table bitacora.compromisos enable row level security;
alter table bitacora.compromiso_eventos enable row level security;

drop policy if exists pica_config_select on bitacora.pica_sesos_config;
create policy pica_config_select on bitacora.pica_sesos_config
  for select to authenticated using (true);

drop policy if exists compromisos_select_participantes on bitacora.compromisos;
create policy compromisos_select_participantes on bitacora.compromisos
  for select to authenticated
  using (
    (select auth.uid()) in (solicitante_id, responsable_id, proximo_actor_id)
    or exists (
      select 1 from bitacora.perfiles p
      where p.id = (select auth.uid()) and p.rol in ('admin','editor')
    )
  );

drop policy if exists compromiso_eventos_select_participantes on bitacora.compromiso_eventos;
create policy compromiso_eventos_select_participantes on bitacora.compromiso_eventos
  for select to authenticated
  using (
    exists (
      select 1 from bitacora.compromisos c
      where c.id = compromiso_id
    )
  );

-- La escritura se realiza por triggers y RPC controladas. Los clientes no reciben
-- UPDATE/DELETE directo para impedir cambios de responsable, solicitante o auditoría.

create or replace function bitacora_private.pica_fecha_objetivo(p_fecha date)
returns timestamptz
language sql immutable
set search_path = ''
as $$
  select ((p_fecha + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires') - interval '1 second';
$$;

create or replace function bitacora_private.pica_proximo_seguimiento(
  p_fecha_objetivo timestamptz,
  p_prioridad text,
  p_desde timestamptz default now()
)
returns timestamptz
language sql stable
set search_path = ''
as $$
  select case
    when cfg.activo is not true then null
    when p_prioridad = 'Alta' and cfg.criticidad_alta_inmediata then p_desde
    else greatest(p_desde, p_fecha_objetivo - make_interval(hours => cfg.recordatorio_previo_horas))
  end
  from bitacora.pica_sesos_config cfg where cfg.id = 1;
$$;

create or replace function bitacora_private.sync_tarea_compromiso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comp bitacora.compromisos%rowtype;
  v_due timestamptz;
  v_actor uuid := auth.uid();
  v_key text := 'tarea:' || new.id::text;
  v_material boolean := false;
begin
  if new.seguimiento_activo is not true or new.responsable_id is null or new.fecha_limite is null then
    update bitacora.compromisos
      set estado='cancelado', cerrado_at=now(), cerrado_por=coalesce(v_actor,new.creado_por),
          motivo_cierre='La tarea dejó de reunir responsable, fecha o seguimiento activo', updated_at=now(),
          proximo_seguimiento_at=null
      where idempotency_key=v_key and estado not in ('cerrado','cumplido','cancelado')
      returning * into v_comp;
    if found then
      insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle,idempotency_key)
      values(v_comp.id,'cancelacion',coalesce(v_actor,new.creado_por),v_comp.motivo_cierre,v_key||':cancel:'||extract(epoch from now())::bigint);
    end if;
    return new;
  end if;

  v_due := bitacora_private.pica_fecha_objetivo(new.fecha_limite);

  insert into bitacora.compromisos(
    origen_tipo,origen_id,origen_url,idempotency_key,solicitante_id,responsable_id,
    accion_requerida,fecha_asignacion,fecha_objetivo,estado,prioridad,evidencia_esperada,
    proximo_seguimiento_at,proximo_actor_id
  ) values (
    'tarea',new.id::text,'/?view=tareas&focus='||new.id::text,v_key,
    coalesce(new.creado_por,v_actor),new.responsable_id,
    trim(new.titulo || case when nullif(trim(coalesce(new.descripcion,'')),'') is not null then ': '||trim(new.descripcion) else '' end),
    new.created_at,v_due,
    case when new.estado='En proceso' then 'en_curso' when new.estado='Resuelto' then 'cumplido' when new.estado='Cancelado' then 'cancelado' else 'pendiente' end,
    case when new.prioridad in ('Baja','Media','Alta') then new.prioridad else 'Media' end,
    new.evidencia_esperada,
    bitacora_private.pica_proximo_seguimiento(v_due,new.prioridad,new.created_at),new.responsable_id
  )
  on conflict (idempotency_key) do update set
    responsable_id=excluded.responsable_id,
    accion_requerida=excluded.accion_requerida,
    fecha_objetivo=excluded.fecha_objetivo,
    prioridad=excluded.prioridad,
    evidencia_esperada=excluded.evidencia_esperada,
    proximo_actor_id=excluded.responsable_id,
    updated_at=now()
  returning * into v_comp;

  if tg_op='INSERT' then
    insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle,datos,idempotency_key)
    values(v_comp.id,'creacion',coalesce(v_actor,new.creado_por),'Compromiso creado desde la tarea',jsonb_build_object('origen_tipo','tarea','origen_id',new.id),v_key||':create')
    on conflict (idempotency_key) do nothing;
    insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle,datos,idempotency_key)
    values(v_comp.id,'asignacion',coalesce(v_actor,new.creado_por),'Asignado al responsable',jsonb_build_object('responsable_id',new.responsable_id,'fecha_objetivo',v_due),v_key||':assign:1')
    on conflict (idempotency_key) do nothing;
  else
    if old.responsable_id is distinct from new.responsable_id then
      insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle,datos)
      values(v_comp.id,'asignacion',v_actor,'Responsable modificado',jsonb_build_object('anterior',old.responsable_id,'nuevo',new.responsable_id));
    end if;
    if old.fecha_limite is distinct from new.fecha_limite then
      update bitacora.compromisos set nivel_seguimiento=0,cantidad_recordatorios=0,escalado_at=null,
        proximo_seguimiento_at=bitacora_private.pica_proximo_seguimiento(v_due,new.prioridad,now()),updated_at=now()
        where id=v_comp.id;
      insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle,datos)
      values(v_comp.id,'cambio_fecha',v_actor,'Fecha objetivo modificada',jsonb_build_object('anterior',old.fecha_limite,'nueva',new.fecha_limite));
    end if;

    v_material := v_actor = new.responsable_id and (
      old.descripcion is distinct from new.descripcion or old.estado is distinct from new.estado
      or old.notas_resolucion is distinct from new.notas_resolucion or old.subtareas is distinct from new.subtareas
    );
    if v_material and new.estado not in ('Resuelto','Cancelado') then
      update bitacora.compromisos set ultimo_avance_at=now(),ultimo_avance=coalesce(nullif(trim(new.notas_resolucion),''),'Actualización registrada en la tarea'),
        estado=case when estado='pendiente' then 'en_curso' else estado end,
        proximo_seguimiento_at=case when v_due > now() then bitacora_private.pica_proximo_seguimiento(v_due,new.prioridad,now()) else now()+interval '48 hours' end,
        updated_at=now() where id=v_comp.id;
      insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle)
      values(v_comp.id,'actualizacion',v_actor,coalesce(nullif(trim(new.notas_resolucion),''),'Actualización registrada en la tarea'));
    end if;
  end if;

  if new.estado in ('Resuelto','Cancelado') then
    update bitacora.compromisos set estado=case when new.estado='Resuelto' then 'cumplido' else 'cancelado' end,
      cerrado_at=coalesce(cerrado_at,now()),cerrado_por=coalesce(v_actor,new.responsable_id),
      motivo_cierre=coalesce(nullif(trim(new.notas_resolucion),''),new.estado),proximo_seguimiento_at=null,updated_at=now()
      where id=v_comp.id and estado not in ('cumplido','cerrado','cancelado');
    if found then
      insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle)
      values(v_comp.id,case when new.estado='Resuelto' then 'cierre' else 'cancelacion' end,coalesce(v_actor,new.responsable_id),coalesce(nullif(trim(new.notas_resolucion),''),new.estado));
    end if;
  elsif tg_op='UPDATE' and old.estado in ('Resuelto','Cancelado') then
    update bitacora.compromisos set estado=case when new.estado='En proceso' then 'en_curso' else 'pendiente' end,
      cerrado_at=null,cerrado_por=null,motivo_cierre=null,nivel_seguimiento=0,cantidad_recordatorios=0,escalado_at=null,
      proximo_seguimiento_at=bitacora_private.pica_proximo_seguimiento(v_due,new.prioridad,now()),updated_at=now()
      where id=v_comp.id;
    insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle)
    values(v_comp.id,'reapertura',v_actor,'La tarea fue reabierta');
  end if;
  return new;
end;
$$;

drop trigger if exists tareas_sync_compromiso on bitacora.tareas;
create trigger tareas_sync_compromiso
after insert or update of titulo,descripcion,responsable_id,fecha_limite,prioridad,estado,notas_resolucion,subtareas,seguimiento_activo,evidencia_esperada
on bitacora.tareas for each row execute function bitacora_private.sync_tarea_compromiso();

create or replace function bitacora.registrar_avance_compromiso(p_compromiso_id uuid, p_detalle text)
returns bitacora.compromisos
language plpgsql
security definer
set search_path = ''
as $$
declare v bitacora.compromisos%rowtype; v_uid uuid := auth.uid();
begin
  if v_uid is null or nullif(trim(p_detalle),'') is null then raise exception 'Datos incompletos'; end if;
  select * into v from bitacora.compromisos where id=p_compromiso_id for update;
  if not found then raise exception 'Compromiso inexistente'; end if;
  if v_uid <> v.responsable_id and not exists(select 1 from bitacora.perfiles p where p.id=v_uid and p.rol in ('admin','editor')) then
    raise exception 'Sin permiso para actualizar este compromiso';
  end if;
  update bitacora.compromisos set estado='en_curso',ultimo_avance_at=now(),ultimo_avance=trim(p_detalle),bloqueado_at=null,bloqueo_motivo=null,
    proximo_actor_id=solicitante_id,proximo_seguimiento_at=case when fecha_objetivo>now() then fecha_objetivo else now()+interval '48 hours' end,updated_at=now()
    where id=p_compromiso_id returning * into v;
  insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle) values(v.id,'respuesta',v_uid,trim(p_detalle));
  return v;
end;
$$;

create or replace function bitacora.informar_bloqueo_compromiso(p_compromiso_id uuid, p_motivo text)
returns bitacora.compromisos
language plpgsql
security definer
set search_path = ''
as $$
declare v bitacora.compromisos%rowtype; v_uid uuid := auth.uid();
begin
  if v_uid is null or nullif(trim(p_motivo),'') is null then raise exception 'El motivo es obligatorio'; end if;
  select * into v from bitacora.compromisos where id=p_compromiso_id for update;
  if not found then raise exception 'Compromiso inexistente'; end if;
  if v_uid <> v.responsable_id and not exists(select 1 from bitacora.perfiles p where p.id=v_uid and p.rol in ('admin','editor')) then
    raise exception 'Sin permiso para bloquear este compromiso';
  end if;
  update bitacora.compromisos set estado='bloqueado',bloqueado_at=now(),bloqueo_motivo=trim(p_motivo),ultimo_avance_at=now(),ultimo_avance=trim(p_motivo),
    proximo_actor_id=solicitante_id,proximo_seguimiento_at=null,updated_at=now()
    where id=p_compromiso_id returning * into v;
  insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle) values(v.id,'bloqueo',v_uid,trim(p_motivo));
  return v;
end;
$$;

create or replace function bitacora.registrar_evidencia_compromiso(p_compromiso_id uuid, p_detalle text)
returns bitacora.compromisos
language plpgsql
security definer
set search_path = ''
as $$
declare v bitacora.compromisos%rowtype; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autorizado'; end if;
  select * into v from bitacora.compromisos where id=p_compromiso_id for update;
  if not found then raise exception 'Compromiso inexistente'; end if;
  if v_uid <> v.responsable_id and v_uid <> v.solicitante_id and not exists(select 1 from bitacora.perfiles p where p.id=v_uid and p.rol in ('admin','editor')) then
    raise exception 'Sin permiso para registrar evidencia';
  end if;
  update bitacora.compromisos set ultimo_avance_at=now(),ultimo_avance=coalesce(nullif(trim(p_detalle),''),'Evidencia adjunta'),
    estado=case when estado='pendiente' then 'en_curso' else estado end,updated_at=now()
    where id=p_compromiso_id returning * into v;
  insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle)
    values(v.id,'evidencia',v_uid,coalesce(nullif(trim(p_detalle),''),'Evidencia adjunta'));
  return v;
end;
$$;

revoke all on function bitacora.registrar_avance_compromiso(uuid,text) from public,anon;
revoke all on function bitacora.informar_bloqueo_compromiso(uuid,text) from public,anon;
revoke all on function bitacora.registrar_evidencia_compromiso(uuid,text) from public,anon;
grant execute on function bitacora.registrar_avance_compromiso(uuid,text) to authenticated;
grant execute on function bitacora.informar_bloqueo_compromiso(uuid,text) to authenticated;
grant execute on function bitacora.registrar_evidencia_compromiso(uuid,text) to authenticated;

create or replace function bitacora_private.pica_sesos_run(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare r bitacora.compromisos%rowtype; cfg bitacora.pica_sesos_config%rowtype; v_level int; v_recipient uuid; v_title text; v_body text; v_type text; v_next timestamptz; v_count int:=0; v_dedupe text;
begin
  select * into cfg from bitacora.pica_sesos_config where id=1;
  if cfg.activo is not true then return 0; end if;
  for r in select * from bitacora.compromisos where estado in ('pendiente','aceptado','en_curso') and proximo_seguimiento_at<=p_now for update skip locked loop
    v_level := case
      when p_now >= r.fecha_objetivo + make_interval(hours=>cfg.escalamiento_horas) then 4
      when p_now >= r.fecha_objetivo + make_interval(hours=>cfg.segundo_seguimiento_horas) then 3
      when p_now >= r.fecha_objetivo then 2
      else 1 end;
    if v_level <= r.nivel_seguimiento then
      update bitacora.compromisos set proximo_seguimiento_at=case r.nivel_seguimiento when 1 then r.fecha_objetivo when 2 then r.fecha_objetivo+make_interval(hours=>cfg.segundo_seguimiento_horas) when 3 then r.fecha_objetivo+make_interval(hours=>cfg.escalamiento_horas) else null end where id=r.id;
      continue;
    end if;
    v_recipient := case when v_level=4 then r.solicitante_id else r.responsable_id end;
    v_type := case v_level when 1 then 'recordatorio' when 2 then 'reclamo' when 3 then 'reclamo' else 'escalamiento' end;
    v_title := case v_level when 1 then 'Compromiso próximo a vencer' when 2 then 'Actualización requerida hoy' when 3 then 'Compromiso vencido sin respuesta' else 'Compromiso delegado sin respuesta' end;
    v_body := case v_level
      when 1 then 'Tenés próximo el compromiso: '||r.accion_requerida
      when 2 then 'La fecha comprometida fue alcanzada. Actualizá estado o informá un bloqueo: '||r.accion_requerida
      when 3 then 'El compromiso continúa vencido y sin respuesta. Por favor actualizá el estado: '||r.accion_requerida
      else 'El compromiso delegado continúa vencido después de los seguimientos automáticos: '||r.accion_requerida end;
    v_dedupe := 'pica:'||r.id::text||':nivel:'||v_level||':fecha:'||extract(epoch from r.fecha_objetivo)::bigint;
    insert into bitacora.notificaciones(destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key,enviada_at)
      values(v_recipient,'pica_sesos','compromiso',r.id::text,v_title,v_body,case when v_level>=3 then 'alta' else 'media' end,r.origen_url,v_dedupe,p_now)
      on conflict (destinatario_id,dedupe_key) where dedupe_key is not null do nothing;
    insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle,datos,idempotency_key)
      values(r.id,v_type,null,v_title,jsonb_build_object('nivel',v_level,'destinatario_id',v_recipient),v_dedupe)
      on conflict (idempotency_key) do nothing;
    v_next := case v_level when 1 then r.fecha_objetivo when 2 then r.fecha_objetivo+make_interval(hours=>cfg.segundo_seguimiento_horas) when 3 then r.fecha_objetivo+make_interval(hours=>cfg.escalamiento_horas) else null end;
    update bitacora.compromisos set nivel_seguimiento=v_level,cantidad_recordatorios=cantidad_recordatorios+case when v_level<4 then 1 else 0 end,
      escalado_at=case when v_level=4 then coalesce(escalado_at,p_now) else escalado_at end,proximo_actor_id=case when v_level=4 then solicitante_id else responsable_id end,
      proximo_seguimiento_at=v_next,updated_at=p_now where id=r.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

-- Crear compromisos para tareas abiertas ya existentes que tengan responsable y fecha.
insert into bitacora.compromisos(origen_tipo,origen_id,origen_url,idempotency_key,solicitante_id,responsable_id,accion_requerida,fecha_asignacion,fecha_objetivo,estado,prioridad,evidencia_esperada,proximo_seguimiento_at,proximo_actor_id)
select 'tarea',t.id::text,'/?view=tareas&focus='||t.id::text,'tarea:'||t.id::text,t.creado_por,t.responsable_id,
  trim(t.titulo||case when nullif(trim(coalesce(t.descripcion,'')),'') is not null then ': '||trim(t.descripcion) else '' end),t.created_at,
  bitacora_private.pica_fecha_objetivo(t.fecha_limite),case when t.estado='En proceso' then 'en_curso' else 'pendiente' end,
  case when t.prioridad in ('Baja','Media','Alta') then t.prioridad else 'Media' end,t.evidencia_esperada,
  bitacora_private.pica_proximo_seguimiento(bitacora_private.pica_fecha_objetivo(t.fecha_limite),t.prioridad,now()),t.responsable_id
from bitacora.tareas t
where t.seguimiento_activo and t.responsable_id is not null and t.fecha_limite is not null and t.creado_por is not null and t.estado in ('Pendiente','En proceso')
on conflict (idempotency_key) do nothing;

insert into bitacora.compromiso_eventos(compromiso_id,tipo,actor_id,detalle,datos,idempotency_key)
select c.id,'creacion',c.solicitante_id,'Compromiso inicializado desde una tarea existente',jsonb_build_object('origen_tipo','tarea','origen_id',c.origen_id),c.idempotency_key||':create'
from bitacora.compromisos c where c.origen_tipo='tarea'
on conflict (idempotency_key) do nothing;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='pica-sesos-cada-15-minutos';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('pica-sesos-cada-15-minutos','*/15 * * * *','select bitacora_private.pica_sesos_run();');
end $$;
