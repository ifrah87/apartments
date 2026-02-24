CREATE TABLE IF NOT EXISTS public.leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date,
  rent numeric(12,2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leases_one_active_per_unit
ON public.leases(unit_id)
WHERE status='active';
