-- Add soft-delete support for lease_charges and a DB audit trail for deposit applications.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.lease_charges
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.lease_charges
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS lease_charges_active_lease_idx
  ON public.lease_charges(lease_id)
  WHERE COALESCE(is_deleted, false) = false;

CREATE TABLE IF NOT EXISTS public.deposit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  lease_id text,
  invoice_id text,
  tx_date date NOT NULL,
  tx_type text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deposit_transactions_invoice_idx
  ON public.deposit_transactions(invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS deposit_transactions_lease_idx
  ON public.deposit_transactions(lease_id, created_at DESC);
