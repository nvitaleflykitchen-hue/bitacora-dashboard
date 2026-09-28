-- Target: mixyhfdlzjarvszinytk (Fly Gestión).
-- Adjuntos DOCX de análisis para informes Copa por sede y comparativos por año.
-- Revisado y autorizado por el usuario; aplicado el 2026-09-27.
begin;

create table bitacora.airline_performance_analyses (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('site', 'comparison')),
  report_id uuid references bitacora.airline_performance_reports(id),
  airline text,
  report_year integer,
  title text not null check (length(trim(title)) between 1 and 255),
  source_name text not null check (length(trim(source_name)) between 1 and 255),
  storage_path text not null unique,
  file_size integer not null check (file_size > 0 and file_size <= 15728640),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint airline_analysis_scope_check check (
    (scope = 'site' and report_id is not null and airline is null and report_year is null)
    or (scope = 'comparison' and report_id is null and length(trim(airline)) between 2 and 120 and report_year between 2020 and 2100)
  ),
  constraint airline_analysis_path_check check (storage_path = 'analysis/' || id::text || '.docx')
);
create index airline_analyses_report_idx on bitacora.airline_performance_analyses(report_id) where scope = 'site';
create index airline_analyses_comparison_idx on bitacora.airline_performance_analyses(airline, report_year) where scope = 'comparison';
alter table bitacora.airline_performance_analyses enable row level security;
revoke all on bitacora.airline_performance_analyses from public, anon;
grant select, insert, update, delete on bitacora.airline_performance_analyses to authenticated;

create policy airline_analyses_read on bitacora.airline_performance_analyses
  for select to authenticated using (
    (status = 'pending' and created_by = (select auth.uid()))
    or (status = 'ready' and (
      (scope = 'site' and exists (
        select 1 from bitacora.airline_performance_reports r where r.id = report_id and r.status = 'published'
      ))
      or (scope = 'comparison' and exists (
        select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo = true
          and p.rol in ('admin', 'editor', 'consultor')
      ))
    ))
  );
create policy airline_analyses_insert on bitacora.airline_performance_analyses
  for insert to authenticated with check (
    created_by = (select auth.uid()) and status = 'pending'
    and exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo = true
      and p.rol in ('admin', 'editor'))
    and (
      (scope = 'site' and exists (
        select 1 from bitacora.airline_performance_reports r where r.id = report_id and r.status = 'published'
      ))
      or (scope = 'comparison' and exists (
        select 1 from bitacora.airline_performance_reports r
        where r.airline = airline_performance_analyses.airline
          and r.report_year = airline_performance_analyses.report_year and r.status = 'published'
      ))
    )
  );
create policy airline_analyses_finish on bitacora.airline_performance_analyses
  for update to authenticated
  using (status = 'pending' and created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()) and status = 'ready');
create policy airline_analyses_cancel on bitacora.airline_performance_analyses
  for delete to authenticated using (status = 'pending' and created_by = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('airline-analyses', 'airline-analyses', false, 15728640,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy airline_analysis_files_read on storage.objects
  for select to authenticated using (
    bucket_id = 'airline-analyses' and exists (
      select 1 from bitacora.airline_performance_analyses a where a.storage_path = name
    )
  );
create policy airline_analysis_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'airline-analyses' and exists (
      select 1 from bitacora.airline_performance_analyses a
      where a.storage_path = name and a.status = 'pending' and a.created_by = (select auth.uid())
    )
  );
create policy airline_analysis_files_cancel on storage.objects
  for delete to authenticated using (
    bucket_id = 'airline-analyses' and exists (
      select 1 from bitacora.airline_performance_analyses a
      where a.storage_path = name and a.status = 'pending' and a.created_by = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
commit;
