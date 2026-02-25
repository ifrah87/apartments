-- Create a sequence-backed invoice number registry
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

CREATE TABLE IF NOT EXISTS public.invoice_numbers (
  seq bigint PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  tenant_id text,
  unit text,
  property_id uuid,
  period text,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_numbers_tenant_period
ON public.invoice_numbers (tenant_id, period);
