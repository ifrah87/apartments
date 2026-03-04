-- Split lines for bank transactions (e.g. first month rent + deposit in one payment)
CREATE TABLE IF NOT EXISTS public.bank_transaction_splits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  amount         numeric(12,2) NOT NULL,
  account_code   text,
  tenant_id      text,
  property_id    text,
  unit_id        text,
  notes          text,
  sort_order     int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_transaction_splits_txn_idx
  ON public.bank_transaction_splits(transaction_id);
