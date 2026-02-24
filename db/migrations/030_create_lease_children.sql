CREATE TABLE IF NOT EXISTS public.lease_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  charge_date date NOT NULL,
  charge_type text NOT NULL CHECK (charge_type IN ('rent','service','other')),
  amount numeric(12,2) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  method text DEFAULT 'cash',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  received_date date NOT NULL,
  refunded_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
