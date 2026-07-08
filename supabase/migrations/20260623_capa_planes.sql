-- PROPUESTA PENDIENTE DE APROBACIÓN EXPLÍCITA. NO APLICADA AÚN.
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Crea tabla de metadatos de cabecera por plan de acción CAPA (1 fila por auditoría),
-- usada para generar el informe PDF de avance + evidencia. Editable desde la UI.

create table if not exists bitacora.capa_planes (
  id uuid primary key default gen_random_uuid(),
  auditoria_codigo text not null unique,
  sede_id integer references bitacora.sedes(id),
  sede_nombre text,
  fecha_auditoria date,
  empresa_prestataria text,
  responsable_comedor text,
  elaboro text,
  objetivo text,
  alcance text,
  cumplimiento_informado numeric(5,2),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists capa_planes_auditoria_idx
  on bitacora.capa_planes (auditoria_codigo);

alter table bitacora.capa_planes enable row level security;

-- Mismo modelo de permisos que bitacora.capa (política abierta para anon+authenticated;
-- los roles se controlan en la UI de la app, no en RLS).
drop policy if exists all_capa_planes on bitacora.capa_planes;
create policy all_capa_planes on bitacora.capa_planes
  for all to anon, authenticated using (true) with check (true);
