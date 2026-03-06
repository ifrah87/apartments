-- Manual reconciliation event log (operator-visible history).
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
