-- Reviewed and authorized by the project owner; applied on 2026-09-25.
-- Target project: mixyhfdlzjarvszinytk (cerdova-db).
-- One row per PDF version; one row per month with a published TOTAL.

begin;

create table if not exists bitacora.airline_performance_reports (
  id uuid primary key default gen_random_uuid(),
  site_id integer not null references bitacora.sedes(id),
  airline text not null check (length(trim(airline)) between 2 and 120),
  report_year integer not null check (report_year between 2020 and 2100),
  cumulative_score numeric(5,2) check (cumulative_score between 0 and 100),
  source_name text,
  storage_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint airline_report_publication_check check (status = 'draft' or (published_at is not null and storage_path is not null))
);

create index if not exists airline_reports_site_period_idx
  on bitacora.airline_performance_reports(site_id, airline, report_year, published_at desc);

create table if not exists bitacora.airline_performance_months (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references bitacora.airline_performance_reports(id),
  month integer not null check (month between 1 and 12),
  total_score numeric(5,2) not null check (total_score between 0 and 100),
  level text,
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  unique(report_id, month)
);

create index if not exists airline_months_report_idx
  on bitacora.airline_performance_months(report_id, month);

alter table bitacora.airline_performance_reports enable row level security;
alter table bitacora.airline_performance_months enable row level security;

revoke all on bitacora.airline_performance_reports from anon, public;
revoke all on bitacora.airline_performance_months from anon, public;
grant select, insert, update on bitacora.airline_performance_reports to authenticated;
grant select, insert on bitacora.airline_performance_months to authenticated;

create policy airline_reports_read on bitacora.airline_performance_reports
  for select to authenticated using (
    exists (
      select 1 from bitacora.perfiles p
      where p.id = auth.uid() and p.activo = true
        and (status = 'published' or created_by = auth.uid()) and (
        p.rol in ('admin', 'editor', 'consultor')
        or (p.rol in ('encargado', 'sede') and site_id = any(coalesce(p.sede_ids, '{}'::integer[])))
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s where s.id = site_id and s.grupo_id = p.grupo_id
        ))
      )
    )
  );

create policy airline_reports_insert on bitacora.airline_performance_reports
  for insert to authenticated with check (
    created_by = auth.uid() and status = 'draft' and storage_path is null and published_at is null
    and exists (select 1 from bitacora.sedes s
      where s.id = site_id and lower(s.tipo) = 'aeropuerto')
    and exists (select 1 from bitacora.perfiles p
      where p.id = auth.uid() and p.activo = true and p.rol in ('admin', 'editor'))
  );

create policy airline_reports_update_draft on bitacora.airline_performance_reports
  for update to authenticated
  using (
    status = 'draft' and created_by = auth.uid()
    and exists (select 1 from bitacora.perfiles p
      where p.id = auth.uid() and p.activo = true and p.rol in ('admin', 'editor'))
  )
  with check (
    created_by = auth.uid() and status in ('draft', 'published')
    and exists (select 1 from bitacora.perfiles p
      where p.id = auth.uid() and p.activo = true and p.rol in ('admin', 'editor'))
  );

create policy airline_months_read on bitacora.airline_performance_months
  for select to authenticated using (
    exists (select 1 from bitacora.airline_performance_reports r where r.id = report_id)
  );

create policy airline_months_insert on bitacora.airline_performance_months
  for insert to authenticated with check (
    exists (select 1 from bitacora.airline_performance_reports r
      where r.id = report_id and r.status = 'draft' and r.created_by = auth.uid())
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('airline-performance', 'airline-performance', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

create policy airline_pdf_read on storage.objects
  for select to authenticated using (
    bucket_id = 'airline-performance'
    and exists (select 1 from bitacora.airline_performance_reports r
      where r.id::text = split_part(name, '/', 1)
        and (r.storage_path = name or (r.status = 'draft' and r.created_by = auth.uid())))
  );

create policy airline_pdf_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'airline-performance'
    and exists (select 1 from bitacora.airline_performance_reports r
      where r.id::text = split_part(name, '/', 1)
        and r.status = 'draft' and r.created_by = auth.uid())
  );

commit;
