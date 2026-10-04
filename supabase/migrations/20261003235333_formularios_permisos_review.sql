-- REVIEW ONLY. No aplicar sin aprobación explícita: incluye GRANT, RLS y Storage.
-- Proyecto autorizado: mixyhfdlzjarvszinytk. No modifica las políticas existentes.
begin;
create table bitacora.fp_supervisores (
 usuario_id uuid primary key references auth.users(id), created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table bitacora.fp_roles (
 rol text primary key check (rol in ('admin','encargado','supervisor')),
 acciones text[] not null default '{}',
 check (acciones <@ array['ver','crear','editar','generar','firmar','presentar','anular','plantillas']::text[])
);
insert into bitacora.fp_roles values
('admin',array['ver','crear','editar','generar','firmar','presentar','anular','plantillas']),
('supervisor',array['ver','crear','editar','generar','firmar','presentar','anular']),
('encargado',array['ver','crear','editar','generar','firmar','presentar']);
create function bitacora.fp_access(p_sede integer, p_accion text) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
 select exists(select 1 from bitacora.perfiles p join bitacora.fp_roles r on r.rol=case
 when p.rol='admin' then 'admin'
 when exists(select 1 from bitacora.fp_supervisores x where x.usuario_id=p.id) then 'supervisor'
 else p.rol end
 where p.id=auth.uid() and p.activo=true and (p.rol='admin' or p_accion=any(r.acciones))
 and exists(select 1 from bitacora.sedes s where s.id=p_sede and lower(trim(s.tipo))='aeropuerto')
 and (p.rol='admin' or p_sede=any(coalesce(p.sede_ids,'{}'::integer[]))
 or (p.rol='grupo' and p.grupo_id is not null and exists(select 1 from bitacora.sedes s where s.id=p_sede and s.grupo_id=p.grupo_id))))
$$;
create function bitacora.fp_person_access(p_id uuid,p_accion text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from equipo.personas p where p.id=p_id and (
 exists(select 1 from unnest(coalesce(p.sede_ids,'{}'::integer[])) s where bitacora.fp_access(s,p_accion))))
$$;
create table bitacora.fp_aeroportuarios (
 persona_id uuid primary key references equipo.personas(id), datos jsonb not null default '{}',
 updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id)
);
create table bitacora.fp_plantillas (
 id uuid primary key default gen_random_uuid(), tipo text not null check(tipo in ('ppa_auto','anexo_e')),
 version integer not null check(version>0), nombre text not null, instrucciones text not null default '', layout integer not null default 1 check(layout=1),
 activa boolean not null default true, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
 unique(tipo,version)
);
insert into bitacora.fp_plantillas(tipo,version,nombre) values
('ppa_auto',1,'Permiso aeroportuario - Auto-acompañamiento'),('anexo_e',1,'Anexo E - Seguridad con acompañamiento');
create table bitacora.fp_formularios (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references bitacora.fp_plantillas(id),
 sede_id integer not null references bitacora.sedes(id), persona_ids uuid[] not null check(cardinality(persona_ids)>0), acompanante_id uuid references equipo.personas(id),
 plantilla jsonb not null, datos jsonb not null, estado text not null default 'borrador' check(estado in ('borrador','generado','pendiente_firma','firmado','presentado','vencido','anulado')),
 archivo text, advertencias jsonb not null default '[]', version integer not null default 1,
 created_by uuid not null references auth.users(id), created_name text not null, created_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now(),
 generado_at timestamptz, firmado_at timestamptz, presentado_at timestamptz
);
create index fp_form_sede_fecha on bitacora.fp_formularios(sede_id,created_at desc);
create index fp_form_personas on bitacora.fp_formularios using gin(persona_ids);
create table bitacora.fp_auditoria (
 id bigint generated always as identity primary key, formulario_id uuid references bitacora.fp_formularios(id),
 entidad text not null, entidad_id text not null, actor_id uuid not null references auth.users(id), actor_nombre text not null,
 created_at timestamptz not null default now(), antes jsonb, despues jsonb
);
create function bitacora.fp_audit() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_old jsonb; v_new jsonb; v_id text;
begin
 if tg_op='DELETE' then raise exception 'No se permite eliminar formularios ni su trazabilidad'; end if;
 v_new=to_jsonb(new); if tg_op='UPDATE' then v_old=to_jsonb(old); end if;
 v_id=coalesce(v_new->>'id',v_new->>'persona_id',v_new->>'rol');
 insert into bitacora.fp_auditoria(formulario_id,entidad,entidad_id,actor_id,actor_nombre,antes,despues)
 values(case when tg_table_name='fp_formularios' then v_id::uuid else null end,tg_table_name,v_id,auth.uid(),
 coalesce((select nombre from bitacora.perfiles where id=auth.uid()),'Usuario'),v_old,v_new);
 return new;
end $$;
create trigger fp_form_audit after insert or update or delete on bitacora.fp_formularios for each row execute function bitacora.fp_audit();
create trigger fp_air_audit after insert or update or delete on bitacora.fp_aeroportuarios for each row execute function bitacora.fp_audit();
create trigger fp_template_audit after insert or update or delete on bitacora.fp_plantillas for each row execute function bitacora.fp_audit();
create trigger fp_role_audit after insert or update or delete on bitacora.fp_roles for each row execute function bitacora.fp_audit();

create function bitacora.fp_person_snapshot(p_id uuid) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('id',p.id,'nombre',p.nombre,'apellido',p.apellido,'dni',p.dni,'legajo',p.legajo,'puesto',p.puesto,'sede_ids',p.sede_ids,
 'categoria',coalesce((select c.nombre from equipo.persona_encuadres e left join equipo.puestos_cct c on c.id=e.puesto_cct_id where e.persona_id=p.id and e.fecha_desde<=current_date and (e.fecha_hasta is null or e.fecha_hasta>=current_date) order by e.es_principal desc,e.fecha_desde desc limit 1),''),
 'aeroportuario',jsonb_build_object('ppa',p.credencial_aeroportuaria_numero,'vencimiento',p.credencial_aeroportuaria_vencimiento)||coalesce(a.datos,'{}'::jsonb))
 from equipo.personas p left join bitacora.fp_aeroportuarios a on a.persona_id=p.id where p.id=p_id
$$;
create function bitacora.fp_context() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Se requiere iniciar sesión'; end if;
 select jsonb_build_object(
 'personas',coalesce((select jsonb_agg(bitacora.fp_person_snapshot(p.id) order by p.apellido,p.nombre) from equipo.personas p where p.activo and bitacora.fp_person_access(p.id,'ver')),'[]'::jsonb),
 'sedes',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.nombre,'acciones',(select jsonb_agg(a) from unnest(array['ver','crear','editar','generar','firmar','presentar','anular','plantillas']) a where bitacora.fp_access(s.id,a)))) from bitacora.sedes s where bitacora.fp_access(s.id,'ver')),'[]'::jsonb),
 'plantillas',coalesce((select jsonb_agg(to_jsonb(t) order by t.tipo,t.version desc) from bitacora.fp_plantillas t),'[]'::jsonb),
 'admin',exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo),
 'supervisores',case when exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo) then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'habilitado',exists(select 1 from bitacora.fp_supervisores x where x.usuario_id=p.id))) from bitacora.perfiles p where p.activo and p.rol<>'admin'),'[]'::jsonb) else '[]'::jsonb end,
 'roles',case when exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo) then (select jsonb_agg(to_jsonb(r)) from bitacora.fp_roles r) else '[]'::jsonb end
 ) into result;
 return result;
end $$;
create function bitacora.fp_list(p_persona uuid default null) returns setof bitacora.fp_formularios
language sql stable security definer set search_path=pg_catalog as $$
 select f.* from bitacora.fp_formularios f where bitacora.fp_access(f.sede_id,'ver') and (p_persona is null or p_persona=any(f.persona_ids) or f.acompanante_id=p_persona) order by f.created_at desc
$$;
create function bitacora.fp_history(p_id uuid) returns setof bitacora.fp_auditoria language sql stable security definer set search_path=pg_catalog as $$
 select a.* from bitacora.fp_auditoria a join bitacora.fp_formularios f on f.id=a.formulario_id where f.id=p_id and bitacora.fp_access(f.sede_id,'ver') order by a.created_at desc
$$;
create function bitacora.fp_save(p_id uuid,p_version integer,p_template uuid,p_sede integer,p_personas uuid[],p_acompanante uuid,p_variables jsonb)
returns bitacora.fp_formularios language plpgsql security definer set search_path=pg_catalog as $$
declare f bitacora.fp_formularios; t bitacora.fp_plantillas; d jsonb; p uuid;
begin
 if not bitacora.fp_access(p_sede,case when p_id is null then 'crear' else 'editar' end) then raise exception 'Sin permiso para esta sede'; end if;
 if p_id is not null then
  select * into f from bitacora.fp_formularios where id=p_id for update;
  if not found or not bitacora.fp_access(f.sede_id,'editar') or f.estado<>'borrador' or p_version is null or f.version<>p_version then raise exception 'El borrador cambió, ya fue generado o no está autorizado. Actualizá.'; end if;
 end if;
 select * into t from bitacora.fp_plantillas where id=p_template and activa;
 if not found then raise exception 'Plantilla no disponible'; end if;
 if coalesce(cardinality(p_personas),0)=0 or cardinality(p_personas)>100 or (t.tipo='ppa_auto' and cardinality(p_personas)<>1) then raise exception 'Cantidad de personas inválida'; end if;
 if (select count(distinct x) from unnest(p_personas) x)<>cardinality(p_personas) then raise exception 'Personas duplicadas'; end if;
 foreach p in array p_personas loop
  if not exists(select 1 from equipo.personas where id=p and activo and p_sede=any(sede_ids)) or not bitacora.fp_person_access(p,'ver') then raise exception 'La persona debe estar activa y asignada a la sede'; end if;
 end loop;
 if p_acompanante is not null and (not bitacora.fp_person_access(p_acompanante,'ver') or not exists(select 1 from equipo.personas where id=p_acompanante and activo)) then raise exception 'Acompañante fuera del alcance o inactivo'; end if;
 if p_variables is null or jsonb_typeof(p_variables)<>'object' or octet_length(p_variables::text)>25000 then raise exception 'Datos del formulario inválidos'; end if;
 d=jsonb_build_object('personas',(select jsonb_agg(bitacora.fp_person_snapshot(x) order by n) from unnest(p_personas) with ordinality a(x,n)),
 'acompanante',bitacora.fp_person_snapshot(p_acompanante),'variables',p_variables,'sede',(select nombre from bitacora.sedes where id=p_sede));
 if p_id is null then
  insert into bitacora.fp_formularios(template_id,sede_id,persona_ids,acompanante_id,plantilla,datos,created_by,created_name,updated_by)
  values(t.id,p_sede,p_personas,p_acompanante,to_jsonb(t),d,auth.uid(),coalesce((select nombre from bitacora.perfiles where id=auth.uid()),'Usuario'),auth.uid()) returning * into f;
 else
  update bitacora.fp_formularios set template_id=t.id,sede_id=p_sede,persona_ids=p_personas,acompanante_id=p_acompanante,plantilla=to_jsonb(t),datos=d,version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_id returning * into f;
 end if;
 return f;
end $$;
create function bitacora.fp_transition(p_id uuid,p_version integer,p_estado text,p_archivo text default null,p_advertencias jsonb default '[]')
returns bitacora.fp_formularios language plpgsql security definer set search_path=pg_catalog as $$
declare f bitacora.fp_formularios; action text; v jsonb;
begin
 select * into f from bitacora.fp_formularios where id=p_id for update;
 action=case p_estado when 'generado' then 'generar' when 'pendiente_firma' then 'generar' when 'firmado' then 'firmar' when 'presentado' then 'presentar' when 'anulado' then 'anular' when 'vencido' then 'editar' end;
 if not found or action is null or not bitacora.fp_access(f.sede_id,action) then raise exception 'Sin permiso para cambiar este estado'; end if;
 if p_version is null or p_version is null or f.version<>p_version then raise exception 'El formulario cambió. Actualizá antes de continuar'; end if;
 if f.estado='anulado' or not (
 (p_estado='generado' and f.estado='borrador') or (p_estado='pendiente_firma' and f.estado='generado') or
 (p_estado='firmado' and f.estado in ('generado','pendiente_firma')) or (p_estado='presentado' and f.estado='firmado') or
 (p_estado='vencido' and f.estado in ('generado','pendiente_firma','firmado','presentado')) or p_estado='anulado') then raise exception 'Transición de estado no permitida'; end if;
 if p_estado='generado' then
  v=f.datos->'variables';
  if coalesce(v->>'fecha','')='' or coalesce(v->>'desde','')='' or coalesce(v->>'hasta','')='' or coalesce(trim(v->>'tareas'),'')='' or coalesce(v->>'sectores','')='' then raise exception 'Faltan fecha, horarios, tareas o sectores'; end if;
  perform (v->>'fecha')::date;
  if coalesce(v->>'sectores','') !~ '^[1-7]([ ,;/]+[1-7])*$' then raise exception 'Sectores inv�lidos: usar 1 a 7'; end if;
  if (v->>'hasta')::time <= (v->>'desde')::time then raise exception 'Horario hasta inválido'; end if;
  if p_archivo is null or split_part(p_archivo,'/',1)<>f.id::text or not exists(select 1 from storage.objects where bucket_id='formularios-permisos' and name=p_archivo and owner_id=auth.uid()::text) then raise exception 'Primero debe guardarse el PDF en el almacenamiento privado'; end if;
  if jsonb_typeof(p_advertencias)<>'array' then raise exception 'Advertencias inválidas'; end if;
 end if;
 update bitacora.fp_formularios set estado=p_estado,archivo=case when p_estado='generado' then p_archivo else archivo end,
 advertencias=case when p_estado='generado' then p_advertencias else advertencias end,
 generado_at=case when p_estado='generado' then now() else generado_at end,
 firmado_at=case when p_estado='firmado' then now() else firmado_at end,
 presentado_at=case when p_estado='presentado' then now() else presentado_at end,
 version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into f;
 return f;
end $$;
create function bitacora.fp_airport_save(p_persona uuid,p_data jsonb) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not bitacora.fp_person_access(p_persona,'editar') then raise exception 'Sin permiso para editar esta persona'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>5000 then raise exception 'Datos inválidos'; end if;
 if nullif(p_data->>'emision','') is not null then perform (p_data->>'emision')::date; end if;
 if nullif(p_data->>'vencimiento','') is not null then perform (p_data->>'vencimiento')::date; end if;
 insert into bitacora.fp_aeroportuarios(persona_id,datos,updated_by) values(p_persona,p_data,auth.uid())
 on conflict(persona_id) do update set datos=excluded.datos,updated_by=auth.uid(),updated_at=now();
end $$;
create function bitacora.fp_template_version(p_tipo text,p_nombre text,p_instrucciones text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from bitacora.sedes s where bitacora.fp_access(s.id,'plantillas')) then raise exception 'Sin permiso para administrar plantillas'; end if;
 perform pg_advisory_xact_lock(814536);
 if length(trim(p_nombre))<3 or length(p_nombre)>200 or length(p_instrucciones)>2000 then raise exception 'Nombre o instrucciones inválidos'; end if;
 insert into bitacora.fp_plantillas(tipo,version,nombre,instrucciones,created_by) select p_tipo,coalesce(max(version),0)+1,p_nombre,p_instrucciones,auth.uid() from bitacora.fp_plantillas where tipo=p_tipo;
end $$;
create function bitacora.fp_template_active(p_id uuid,p_activa boolean) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from bitacora.sedes s where bitacora.fp_access(s.id,'plantillas')) then raise exception 'Sin permiso para administrar plantillas'; end if;
 update bitacora.fp_plantillas set activa=p_activa where id=p_id;
end $$;
create function bitacora.fp_role_save(p_rol text,p_acciones text[]) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo) then raise exception 'Solo un administrador puede configurar permisos'; end if;
 if p_rol='admin' then raise exception 'No se pueden quitar permisos al administrador'; end if;
 update bitacora.fp_roles set acciones=p_acciones where rol=p_rol;
end $$;

create function bitacora.fp_available(p_persona uuid default null) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select case when p_persona is null then exists(select 1 from bitacora.sedes s where bitacora.fp_access(s.id,'ver')) else bitacora.fp_person_access(p_persona,'ver') end
$$;
create function bitacora.fp_supervisor_save(p_usuario uuid,p_habilitado boolean) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo) then raise exception 'Solo administrador'; end if;
 if not exists(select 1 from bitacora.perfiles where id=p_usuario and activo and rol<>'admin') then raise exception 'Usuario no disponible'; end if;
 if p_habilitado then insert into bitacora.fp_supervisores(usuario_id,created_by) values(p_usuario,auth.uid()) on conflict do nothing;
 else delete from bitacora.fp_supervisores where usuario_id=p_usuario; end if;
 insert into bitacora.fp_auditoria(entidad,entidad_id,actor_id,actor_nombre,despues) values('fp_supervisores',p_usuario::text,auth.uid(),coalesce((select nombre from bitacora.perfiles where id=auth.uid()),'Admin'),jsonb_build_object('habilitado',p_habilitado));
end $$;
alter table bitacora.fp_supervisores enable row level security;
revoke all on bitacora.fp_supervisores from public,anon,authenticated;
revoke all on function bitacora.fp_available(uuid),bitacora.fp_supervisor_save(uuid,boolean) from public,anon,authenticated;
grant execute on function bitacora.fp_available(uuid),bitacora.fp_supervisor_save(uuid,boolean) to authenticated;

-- API tables remain inaccessible directly. All mutations pass through validated RPCs.
alter table bitacora.fp_roles enable row level security;
alter table bitacora.fp_aeroportuarios enable row level security;
alter table bitacora.fp_plantillas enable row level security;
alter table bitacora.fp_formularios enable row level security;
alter table bitacora.fp_auditoria enable row level security;
revoke all on bitacora.fp_roles,bitacora.fp_aeroportuarios,bitacora.fp_plantillas,bitacora.fp_formularios,bitacora.fp_auditoria from public,anon,authenticated;
revoke all on function bitacora.fp_access(integer,text),bitacora.fp_person_access(uuid,text),bitacora.fp_audit(),bitacora.fp_person_snapshot(uuid),bitacora.fp_context(),bitacora.fp_list(uuid),bitacora.fp_history(uuid),bitacora.fp_save(uuid,integer,uuid,integer,uuid[],uuid,jsonb),bitacora.fp_transition(uuid,integer,text,text,jsonb),bitacora.fp_airport_save(uuid,jsonb),bitacora.fp_template_version(text,text,text),bitacora.fp_template_active(uuid,boolean),bitacora.fp_role_save(text,text[]) from public,anon,authenticated;
grant execute on function bitacora.fp_context(),bitacora.fp_list(uuid),bitacora.fp_history(uuid),bitacora.fp_save(uuid,integer,uuid,integer,uuid[],uuid,jsonb),bitacora.fp_transition(uuid,integer,text,text,jsonb),bitacora.fp_airport_save(uuid,jsonb),bitacora.fp_template_version(text,text,text),bitacora.fp_template_active(uuid,boolean),bitacora.fp_role_save(text,text[]) to authenticated;

create function bitacora.fp_file_access(p_name text,p_write boolean) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from bitacora.fp_formularios f where f.id::text=split_part(p_name,'/',1) and
 bitacora.fp_access(f.sede_id,case when p_write then 'generar' else 'ver' end) and
 (case when p_write then f.estado='borrador' else f.archivo=p_name end))
$$;
revoke all on function bitacora.fp_file_access(text,boolean) from public,anon;
grant execute on function bitacora.fp_file_access(text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('formularios-permisos','formularios-permisos',false,3145728,array['application/pdf']);
create policy fp_pdf_read on storage.objects for select to authenticated using(bucket_id='formularios-permisos' and bitacora.fp_file_access(name,false));
create policy fp_pdf_insert on storage.objects for insert to authenticated with check(bucket_id='formularios-permisos' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and bitacora.fp_file_access(name,true));
-- No UPDATE or DELETE grant/policy for PDFs. The finalized file is immutable.
notify pgrst,'reload schema';
commit;
