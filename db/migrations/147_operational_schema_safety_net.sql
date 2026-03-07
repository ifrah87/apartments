-- Operational safety-net migration.
-- Idempotent: safe to run repeatedly.

ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.bank_transactions
  ADD COLUMN IF NOT EXISTS invoice_id text;

CREATE TABLE IF NOT EXISTS public.bank_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  invoice_id text NOT NULL,
  allocated_amount numeric(12,2) NOT NULL CHECK (allocated_amount > 0),
  match_score numeric(5,4),
  match_reason text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS bank_allocations_transaction_idx
  ON public.bank_allocations(transaction_id);

CREATE INDEX IF NOT EXISTS bank_allocations_invoice_idx
  ON public.bank_allocations(invoice_id);

CREATE TABLE IF NOT EXISTS public.bank_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  row_count int NOT NULL DEFAULT 0,
  processed_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  error_message text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_import_batches_status_idx
  ON public.bank_import_batches(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_reconciliation_events_txn_idx
  ON public.bank_reconciliation_events(transaction_id, created_at DESC);
