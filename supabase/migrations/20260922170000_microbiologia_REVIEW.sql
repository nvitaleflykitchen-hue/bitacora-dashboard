-- REVISIÓN: reemplaza el borrador anterior. No aplicar sin autorización
-- explícita tras mostrar esta versión. Proyecto: mixyhfdlzjarvszinytk.
-- La tabla ya existe y contiene 113 resultados importados: NO se borran
-- ni se reescriben. Se agregan campos de gestión y se restringe el acceso.
alter table bitacora.microbiologia_resultados
  add column if not exists criterio text,
  add column if not exists pdf_path text,
  add column if not exists pdf_nombre text,
  add column if not exists creado_por uuid references auth.users(id),
  add column if not exists anulado_en timestamptz,
  add column if not exists anulado_por uuid references auth.users(id),
  add column if not exists motivo_anulacion text;

alter table bitacora.microbiologia_resultados
  add constraint microbiologia_pdf_pair check ((pdf_path is null) = (pdf_nombre is null)),
  add constraint microbiologia_annulment_pair check ((anulado_en is null) = (anulado_por is null));

create unique index if not exists microbiologia_pdf_path_idx
  on bitacora.microbiologia_resultados(pdf_path) where pdf_path is not null;
create index if not exists microbiologia_sede_fecha_idx
  on bitacora.microbiologia_resultados(sede_id,fecha desc);

-- La sede del registro existente es bigint; sedes.id y perfiles.sede_ids
-- son integer. La comparación usa bigint sin cambiar los datos históricos.
create or replace function bitacora.microbiologia_puede_acceder(target_sede_id bigint, escritura boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from bitacora.perfiles p
    join bitacora.sedes s on s.id::bigint = target_sede_id
    where p.id = (select auth.uid()) and p.activo is true and s.activa is true
      and (p.rol = any(case when escritura
        then array['admin','editor','grupo','encargado']
        else array['admin','editor','consultor','grupo','encargado'] end)
        or lower(p.email) in ('tecnica@flykitchen.com.ar','fabifranco13@gmail.com',
                               'rrhh.higieneyseguridad.emp@gmail.com'))
      and (
        p.rol in ('admin','editor','consultor')
        or s.id = any(coalesce(p.sede_ids, '{}'::integer[]))
        or (p.rol = 'grupo' and p.grupo_id is not null and p.grupo_id = s.grupo_id)
      )
  );
$$;
revoke all on function bitacora.microbiologia_puede_acceder(bigint,boolean) from public, anon;
grant execute on function bitacora.microbiologia_puede_acceder(bigint,boolean) to authenticated;

-- Las cuatro políticas actuales usan true para cualquier autenticado.
-- Se reemplazan por alcance de sede y se deshabilita el borrado.
drop policy if exists microbiologia_resultados_select_authenticated on bitacora.microbiologia_resultados;
drop policy if exists microbiologia_resultados_insert_authenticated on bitacora.microbiologia_resultados;
drop policy if exists microbiologia_resultados_update_authenticated on bitacora.microbiologia_resultados;
drop policy if exists microbiologia_resultados_delete_authenticated on bitacora.microbiologia_resultados;
alter table bitacora.microbiologia_resultados enable row level security;
create policy micro_read on bitacora.microbiologia_resultados for select to authenticated
  using ((select bitacora.microbiologia_puede_acceder(sede_id,false)));
create policy micro_insert on bitacora.microbiologia_resultados for insert to authenticated
  with check (source_project='fly-gestion' and creado_por=(select auth.uid())
    and (select bitacora.microbiologia_puede_acceder(sede_id,true)));
create policy micro_update on bitacora.microbiologia_resultados for update to authenticated
  using ((select bitacora.microbiologia_puede_acceder(sede_id,true)))
  with check ((select bitacora.microbiologia_puede_acceder(sede_id,true)));
revoke delete on bitacora.microbiologia_resultados from authenticated;
grant select,insert,update on bitacora.microbiologia_resultados to authenticated;

-- Los resultados nuevos son inmutables salvo PDF y anulación. La
-- sincronización de importados por service_role conserva su funcionamiento.
create or replace function bitacora.microbiologia_guard_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (
    new.pdf_path is not null or new.pdf_nombre is not null or
    new.anulado_en is not null or new.anulado_por is not null or
    new.motivo_anulacion is not null) then
    raise exception 'El PDF y la anulación se registran después del alta';
  end if;
  return new;
end;
$$;
create trigger microbiologia_guard_insert before insert on bitacora.microbiologia_resultados
  for each row execute function bitacora.microbiologia_guard_insert();

create or replace function bitacora.microbiologia_guard_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.source_project <> 'fly-gestion' and current_user in ('service_role','postgres') then
    return new;
  end if;
  if (old.id,old.source_project,old.source_record_id,old.source_est_id,old.sede_id,
      old.fecha,old.protocolo,old.laboratorio,old.muestra,old.parametro,
      old.tipo_muestra,old.valor,old.unidad,old.limite,old.estado,old.notas,
      old.evidencia,old.record_data,old.created_at,old.creado_por,old.criterio)
     is distinct from
     (new.id,new.source_project,new.source_record_id,new.source_est_id,new.sede_id,
      new.fecha,new.protocolo,new.laboratorio,new.muestra,new.parametro,
      new.tipo_muestra,new.valor,new.unidad,new.limite,new.estado,new.notas,
      new.evidencia,new.record_data,new.created_at,new.creado_por,new.criterio) then
    raise exception 'El resultado es inmutable; anulá y registrá uno nuevo';
  end if;
  if old.pdf_path is not null and (new.pdf_path,new.pdf_nombre) is distinct from
     (old.pdf_path,old.pdf_nombre) then
    raise exception 'El PDF original no puede reemplazarse';
  end if;
  if new.pdf_path is not null and new.pdf_path not like new.id::text || '/%.pdf' then
    raise exception 'Ruta de PDF inválida';
  end if;
  if new.pdf_path is distinct from old.pdf_path and new.pdf_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id='microbiologia-protocolos' and o.name=new.pdf_path
  ) then
    raise exception 'El PDF debe existir en Storage antes de vincularse';
  end if;
  if old.anulado_en is not null and (new.anulado_en,new.anulado_por,new.motivo_anulacion)
     is distinct from (old.anulado_en,old.anulado_por,old.motivo_anulacion) then
    raise exception 'La anulación es definitiva';
  end if;
  if new.anulado_en is distinct from old.anulado_en and
     (new.anulado_por is distinct from auth.uid() or
      length(trim(coalesce(new.motivo_anulacion,'')))=0) then
    raise exception 'La anulación requiere autor y motivo';
  end if;
  new.updated_at=now();
  return new;
end;
$$;
create trigger microbiologia_guard_update before update on bitacora.microbiologia_resultados
  for each row execute function bitacora.microbiologia_guard_update();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('microbiologia-protocolos','microbiologia-protocolos',false,10485760,array['application/pdf'])
on conflict (id) do nothing;
create policy micro_pdf_read on storage.objects for select to authenticated
  using (bucket_id='microbiologia-protocolos' and exists (
    select 1 from bitacora.microbiologia_resultados r
    where r.id::text=split_part(name,'/',1)
      and bitacora.microbiologia_puede_acceder(r.sede_id,false)
  ));
create policy micro_pdf_insert on storage.objects for insert to authenticated
  with check (bucket_id='microbiologia-protocolos' and exists (
    select 1 from bitacora.microbiologia_resultados r
    where r.id::text=split_part(name,'/',1) and r.anulado_en is null
      and bitacora.microbiologia_puede_acceder(r.sede_id,true)
  ));
