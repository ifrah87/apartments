-- Xero-style invoice allocations against bank transactions.
-- Source of truth remains public.bank_transactions.
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
