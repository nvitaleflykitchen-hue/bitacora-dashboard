-- REQUIERE APROBACION EXPLICITA antes de aplicar (AGENTS.md §0.3).
-- Proyecto exclusivo: mixyhfdlzjarvszinytk. No modifica roles ni políticas de activos/visitas.
-- Agrega almacenamiento privado y RPC acotadas a cuatro unidades existentes.
begin;

create table mantenimiento.checklists_aeropuerto (
  id uuid primary key,
  activo_id uuid not null references mantenimiento.activos(id),
  sede_id bigint not null,
  fecha date not null,
  turno text not null check (turno in ('mañana','tarde','noche')),
  km integer not null check (km>=0),
  combustible text not null check (combustible in ('completo','3/4','1/2','1/4','reserva')),
  respuestas jsonb not null,
  observaciones text not null default '',
  resultado text not null check (resultado in ('sin_novedades','con_novedades')),
  creado_por uuid not null,
  responsable text not null,
  creado_at timestamptz not null default now(),
  version integer not null default 1,
  unique(activo_id,fecha,turno)
);
alter table mantenimiento.checklists_aeropuerto enable row level security;
revoke all on mantenimiento.checklists_aeropuerto from public,anon,authenticated;
comment on table mantenimiento.checklists_aeropuerto is 'Controles inmutables: acceso exclusivo mediante RPC autenticadas y acotadas por sede. No autoriza uso ni cambia estado de mantenimiento.';

create function public.aero_checklist_acceso(p_sede bigint) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo
    and not coalesce(p.must_change_password,false)
    and (p.rol in ('admin','editor','flota','consultor')
      or (p.rol in ('operario','encargado','sede','mnt_editor') and p_sede=any(p.sede_ids))
      or (p.rol='grupo' and p.grupo_id is not null and exists(select 1 from bitacora.sedes s where s.id=p_sede and s.grupo_id=p.grupo_id))))
$$;

create function public.aero_checklist_asignado(p_activo uuid) returns boolean
language sql immutable set search_path='' as $$
 select p_activo=any(array['57bd3777-dc2e-4282-b5c7-d4dc4e5e618a','ec3d01cb-8f3f-4d22-a543-ce5308201875','71660e05-bc42-41ba-98e9-3f5275c0fb72','04f0921e-903d-407b-a0a7-7e18cc953e7b']::uuid[])
$$;

create function public.aero_checklist_vehiculos() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'nombre',a.nombre,'codigo_interno',a.codigo_interno,'sede_id',a.sede_id,'sede_nombre',a.sede_nombre,'estado',a.estado,'km_actual',a.km_actual,'puede_controlar',(select p.rol<>'consultor' from bitacora.perfiles p where p.id=auth.uid())) order by a.nombre),'[]'::jsonb)
 from mantenimiento.activos a where a.tipo='VEHICULO' and public.aero_checklist_asignado(a.id) and public.aero_checklist_acceso(a.sede_id)
$$;

create function public.aero_checklist_historial(p_activo uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from mantenimiento.activos a where a.id=p_activo and public.aero_checklist_asignado(a.id) and public.aero_checklist_acceso(a.sede_id)) then
   raise exception 'Vehículo no asignado o sin acceso a su sede';
 end if;
 return (select coalesce(jsonb_agg(to_jsonb(c) order by c.creado_at desc),'[]'::jsonb) from
   (select * from mantenimiento.checklists_aeropuerto where activo_id=p_activo and public.aero_checklist_acceso(sede_id) order by creado_at desc) c);
end $$;

create function public.aero_checklist_guardar(p_id uuid,p_activo uuid,p_turno text,p_km integer,p_combustible text,p_respuestas jsonb,p_observaciones text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 a mantenimiento.activos%rowtype;
 c mantenimiento.checklists_aeropuerto%rowtype;
 v_nombre text;
 v_fecha date := (now() at time zone 'America/Argentina/Cordoba')::date;
 v_keys text[] := array['cabina','caja_limpia','seguro','tarjeta_verde','parking','cubiertas','urea','luces','conos','calzas','matafuego','hidraulico','caja','rampa','patas','grasa'];
 v_na text[] := array['urea','hidraulico','rampa','patas','grasa'];
 k text;
 last_km integer;
begin
 select * into a from mantenimiento.activos where id=p_activo;
 if a.id is null or a.tipo<>'VEHICULO' or not public.aero_checklist_asignado(a.id) or not public.aero_checklist_acceso(a.sede_id) then raise exception 'Vehículo no asignado o sin acceso a su sede'; end if;
 if exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='consultor') then raise exception 'Acceso de solo lectura'; end if;
 -- en_reparacion NO bloquea el control. Nunca actualizar el estado del activo.
 if p_id is null then raise exception 'Falta identificador del control'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_activo::text,0));
 select * into c from mantenimiento.checklists_aeropuerto where id=p_id;
 if found then
   if c.creado_por=auth.uid() and c.activo_id=p_activo and c.turno=p_turno and c.km=p_km and c.combustible=p_combustible and c.respuestas=p_respuestas and c.observaciones=trim(coalesce(p_observaciones,'')) then return to_jsonb(c); end if;
   raise exception 'Identificador usado por otro control';
 end if;
 if p_turno is null or p_turno not in ('mañana','tarde','noche') then raise exception 'Turno inválido'; end if;
 if p_km is null or p_km<0 then raise exception 'Kilometraje inválido'; end if;
 select greatest(coalesce(a.km_actual,0),coalesce(max(km),0)) into last_km from mantenimiento.checklists_aeropuerto where activo_id=p_activo;
 if p_km<last_km then raise exception 'El kilometraje no puede ser menor a la última lectura (%)',last_km; end if;
 if p_combustible is null or p_combustible not in ('completo','3/4','1/2','1/4','reserva') then raise exception 'Combustible inválido'; end if;
 if p_respuestas is null or jsonb_typeof(p_respuestas)<>'object' then raise exception 'Respuestas inválidas'; end if;
 if (select count(*) from jsonb_object_keys(p_respuestas))<>16 then raise exception 'Completá los 16 controles'; end if;
 foreach k in array v_keys loop
   if not (p_respuestas ? k) or coalesce(p_respuestas->>k,'') not in ('ok','nc','na') or (p_respuestas->>k='na' and not k=any(v_na)) then raise exception 'Respuesta inválida: %',k; end if;
 end loop;
 if length(coalesce(p_observaciones,''))>4000 then raise exception 'Observaciones demasiado extensas'; end if;
 if exists(select 1 from jsonb_each_text(p_respuestas) r where r.value in ('nc','na')) and length(trim(coalesce(p_observaciones,'')))<5 then raise exception 'Describí novedades y justificá No aplica'; end if;
 if exists(select 1 from mantenimiento.checklists_aeropuerto where activo_id=p_activo and fecha=v_fecha and turno=p_turno) then raise exception 'Este vehículo ya tiene un control para ese turno y fecha'; end if;
 select nombre into v_nombre from bitacora.perfiles where id=auth.uid();
 insert into mantenimiento.checklists_aeropuerto(id,activo_id,sede_id,fecha,turno,km,combustible,respuestas,observaciones,resultado,creado_por,responsable)
 values(p_id,a.id,a.sede_id,v_fecha,p_turno,p_km,p_combustible,p_respuestas,trim(coalesce(p_observaciones,'')),
   case when exists(select 1 from jsonb_each_text(p_respuestas) r where r.value='nc') then 'con_novedades' else 'sin_novedades' end,auth.uid(),coalesce(v_nombre,'Usuario')) returning * into c;
 return to_jsonb(c);
end $$;

-- Fotos privadas. La regla RESTRICTIVE también limita políticas amplias preexistentes,
-- exclusivamente cuando bucket_id coincide con este nuevo bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('checklist-aeropuerto-fotos','checklist-aeropuerto-fotos',false,10485760,array['image/jpeg','image/png','image/webp']);

create function public.aero_checklist_foto_acceso(p_path text,p_escritura boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from mantenimiento.checklists_aeropuerto c join mantenimiento.activos a on a.id=c.activo_id
 where c.id::text=split_part(p_path,'/',2) and c.creado_por::text=split_part(p_path,'/',1)
 and public.aero_checklist_acceso(c.sede_id) and public.aero_checklist_acceso(a.sede_id)
 and (not p_escritura or (c.creado_por=auth.uid() and c.creado_at>now()-interval '24 hours' and exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.rol<>'consultor'))))
$$;
create policy aero_fotos_select on storage.objects for select to authenticated using(bucket_id='checklist-aeropuerto-fotos' and public.aero_checklist_foto_acceso(name,false));
create policy aero_fotos_insert on storage.objects for insert to authenticated with check(bucket_id='checklist-aeropuerto-fotos' and public.aero_checklist_foto_acceso(name,true));
create policy aero_fotos_limit_read on storage.objects as restrictive for select to public using(bucket_id<>'checklist-aeropuerto-fotos' or public.aero_checklist_foto_acceso(name,false));
create policy aero_fotos_limit_insert on storage.objects as restrictive for insert to public with check(bucket_id<>'checklist-aeropuerto-fotos' or public.aero_checklist_foto_acceso(name,true));
create policy aero_fotos_no_update on storage.objects as restrictive for update to public using(bucket_id<>'checklist-aeropuerto-fotos') with check(bucket_id<>'checklist-aeropuerto-fotos');
create policy aero_fotos_no_delete on storage.objects as restrictive for delete to public using(bucket_id<>'checklist-aeropuerto-fotos');

revoke all on function public.aero_checklist_acceso(bigint),public.aero_checklist_asignado(uuid),public.aero_checklist_vehiculos(),public.aero_checklist_historial(uuid),public.aero_checklist_guardar(uuid,uuid,text,integer,text,jsonb,text),public.aero_checklist_foto_acceso(text,boolean) from public,anon,authenticated;
grant execute on function public.aero_checklist_vehiculos(),public.aero_checklist_historial(uuid),public.aero_checklist_guardar(uuid,uuid,text,integer,text,jsonb,text) to authenticated;
-- El helper de Storage devuelve solamente un booleano y valida auth.uid(); anon obtiene false.
grant execute on function public.aero_checklist_foto_acceso(text,boolean) to authenticated,anon;
notify pgrst,'reload schema';
commit;
