-- Add plan_id to tickets to track which plan generated it
ALTER TABLE mantenimiento.tickets ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES mantenimiento.planes_preventivos(id);

-- Note: We must redefine the mnt_tickets view so it picks up the new column. 
-- In Postgres, SELECT * in a view does not dynamically include new columns added later.
DROP VIEW IF EXISTS public.mnt_tickets;

CREATE VIEW public.mnt_tickets WITH (security_invoker = true) AS
SELECT * FROM mantenimiento.tickets;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mnt_tickets TO authenticated;
