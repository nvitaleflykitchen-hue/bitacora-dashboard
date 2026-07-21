-- PENDIENTE DE APROBACION: no aplicar sin confirmacion explicita del usuario.
-- Mantiene las columnas *_sobrante como total compatible con reportes existentes.

alter table bitacora.registros
  add column if not exists op1_sobrante_reutilizable integer,
  add column if not exists op1_sobrante_descarte integer,
  add column if not exists op2_sobrante_reutilizable integer,
  add column if not exists op2_sobrante_descarte integer,
  add column if not exists vegetariano_sobrante_reutilizable integer,
  add column if not exists vegetariano_sobrante_descarte integer,
  add column if not exists ensalada_sobrante_reutilizable integer,
  add column if not exists ensalada_sobrante_descarte integer,
  add column if not exists postre_sobrante_reutilizable integer,
  add column if not exists postre_sobrante_descarte integer;

alter table bitacora.registros
  add constraint registros_op1_sobrante_discriminado_ck check (
    op1_sobrante_reutilizable is null and op1_sobrante_descarte is null
    or op1_sobrante = coalesce(op1_sobrante_reutilizable, 0) + coalesce(op1_sobrante_descarte, 0)
  ),
  add constraint registros_op2_sobrante_discriminado_ck check (
    op2_sobrante_reutilizable is null and op2_sobrante_descarte is null
    or op2_sobrante = coalesce(op2_sobrante_reutilizable, 0) + coalesce(op2_sobrante_descarte, 0)
  ),
  add constraint registros_veg_sobrante_discriminado_ck check (
    vegetariano_sobrante_reutilizable is null and vegetariano_sobrante_descarte is null
    or vegetariano_sobrante = coalesce(vegetariano_sobrante_reutilizable, 0) + coalesce(vegetariano_sobrante_descarte, 0)
  ),
  add constraint registros_ens_sobrante_discriminado_ck check (
    ensalada_sobrante_reutilizable is null and ensalada_sobrante_descarte is null
    or ensalada_sobrante = coalesce(ensalada_sobrante_reutilizable, 0) + coalesce(ensalada_sobrante_descarte, 0)
  ),
  add constraint registros_postre_sobrante_discriminado_ck check (
    postre_sobrante_reutilizable is null and postre_sobrante_descarte is null
    or postre_sobrante = coalesce(postre_sobrante_reutilizable, 0) + coalesce(postre_sobrante_descarte, 0)
  ),
  add constraint registros_sobrantes_discriminados_no_negativos_ck check (
    coalesce(op1_sobrante_reutilizable, 0) >= 0
    and coalesce(op1_sobrante_descarte, 0) >= 0
    and coalesce(op2_sobrante_reutilizable, 0) >= 0
    and coalesce(op2_sobrante_descarte, 0) >= 0
    and coalesce(vegetariano_sobrante_reutilizable, 0) >= 0
    and coalesce(vegetariano_sobrante_descarte, 0) >= 0
    and coalesce(ensalada_sobrante_reutilizable, 0) >= 0
    and coalesce(ensalada_sobrante_descarte, 0) >= 0
    and coalesce(postre_sobrante_reutilizable, 0) >= 0
    and coalesce(postre_sobrante_descarte, 0) >= 0
  );

comment on column bitacora.registros.op1_sobrante_reutilizable is 'Raciones sobrantes reutilizables de la opcion 1.';
comment on column bitacora.registros.op1_sobrante_descarte is 'Raciones sobrantes descartadas de la opcion 1.';
comment on column bitacora.registros.op2_sobrante_reutilizable is 'Raciones sobrantes reutilizables de la opcion 2.';
comment on column bitacora.registros.op2_sobrante_descarte is 'Raciones sobrantes descartadas de la opcion 2.';
comment on column bitacora.registros.vegetariano_sobrante_reutilizable is 'Raciones sobrantes reutilizables del menu vegetariano.';
comment on column bitacora.registros.vegetariano_sobrante_descarte is 'Raciones sobrantes descartadas del menu vegetariano.';
comment on column bitacora.registros.ensalada_sobrante_reutilizable is 'Raciones sobrantes reutilizables de ensalada.';
comment on column bitacora.registros.ensalada_sobrante_descarte is 'Raciones sobrantes descartadas de ensalada.';
comment on column bitacora.registros.postre_sobrante_reutilizable is 'Raciones sobrantes reutilizables de postre.';
comment on column bitacora.registros.postre_sobrante_descarte is 'Raciones sobrantes descartadas de postre.';
