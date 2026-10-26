-- Requiere aprobación explícita antes de aplicar: tablas privadas y RPCs de pases.
begin;
create table equipo.pases_acompanados (
 id uuid primary key default gen_random_uuid(), token uuid not null unique default gen_random_uuid(),
 codigo text not null unique, tipo text not null check(tipo in ('temporal','visita')),
 activo boolean not null default true, created_at timestamptz not null default now()
);
create table equipo.pase_entregas (
 id uuid primary key default gen_random_uuid(), pase_id uuid not null references equipo.pases_acompanados,
 persona_id uuid references equipo.personas, visitante text, empresa text,
 acompanante_id uuid not null references equipo.personas, sector_id uuid not null references equipo.credencial_sectores,
 desde timestamptz not null default now(), hasta timestamptz not null,
 entregado_por uuid not null references auth.users, devuelto_at timestamptz, devuelto_por uuid references auth.users,
 cierre text check(cierre in ('devolucion','extravio')),
 check(hasta>desde), check(persona_id is null or persona_id<>acompanante_id),
 check((persona_id is not null and visitante is null) or (persona_id is null and length(trim(visitante))>=3))
);
create unique index pase_una_entrega_abierta on equipo.pase_entregas(pase_id) where devuelto_at is null;
create index pase_entregas_historial on equipo.pase_entregas(pase_id,desde desc);
alter table equipo.pases_acompanados enable row level security;
alter table equipo.pase_entregas enable row level security;
revoke all on equipo.pases_acompanados,equipo.pase_entregas from public,anon,authenticated;
grant select on equipo.pases_acompanados,equipo.pase_entregas to authenticated;
create policy pases_admin_read on equipo.pases_acompanados for select to authenticated using(exists(select 1 from bitacora.perfiles where id=auth.uid() and activo and rol='admin'));
create policy entregas_admin_read on equipo.pase_entregas for select to authenticated using(exists(select 1 from bitacora.perfiles where id=auth.uid() and activo and rol='admin'));
insert into equipo.pases_acompanados(codigo,tipo) select 'ATA-'||lpad(n::text,2,'0'),'temporal' from generate_series(1,5)n;

create function equipo.pase_acceso_vigente(p_persona uuid,p_sector uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from equipo.credenciales_personal c
 cross join lateral public.verificar_credencial_multisede(c.token) v
 cross join lateral jsonb_array_elements(v.sectores_autorizados) s
 where c.persona_id=p_persona and v.estado='activa' and s->>'id'=p_sector::text)
$$;
revoke all on function equipo.pase_acceso_vigente(uuid,uuid) from public,anon,authenticated;

create function public.acompanantes_pase(p_sector uuid) returns table(id uuid,nombre text) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from bitacora.perfiles where id=auth.uid() and activo and rol='admin') then raise exception 'Sólo administradores activos pueden gestionar entregas.' using errcode='42501'; end if;
 return query select p.id,trim(concat_ws(' ',p.nombre,p.apellido)) from equipo.personas p where p.activo and equipo.pase_acceso_vigente(p.id,p_sector) order by 2;
end $$;

create function public.entregar_pase_acompanado(p_pase uuid,p_persona uuid,p_visitante text,p_empresa text,p_acompanante uuid,p_sector uuid,p_hasta timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare tarjeta equipo.pases_acompanados; entrega uuid;
begin
 if not exists(select 1 from bitacora.perfiles where id=auth.uid() and activo and rol='admin') then raise exception 'Sólo administradores activos pueden gestionar entregas.' using errcode='42501'; end if;
 if p_hasta is null or p_hasta<=now() or p_hasta>now()+interval '24 hours' then raise exception 'Seleccione un vencimiento futuro, hasta 24 horas.'; end if;
 if not equipo.pase_acceso_vigente(p_acompanante,p_sector) then raise exception 'El acompañante no tiene acceso vigente al sector.'; end if;
 if p_persona=p_acompanante then raise exception 'La persona no puede acompañarse a sí misma.'; end if;
 if p_pase is null then
  if p_persona is not null or coalesce(length(trim(p_visitante)),0)<3 then raise exception 'Identifique a la visita.'; end if;
  insert into equipo.pases_acompanados(codigo,tipo) values('VIS-'||gen_random_uuid()::text,'visita') returning * into tarjeta;
 else
  select * into tarjeta from equipo.pases_acompanados where id=p_pase for update;
  if not found or not tarjeta.activo or tarjeta.tipo<>'temporal' then raise exception 'Pase no disponible.'; end if;
  if exists(select 1 from equipo.pase_entregas where pase_id=p_pase and devuelto_at is null) then raise exception 'Registre la devolución antes de prestar este pase.'; end if;
  if not exists(select 1 from equipo.personas where id=p_persona and activo) then raise exception 'Seleccione un operario activo.'; end if;
 end if;
 insert into equipo.pase_entregas(pase_id,persona_id,visitante,empresa,acompanante_id,sector_id,hasta,entregado_por)
 values(tarjeta.id,p_persona,case when p_persona is null then trim(p_visitante) end,nullif(trim(p_empresa),''),p_acompanante,p_sector,p_hasta,auth.uid()) returning id into entrega;
 return entrega;
end $$;

create function public.cerrar_pase_acompanado(p_entrega uuid,p_extravio boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare e equipo.pase_entregas;
begin
 if not exists(select 1 from bitacora.perfiles where id=auth.uid() and activo and rol='admin') then raise exception 'Sólo administradores activos pueden cerrar entregas.' using errcode='42501'; end if;
 select * into e from equipo.pase_entregas where id=p_entrega;
 if not found then raise exception 'Entrega inexistente.'; end if;
 perform 1 from equipo.pases_acompanados where id=e.pase_id for update;
 update equipo.pase_entregas set devuelto_at=now(),devuelto_por=auth.uid(),cierre=case when p_extravio then 'extravio' else 'devolucion' end where id=p_entrega and devuelto_at is null;
 if not found then raise exception 'La entrega ya está cerrada.'; end if;
 if p_extravio or exists(select 1 from equipo.pases_acompanados where id=e.pase_id and tipo='visita') then update equipo.pases_acompanados set activo=false where id=e.pase_id; end if;
end $$;

create function public.verificar_pase_acompanado(p_token uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p equipo.pases_acompanados; e equipo.pase_entregas; vigente boolean; resultado jsonb;
begin
 select * into p from equipo.pases_acompanados where token=p_token;
 if not found then return null; end if;
 select * into e from equipo.pase_entregas where pase_id=p.id and devuelto_at is null order by desde desc limit 1;
 vigente=coalesce(p.activo and e.id is not null and now() between e.desde and e.hasta and equipo.pase_acceso_vigente(e.acompanante_id,e.sector_id)
 and (e.persona_id is null or exists(select 1 from equipo.personas where id=e.persona_id and activo)),false);
 resultado=jsonb_build_object('codigo',p.codigo,'tipo',p.tipo,'vigente',vigente,'estado',case when not p.activo then 'anulado' when e.id is null then 'sin entrega' when e.hasta<now() then 'vencido' when not vigente then 'sin autorización vigente' else 'acompañamiento obligatorio' end);
 if vigente then
 select resultado||jsonb_build_object('titular',coalesce(e.visitante,(select trim(concat_ws(' ',nombre,apellido)) from equipo.personas where id=e.persona_id)),
 'acompanante',(select trim(concat_ws(' ',nombre,apellido)) from equipo.personas where id=e.acompanante_id),
 'desde',e.desde,'hasta',e.hasta,'sector',s.nombre,'codigo_sector',s.codigo,'restringido',s.zra,'sede',d.nombre)
 into resultado from equipo.credencial_sectores s join bitacora.sedes d on d.id=s.sede_id where s.id=e.sector_id;
 end if;
 return resultado;
end $$;
revoke all on function public.acompanantes_pase(uuid),public.entregar_pase_acompanado(uuid,uuid,text,text,uuid,uuid,timestamptz),public.cerrar_pase_acompanado(uuid,boolean),public.verificar_pase_acompanado(uuid) from public,anon,authenticated;
grant execute on function public.acompanantes_pase(uuid),public.entregar_pase_acompanado(uuid,uuid,text,text,uuid,uuid,timestamptz),public.cerrar_pase_acompanado(uuid,boolean) to authenticated;
grant execute on function public.verificar_pase_acompanado(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
