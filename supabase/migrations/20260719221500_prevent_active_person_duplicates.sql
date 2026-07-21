-- Conserva la ficha más completa de Yohana Tissera y archiva la carga incompleta.
update equipo.personas
set activo = false,
    duplicado_de = '863c8b31-e70f-4243-aeff-0f6a6b2dabd4'::uuid,
    consolidado_at = now(),
    observaciones_baja = coalesce(
      observaciones_baja,
      'Ficha duplicada consolidada; se conserva únicamente para trazabilidad.'
    ),
    updated_at = now()
where id = '4192b8f6-41cb-4fd1-b9f5-4ebb02d8fe30'::uuid;

-- Barrera final: una persona activa no puede repetirse por nombre completo.
create unique index if not exists personas_nombre_activo_unico_idx
  on equipo.personas (
    lower(btrim(nombre)),
    lower(btrim(coalesce(apellido, '')))
  )
  where activo = true and duplicado_de is null;

-- DNI y legajo también identifican unívocamente a una persona activa.
create unique index if not exists personas_dni_activo_unico_idx
  on equipo.personas (btrim(dni))
  where activo = true
    and duplicado_de is null
    and nullif(btrim(dni), '') is not null;

create unique index if not exists personas_legajo_activo_unico_idx
  on equipo.personas (btrim(legajo))
  where activo = true
    and duplicado_de is null
    and nullif(btrim(legajo), '') is not null;
