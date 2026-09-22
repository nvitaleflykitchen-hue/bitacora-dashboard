-- REVISIÓN OBLIGATORIA: mostrar este SQL completo y obtener autorización
-- antes de ejecutarlo en mixyhfdlzjarvszinytk. No se aplica con el PR.
create table if not exists bitacora.microbiologia_resultados (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id),
  fecha date not null,
  protocolo text not null check (length(trim(protocolo)) > 0),
  laboratorio text,
  muestra text not null check (length(trim(muestra)) > 0),
  parametro text not null check (length(trim(parametro)) > 0),
  resultado text not null check (length(trim(resultado)) > 0),
  unidad text,
  conclusion text not null check (conclusion in ('cumple','observado','no_cumple')),
  criterio text,
  observaciones text,
  pdf_path text unique,
  pdf_nombre text,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  anulado_en timestamptz,
  anulado_por uuid references auth.users(id),
  motivo_anulacion text,
  constraint micro_pdf_pair check ((pdf_path is null) = (pdf_nombre is null)),
  constraint micro_annulment_pair check ((anulado_en is null) = (anulado_por is null))
);

create index if not exists micro_sede_fecha_idx on bitacora.microbiologia_resultados(sede_id, fecha desc);
create index if not exists micro_protocolo_idx on bitacora.microbiologia_resultados(protocolo);

-- Misma regla territorial en tabla y archivo. Los roles de Calidad leen
-- solo sedes asignadas; admin/editor/consultor conservan su alcance general.
create or replace function bitacora.microbiologia_puede_acceder(target_sede_id integer, escritura boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from bitacora.perfiles p
    join bitacora.sedes s on s.id = target_sede_id
    where p.id = (select auth.uid()) and p.activo is true and s.activa is true
      and (p.rol = any(case when escritura
        then array['admin','editor','grupo','encargado']
        else array['admin','editor','consultor','grupo','encargado'] end)
        or lower(p.email) in ('tecnica@flykitchen.com.ar','fabifranco13@gmail.com',
                               'rrhh.higieneyseguridad.emp@gmail.com'))
      and (
        p.rol in ('admin','editor','consultor')
        or target_sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
        or (p.rol = 'grupo' and p.grupo_id is not null and p.grupo_id = s.grupo_id)
      )
  );
$$;
revoke all on function bitacora.microbiologia_puede_acceder(integer,boolean) from public, anon;
grant execute on function bitacora.microbiologia_puede_acceder(integer,boolean) to authenticated;

alter table bitacora.microbiologia_resultados enable row level security;
create policy micro_read on bitacora.microbiologia_resultados for select to authenticated
  using ((select bitacora.microbiologia_puede_acceder(sede_id, false)));
create policy micro_insert on bitacora.microbiologia_resultados for insert to authenticated
  with check (creado_por = (select auth.uid()) and (select bitacora.microbiologia_puede_acceder(sede_id, true)));
create policy micro_update on bitacora.microbiologia_resultados for update to authenticated
  using ((select bitacora.microbiologia_puede_acceder(sede_id, true)))
  with check ((select bitacora.microbiologia_puede_acceder(sede_id, true)));

-- Permite únicamente agregar el PDF o anular; no reescribir el resultado.
create or replace function bitacora.microbiologia_guard_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pdf_path is not null or new.pdf_nombre is not null or new.anulado_en is not null
     or new.anulado_por is not null or new.motivo_anulacion is not null then
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
  if (old.id,old.sede_id,old.fecha,old.protocolo,old.laboratorio,old.muestra,
      old.parametro,old.resultado,old.unidad,old.conclusion,old.criterio,
      old.observaciones,old.creado_por,old.creado_en)
     is distinct from
     (new.id,new.sede_id,new.fecha,new.protocolo,new.laboratorio,new.muestra,
      new.parametro,new.resultado,new.unidad,new.conclusion,new.criterio,
      new.observaciones,new.creado_por,new.creado_en) then
    raise exception 'El resultado microbiológico es inmutable; anulá y registrá uno nuevo';
  end if;
  if old.pdf_path is not null and (new.pdf_path,new.pdf_nombre) is distinct from (old.pdf_path,old.pdf_nombre) then
    raise exception 'El PDF original no puede reemplazarse';
  end if;
  if new.pdf_path is not null and new.pdf_path not like new.id::text || '/%.pdf' then
    raise exception 'Ruta de PDF inválida';
  end if;
  if new.pdf_path is distinct from old.pdf_path and new.pdf_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'microbiologia-protocolos' and o.name = new.pdf_path
  ) then
    raise exception 'El PDF debe existir en Storage antes de vincularse';
  end if;
  if old.anulado_en is not null and (new.anulado_en,new.anulado_por,new.motivo_anulacion) is distinct from
    (old.anulado_en,old.anulado_por,old.motivo_anulacion) then
    raise exception 'La anulación es definitiva';
  end if;
  if new.anulado_en is distinct from old.anulado_en and
     (new.anulado_por is distinct from auth.uid() or length(trim(coalesce(new.motivo_anulacion,''))) = 0) then
    raise exception 'La anulación requiere autor y motivo';
  end if;
  return new;
end;
$$;
create trigger microbiologia_guard_update before update on bitacora.microbiologia_resultados
  for each row execute function bitacora.microbiologia_guard_update();

revoke all on bitacora.microbiologia_resultados from anon;
grant select, insert, update on bitacora.microbiologia_resultados to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('microbiologia-protocolos','microbiologia-protocolos',false,10485760,array['application/pdf'])
on conflict (id) do nothing;

-- Ruta: <id del resultado>/<nombre uuid>.pdf. El insert se autoriza solo
-- cuando el resultado ya existe y pertenece a una sede editable.
create policy micro_pdf_read on storage.objects for select to authenticated
  using (bucket_id = 'microbiologia-protocolos' and exists (
    select 1 from bitacora.microbiologia_resultados r
    where r.id::text = split_part(name,'/',1)
      and bitacora.microbiologia_puede_acceder(r.sede_id,false)
  ));
create policy micro_pdf_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'microbiologia-protocolos' and exists (
    select 1 from bitacora.microbiologia_resultados r
    where r.id::text = split_part(name,'/',1)
      and r.anulado_en is null
      and bitacora.microbiologia_puede_acceder(r.sede_id,true)
  ));
