-- Autorizado por el usuario y aplicado el 2026-11-25. SOLO mixyhfdlzjarvszinytk.
-- No borra datos, no cambia auth.users ni bitacora.perfiles.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  public.app_users,
  public.global_settings,
  public.recipe_ingredients,
  public.raw_materials,
  public.recipes,
  public.final_products,
  public.product_packaging,
  public.technical_sheets
FROM PUBLIC, anon;

-- Los hashes quedan reservados al servidor, también frente a cuentas con sesión.
REVOKE ALL PRIVILEGES ON TABLE public.app_users FROM authenticated;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.mnt_tickets, public.mnt_activos
FROM PUBLIC, anon;
ALTER VIEW public.mnt_tickets SET (security_invoker = true);
ALTER VIEW public.mnt_activos SET (security_invoker = true);

COMMIT;
