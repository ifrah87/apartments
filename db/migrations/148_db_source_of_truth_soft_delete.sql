-- Make Postgres the operational source of truth with auditable soft-delete fields.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.leases
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS leases_external_id_uidx
  ON public.leases(external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE IF EXISTS public.leases
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.leases
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS voided_at timestamptz;

ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS lease_id text;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS invoice_id text;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS bank_transaction_id uuid;

ALTER TABLE IF EXISTS public.bank_transactions
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.bank_transactions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP INDEX IF EXISTS public.uq_leases_one_active_per_unit;
DROP INDEX IF EXISTS public.uniq_active_lease_per_unit;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_lease_per_unit
  ON public.leases(unit_id)
  WHERE status = 'active'
    AND COALESCE(is_deleted, false) = false;
