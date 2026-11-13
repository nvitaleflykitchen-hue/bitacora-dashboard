-- PENDIENTE DE APROBACIÓN: no aplicar sin revisión explícita del SQL de permisos.
-- Etapa 1: padrón multiempresa exclusivamente RRHH. No migra filas ni cambia vistas.
-- El único cambio en el padrón operativo es el trigger de validación de DNI cruzado.
begin;
create table equipo.rrhh_empresas (
 id text primary key check (id in ('flykitchen','drill','tempura')),
 nombre text not null check (length(trim(nombre)) between 2 and 100)
);
insert into equipo.rrhh_empresas values ('flykitchen','FlyKitchen'),('drill','Servicios Drill'),('tempura','Tempura');
create table equipo.rrhh_operadores (
 perfil_id uuid primary key references bitacora.perfiles(id) on delete cascade,
 activo boolean not null default true
);
create table equipo.rrhh_unidades (
 id uuid primary key default gen_random_uuid(),
 empresa_id text not null references equipo.rrhh_empresas(id) check (empresa_id <> 'flykitchen'),
 nombre text not null check (length(trim(nombre)) between 2 and 120),
 activa boolean not null default true,
 unique(id,empresa_id), unique(empresa_id,nombre)
);
insert into equipo.rrhh_unidades(empresa_id,nombre) values ('tempura','Cao');
create table equipo.rrhh_colaboradores (
 id uuid primary key default gen_random_uuid(),
 empresa_id text not null references equipo.rrhh_empresas(id) check (empresa_id <> 'flykitchen'),
 unidad_id uuid not null,
 nombre text not null check(length(trim(nombre)) between 1 and 100),
 apellido text not null default '' check(length(apellido)<=100),
 dni text not null check(dni ~ '^[0-9]{7,9}$'),
 legajo text not null default '' check(length(legajo)<=40),
 puesto text not null default '' check(length(puesto)<=120),
 telefono text not null default '' check(length(telefono)<=60),
 email text not null default '' check(length(email)<=254),
 fecha_ingreso date,
 activo boolean not null default true,
 motivo_cambio text not null check(length(trim(motivo_cambio)) between 5 and 500),
 creado_at timestamptz not null default now(), actualizado_at timestamptz not null default now(),
 creado_por uuid,
 foreign key(unidad_id,empresa_id) references equipo.rrhh_unidades(id,empresa_id),
 unique(dni)
);
create unique index rrhh_colaboradores_legajo_idx on equipo.rrhh_colaboradores(empresa_id,lower(trim(legajo))) where trim(legajo)<>'';
create index rrhh_colaboradores_unidad_idx on equipo.rrhh_colaboradores(unidad_id,empresa_id);
create index rrhh_colaboradores_creador_idx on equipo.rrhh_colaboradores(creado_por);
create table equipo.rrhh_auditoria (
 id bigint generated always as identity primary key,
 entidad text not null, registro_id text not null,
 accion text not null, antes jsonb, despues jsonb,
 actor_id uuid, fecha timestamptz not null default now()
);
create index rrhh_auditoria_registro_idx on equipo.rrhh_auditoria(entidad,registro_id,fecha desc);

-- Funciones invoker: no elevan privilegios ni cambian roles globales.
create function equipo.rrhh_es_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol='admin' and not coalesce(p.must_change_password,false));
$$;
create function equipo.rrhh_es_central() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and not coalesce(p.must_change_password,false)
 and (p.rol='admin' or (p.rol='editor' and exists(select 1 from equipo.rrhh_operadores o where o.perfil_id=p.id and o.activo))));
$$;
revoke all on function equipo.rrhh_es_admin(), equipo.rrhh_es_central() from public, anon;
grant execute on function equipo.rrhh_es_admin(), equipo.rrhh_es_central() to authenticated;

alter table equipo.rrhh_empresas enable row level security;
alter table equipo.rrhh_operadores enable row level security;
alter table equipo.rrhh_unidades enable row level security;
alter table equipo.rrhh_colaboradores enable row level security;
alter table equipo.rrhh_auditoria enable row level security;
revoke all on equipo.rrhh_empresas,equipo.rrhh_operadores,equipo.rrhh_unidades,equipo.rrhh_colaboradores,equipo.rrhh_auditoria from public,anon,authenticated;
grant select on equipo.rrhh_empresas,equipo.rrhh_operadores,equipo.rrhh_unidades,equipo.rrhh_colaboradores,equipo.rrhh_auditoria to authenticated;
grant update(nombre) on equipo.rrhh_empresas to authenticated;
grant insert,update on equipo.rrhh_unidades,equipo.rrhh_colaboradores,equipo.rrhh_operadores to authenticated;
create policy rrhh_operadores_read on equipo.rrhh_operadores for select to authenticated using(perfil_id=auth.uid() or equipo.rrhh_es_admin());
create policy rrhh_operadores_insert on equipo.rrhh_operadores for insert to authenticated with check(equipo.rrhh_es_admin());
create policy rrhh_operadores_update on equipo.rrhh_operadores for update to authenticated using(equipo.rrhh_es_admin()) with check(equipo.rrhh_es_admin());
create policy rrhh_empresas_read on equipo.rrhh_empresas for select to authenticated using(equipo.rrhh_es_central());
create policy rrhh_empresas_update on equipo.rrhh_empresas for update to authenticated using(equipo.rrhh_es_admin() and id<>'flykitchen') with check(equipo.rrhh_es_admin() and id<>'flykitchen');
create policy rrhh_unidades_read on equipo.rrhh_unidades for select to authenticated using(equipo.rrhh_es_central());
create policy rrhh_unidades_insert on equipo.rrhh_unidades for insert to authenticated with check(equipo.rrhh_es_central());
create policy rrhh_unidades_update on equipo.rrhh_unidades for update to authenticated using(equipo.rrhh_es_central()) with check(equipo.rrhh_es_central());
create policy rrhh_colaboradores_read on equipo.rrhh_colaboradores for select to authenticated using(equipo.rrhh_es_central());
create policy rrhh_colaboradores_insert on equipo.rrhh_colaboradores for insert to authenticated with check(equipo.rrhh_es_central());
create policy rrhh_colaboradores_update on equipo.rrhh_colaboradores for update to authenticated using(equipo.rrhh_es_central()) with check(equipo.rrhh_es_central());
create policy rrhh_auditoria_read on equipo.rrhh_auditoria for select to authenticated using(equipo.rrhh_es_central());

create function equipo.rrhh_validar_colaborador() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.nombre:=trim(new.nombre); new.apellido:=trim(new.apellido); new.dni:=trim(new.dni); new.legajo:=trim(new.legajo);
 if not exists(select 1 from equipo.rrhh_unidades u where u.id=new.unidad_id and u.empresa_id=new.empresa_id and u.activa) then
  if TG_OP='INSERT' then raise exception 'Seleccioná una unidad activa de la empresa.' using errcode='23514';
  elsif new.unidad_id<>old.unidad_id or new.empresa_id<>old.empresa_id or (new.activo and not old.activo) then
   raise exception 'Seleccioná una unidad activa de la empresa.' using errcode='23514';
  end if;
 end if;
 if TG_OP='UPDATE' then
  if new.id<>old.id then raise exception 'No se puede cambiar el identificador del legajo.'; end if;
  new.creado_at:=old.creado_at; new.creado_por:=old.creado_por;
 else new.creado_at:=now(); new.creado_por:=auth.uid(); end if;
 new.actualizado_at:=now(); return new;
end;
$$;
-- El trigger puede escribir auditoría, pero el cliente no puede insertar ni modificarla.
create function equipo.rrhh_auditar() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into equipo.rrhh_auditoria(entidad,registro_id,accion,antes,despues,actor_id)
 values(TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'perfil_id',to_jsonb(old)->>'id',to_jsonb(old)->>'perfil_id'),TG_OP,
 case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
 return new;
end;
$$;
revoke all on function equipo.rrhh_auditar(), equipo.rrhh_validar_colaborador() from public,anon,authenticated;
create trigger rrhh_colaboradores_validar before insert or update on equipo.rrhh_colaboradores for each row execute function equipo.rrhh_validar_colaborador();
create trigger rrhh_colaboradores_auditar after insert or update on equipo.rrhh_colaboradores for each row execute function equipo.rrhh_auditar();
create trigger rrhh_empresas_auditar after update on equipo.rrhh_empresas for each row execute function equipo.rrhh_auditar();
create trigger rrhh_unidades_auditar after insert or update on equipo.rrhh_unidades for each row execute function equipo.rrhh_auditar();
create trigger rrhh_operadores_auditar after insert or update or delete on equipo.rrhh_operadores for each row execute function equipo.rrhh_auditar();
-- Única integración de escritura con el padrón anterior: evita el mismo DNI en dos empresas.
-- No modifica los DNI existentes ni sus permisos; serializa altas concurrentes por DNI.
create function equipo.rrhh_validar_dni_global() returns trigger language plpgsql security definer set search_path='' as $$
declare documento text;
begin
 documento:=regexp_replace(coalesce(new.dni,''),'[^0-9]','','g');
 if documento='' then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rrhh-dni:'||documento,0));
 if TG_TABLE_NAME='personas' then
  if exists(select 1 from equipo.rrhh_colaboradores c where c.dni=documento) then
   raise exception 'El DNI ya pertenece a otra empresa. Requiere un traslado revisado.' using errcode='23505';
  end if;
 else
  if exists(select 1 from equipo.personas p where p.duplicado_de is null and regexp_replace(coalesce(p.dni,''),'[^0-9]','','g')=documento) then
   raise exception 'El DNI ya existe en FlyKitchen. Requiere un traslado revisado.' using errcode='23505';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function equipo.rrhh_validar_dni_global() from public,anon,authenticated;
create trigger rrhh_dni_global before insert or update of dni,duplicado_de on equipo.personas for each row execute function equipo.rrhh_validar_dni_global();
create trigger rrhh_dni_global before insert or update of dni on equipo.rrhh_colaboradores for each row execute function equipo.rrhh_validar_dni_global();
comment on table equipo.rrhh_colaboradores is 'Etapa 1: legajos exclusivos de RRHH de Drill y Tempura. No otorgan acceso operativo ni cuentas de usuario.';
commit;
