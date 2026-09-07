-- Additive change. NULL means the existing asset has not been classified.
ALTER TABLE mantenimiento.activos
  ADD COLUMN IF NOT EXISTS bien_concesionado boolean,
  ADD COLUMN IF NOT EXISTS concesion_propietario text,
  ADD COLUMN IF NOT EXISTS concesion_referencia text;

COMMENT ON COLUMN mantenimiento.activos.bien_concesionado IS 'NULL: sin definir; true: concesionado; false: no concesionado. Independiente de la custodia.';

-- Preserve the existing proxy view, its grants and security options. New
-- columns are appended, without changing the order or types of existing ones.
CREATE OR REPLACE VIEW public.mnt_activos AS SELECT a.* FROM mantenimiento.activos a;
NOTIFY pgrst, 'reload schema';
