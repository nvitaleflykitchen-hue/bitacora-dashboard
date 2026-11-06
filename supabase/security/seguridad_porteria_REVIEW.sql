-- BORRADOR PARA APROBACIÓN. No ejecutar sin autorización explícita del usuario.
begin;
alter table bitacora.perfiles drop constraint perfiles_rol_check;
alter table bitacora.perfiles add constraint perfiles_rol_check check (rol in ('admin','editor','consultor','grupo','encargado','sede','deposito','operario','flota','mnt_editor','seguridad'));

create table equipo.seguridad_documentos (
 entrega_id uuid primary key references equipo.pase_entregas(id), dni text not null check(dni ~ '^[0-9]{6,10}$'),
 recibido_at timestamptz not null default now(), recibido_por uuid not null references auth.users(id),
 devuelto_at timestamptz, devuelto_por uuid references auth.users(id), patente text,
 check((devuelto_at is null)=(devuelto_por is null))
);
create table equipo.credencial_entregas (
 credencial_id uuid primary key references equipo.credenciales_personal(id),
 entregada_at timestamptz not null default now(), entregada_por uuid not null references auth.users(id), sede_id integer not null references bitacora.sedes(id)
);
create table equipo.seguridad_escaneos (
 id uuid primary key default gen_random_uuid(), credencial_id uuid references equipo.credenciales_personal(id),
 pase_id uuid references equipo.pases_acompanados(id), sede_id integer not null references bitacora.sedes(id),
 guardia_id uuid not null references auth.users(id), fecha timestamptz not null default now(), resultado text not null
);
alter table equipo.seguridad_documentos enable row level security;
alter table equipo.credencial_entregas enable row level security;
alter table equipo.seguridad_escaneos enable row level security;
revoke all on equipo.seguridad_documentos,equipo.credencial_entregas,equipo.seguridad_escaneos from public,anon,authenticated;
grant select on equipo.credencial_entregas to authenticated;
create policy credencial_entrega_admin on equipo.credencial_entregas for select to authenticated using(exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol='admin'));

-- Corrige el id ambiguo del parámetro de salida de la función existente.
create or replace function public.acompanantes_pase(p_sector uuid) returns table(id uuid,nombre text) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from bitacora.perfiles pr where pr.id=auth.uid() and pr.activo and pr.rol='admin') then raise exception 'Sólo administradores activos pueden gestionar entregas.' using errcode='42501'; end if;
 return query select p.id,trim(concat_ws(' ',p.nombre,p.apellido)) from equipo.personas p where p.activo and equipo.pase_acceso_vigente(p.id,p_sector) order by 2;
end $$;

create function public.seguridad_operar(p_accion text,p_sede integer default null,p_datos jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare perfil bitacora.perfiles; sector equipo.credencial_sectores; tarjeta equipo.pases_acompanados; entrega equipo.pase_entregas;
 cred equipo.credenciales_personal; v jsonb; sectores jsonb; result jsonb; nuevo uuid; acompanante uuid; persona uuid; hasta timestamptz; registrada boolean;
begin
 select * into perfil from bitacora.perfiles pr where pr.id=auth.uid() and pr.activo and pr.rol in ('admin','seguridad');
 if not found then raise exception 'Acceso exclusivo de Seguridad y administradores.' using errcode='42501'; end if;
 if p_accion='clave_actualizada' then
  update bitacora.perfiles pr set must_change_password=false where pr.id=auth.uid();
  return jsonb_build_object('ok',true);
 end if;
 if coalesce(perfil.must_change_password,false) then raise exception 'Primero cambie su contraseña.' using errcode='42501'; end if;
 if p_accion='sedes' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.nombre) order by s.nombre) from bitacora.sedes s where s.activa and (perfil.rol='admin' or s.id=any(perfil.sede_ids))),'[]');
 end if;
 if p_sede is null or not exists(select 1 from bitacora.sedes s where s.id=p_sede and s.activa) or (perfil.rol<>'admin' and not coalesce(p_sede=any(perfil.sede_ids),false)) then raise exception 'Sede no autorizada.' using errcode='42501'; end if;
 if p_accion='listar' then
  return jsonb_build_object(
   'sectores',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'codigo',s.codigo,'nombre',s.nombre)) from equipo.credencial_sectores s where s.sede_id=p_sede and s.activo and s.habilitado_ingreso and s.tipo='sector'),'[]'),
   'pases',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'codigo',p.codigo,'token',p.token,'tipo',p.tipo)) from equipo.pases_acompanados p where p.activo and p.tipo='temporal' and not exists(select 1 from equipo.pase_entregas e where e.pase_id=p.id and e.devuelto_at is null)),'[]'),
   'personas',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',concat_ws(' ',p.nombre,p.apellido))) from equipo.personas p where p.activo and p_sede=any(p.sede_ids)),'[]'),
   'historial',coalesce((select jsonb_agg(h order by h.devuelto_at desc) from (select e.id,coalesce(e.visitante,concat_ws(' ',p.nombre,p.apellido)) as visitante,pa.codigo,e.desde,e.devuelto_at,e.cierre,d.devuelto_at as dni_devuelto_at from equipo.pase_entregas e join equipo.pases_acompanados pa on pa.id=e.pase_id join equipo.credencial_sectores sec on sec.id=e.sector_id left join equipo.personas p on p.id=e.persona_id left join equipo.seguridad_documentos d on d.entrega_id=e.id where sec.sede_id=p_sede and e.devuelto_at is not null order by e.devuelto_at desc limit 100) h),'[]'),
   'entregas',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'visitante',coalesce(e.visitante,concat_ws(' ',p.nombre,p.apellido)),'codigo',pa.codigo,'token',pa.token,'tipo',pa.tipo,'desde',e.desde,'hasta',e.hasta,'sector',s.nombre,'acompanante',concat_ws(' ',a.nombre,a.apellido),'dni_pendiente',d.entrega_id is not null and d.devuelto_at is null,'dni',d.dni) order by e.desde desc)
     from equipo.pase_entregas e join equipo.pases_acompanados pa on pa.id=e.pase_id join equipo.credencial_sectores s on s.id=e.sector_id left join equipo.personas p on p.id=e.persona_id join equipo.personas a on a.id=e.acompanante_id left join equipo.seguridad_documentos d on d.entrega_id=e.id where s.sede_id=p_sede and e.devuelto_at is null),'[]'));
 elsif p_accion in ('acompanantes','entregar') then
  select * into sector from equipo.credencial_sectores s where s.id=(p_datos->>'sector')::uuid and s.sede_id=p_sede and s.activo and s.habilitado_ingreso and s.tipo='sector';
  if not found then raise exception 'Seleccione un sector habilitado de la sede.'; end if;
  if p_accion='acompanantes' then
   return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',concat_ws(' ',p.nombre,p.apellido))) from equipo.personas p where p.activo and equipo.pase_acceso_vigente(p.id,sector.id)),'[]');
  end if;
  acompanante=(p_datos->>'acompanante')::uuid; persona=nullif(p_datos->>'persona','')::uuid; hasta=(p_datos->>'hasta')::timestamptz;
  if not coalesce((p_datos->>'autorizacion')::boolean,false) or not equipo.pase_acceso_vigente(acompanante,sector.id) then raise exception 'Confirme al acompañante presente con acceso vigente.'; end if;
  if hasta is null or hasta<=now() or hasta>now()+interval '24 hours' then raise exception 'Vigencia máxima: 24 horas.'; end if;
  if nullif(p_datos->>'pase','') is null then
   if coalesce(length(trim(p_datos->>'visitante')),0)<3 then raise exception 'Identifique a la visita.'; end if;
   if not coalesce((p_datos->>'dni_recibido')::boolean,false) or not coalesce((p_datos->>'dni') ~ '^[0-9]{6,10}$',false) then raise exception 'La entrega requiere recibir y registrar el DNI original.'; end if;
   if not coalesce((p_datos->>'induccion')::boolean,false) then raise exception 'Confirme la declaración e inducción de ingreso.'; end if;
   if persona is not null then raise exception 'La visita no utiliza una persona interna.'; end if;
   insert into equipo.pases_acompanados(codigo,tipo) values('VIS-'||gen_random_uuid(),'visita') returning * into tarjeta;
  else
   select * into tarjeta from equipo.pases_acompanados p where p.id=(p_datos->>'pase')::uuid and p.tipo='temporal' and p.activo for update;
   if not found then raise exception 'Pase no disponible.'; end if;
   if exists(select 1 from equipo.pase_entregas e where e.pase_id=tarjeta.id and e.devuelto_at is null) then raise exception 'El pase ya está entregado.'; end if;
   if persona is null or persona=acompanante or not exists(select 1 from equipo.personas p where p.id=persona and p.activo and p_sede=any(p.sede_ids)) then raise exception 'Seleccione un operario distinto del acompañante y de esta sede.'; end if;
  end if;
  insert into equipo.pase_entregas(pase_id,persona_id,visitante,empresa,acompanante_id,sector_id,hasta,entregado_por) values(tarjeta.id,persona,case when persona is null then trim(p_datos->>'visitante') end,nullif(trim(p_datos->>'empresa'),''),acompanante,sector.id,hasta,auth.uid()) returning id into nuevo;
  if tarjeta.tipo='visita' then insert into equipo.seguridad_documentos(entrega_id,dni,recibido_por,patente) values(nuevo,p_datos->>'dni',auth.uid(),nullif(trim(p_datos->>'patente'),'')); end if;
  return jsonb_build_object('id',nuevo,'token',tarjeta.token,'codigo',tarjeta.codigo,'tipo',tarjeta.tipo);
 elsif p_accion='devolver' then
  select e.* into entrega from equipo.pase_entregas e join equipo.credencial_sectores s on s.id=e.sector_id where e.id=(p_datos->>'entrega')::uuid and s.sede_id=p_sede for update of e;
  if not found or entrega.devuelto_at is not null then raise exception 'Entrega inexistente o cerrada.'; end if;
  if exists(select 1 from equipo.seguridad_documentos d where d.entrega_id=entrega.id and d.devuelto_at is null) and not coalesce((p_datos->>'dni_devuelto')::boolean,false) then raise exception 'Confirme la devolución del DNI.'; end if;
  if not coalesce((p_datos->>'pase_recibido')::boolean,false) and not coalesce((p_datos->>'extravio')::boolean,false) then raise exception 'Confirme la recuperación del pase y el control de egreso.'; end if;
  update equipo.seguridad_documentos d set devuelto_at=now(),devuelto_por=auth.uid() where d.entrega_id=entrega.id and d.devuelto_at is null;
  update equipo.pase_entregas e set devuelto_at=now(),devuelto_por=auth.uid(),cierre=case when coalesce((p_datos->>'extravio')::boolean,false) then 'extravio' else 'devolucion' end where e.id=entrega.id;
  update equipo.pases_acompanados p set activo=false where p.id=entrega.pase_id and (p.tipo='visita' or coalesce((p_datos->>'extravio')::boolean,false));
  return jsonb_build_object('cerrada',true);
 elsif p_accion='escanear' then
  if p_datos->>'tipo'='pase' then
   select * into tarjeta from equipo.pases_acompanados p where p.token=(p_datos->>'token')::uuid;
   if not found then raise exception 'Pase desconocido.'; end if;
   select e.* into entrega from equipo.pase_entregas e join equipo.credencial_sectores s on s.id=e.sector_id where e.pase_id=tarjeta.id and s.sede_id=p_sede and e.devuelto_at is null;
   if not found then raise exception 'El pase no tiene una entrega abierta en esta sede.'; end if;
   v=public.verificar_pase_acompanado(tarjeta.token);
   insert into equipo.seguridad_escaneos(pase_id,sede_id,guardia_id,resultado) values(tarjeta.id,p_sede,auth.uid(),v->>'estado');
   return v;
  end if;
  select * into cred from equipo.credenciales_personal c where c.token=(p_datos->>'token')::uuid for update;
  if not found then raise exception 'Credencial desconocida.'; end if;
  select to_jsonb(q) into v from public.verificar_credencial_multisede(cred.token) q;
  select coalesce(jsonb_agg(s),'[]') into sectores from jsonb_array_elements(v->'sectores_autorizados') s where (s->>'sede_id')::integer=p_sede;
  registrada=false;
  if v->>'estado'='activa' and jsonb_array_length(sectores)>0 then
   insert into equipo.credencial_entregas(credencial_id,entregada_por,sede_id) values(cred.id,auth.uid(),p_sede) on conflict(credencial_id) do nothing;
   registrada=found;
  end if;
  result=jsonb_build_object('nombre',v->>'nombre','estado',case when v->>'estado'='activa' and jsonb_array_length(sectores)=0 then 'sin acceso a esta sede' else v->>'estado' end,'sectores',sectores,'primera_entrega',registrada,'entregada_at',(select e.entregada_at from equipo.credencial_entregas e where e.credencial_id=cred.id));
  insert into equipo.seguridad_escaneos(credencial_id,sede_id,guardia_id,resultado) values(cred.id,p_sede,auth.uid(),result->>'estado');
  return result;
 end if;
 raise exception 'Operación no admitida.';
end $$;
revoke all on function public.seguridad_operar(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.seguridad_operar(text,integer,jsonb) to authenticated;
-- Los endpoints anteriores no deben permitir eludir la custodia de DNI.
revoke execute on function public.entregar_pase_acompanado(uuid,uuid,text,text,uuid,uuid,timestamptz),public.cerrar_pase_acompanado(uuid,boolean) from authenticated;
-- El rol Seguridad no hereda los accesos generales de authenticated.
create function public.obtener_perfil_sesion() returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p) from bitacora.perfiles p where p.id=auth.uid()
$$;
revoke all on function public.obtener_perfil_sesion() from public,anon,authenticated;
grant execute on function public.obtener_perfil_sesion() to authenticated;
create function equipo.es_cuenta_seguridad() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.rol='seguridad')
$$;
revoke all on function equipo.es_cuenta_seguridad() from public,anon,authenticated;
grant execute on function equipo.es_cuenta_seguridad() to authenticated;
-- Storage: sólo objects/buckets; las tablas internas de Supabase no tienen políticas permisivas.
-- Restrictiva: combina por AND con las políticas existentes, sin afectar otros roles.
do $$ declare t record; begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and c.relrowsecurity and (n.nspname in ('public','bitacora','equipo','mantenimiento') or (n.nspname='storage' and c.relname in ('objects','buckets'))) loop
  execute format('create policy seguridad_solo_rpc on %I.%I as restrictive for all to authenticated using (not (select equipo.es_cuenta_seguridad())) with check (not (select equipo.es_cuenta_seguridad()))',t.nspname,t.relname);
 end loop;
end $$;
-- Bloquea también vistas SECURITY DEFINER y RPCs ajenos al puesto por REST.
create function public.seguridad_pre_request() returns void language plpgsql security definer set search_path='' as $$
declare ruta text=ltrim(coalesce(current_setting('request.path',true),''),'/');
begin
 if equipo.es_cuenta_seguridad() and ruta not in ('rpc/seguridad_operar','rpc/obtener_perfil_sesion','rpc/registrar_acceso_app') then
  raise exception 'La cuenta de Seguridad sólo tiene acceso a Portería.' using errcode='42501';
 end if;
end $$;
revoke all on function public.seguridad_pre_request() from public,anon,authenticated;
grant execute on function public.seguridad_pre_request() to anon,authenticated;
alter role authenticator set pgrst.db_pre_request='public.seguridad_pre_request';
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
