-- Ensure invoices table exists before adding columns
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  unit_id TEXT,
  period TEXT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS meter_snapshot jsonb NULL;

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS total_amount numeric NULL;
