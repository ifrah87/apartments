-- Link bank transactions back to the invoices they settled
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS invoice_id text;

ALTER TABLE public.bank_transaction_splits
  ADD COLUMN IF NOT EXISTS invoice_id text;
