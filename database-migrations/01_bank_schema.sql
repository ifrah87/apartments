-- Bank import schema for Salaam Somali Bank bookmarklet pipeline

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.bank_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'bookmarklet',
  imported_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid REFERENCES public.bank_import_batches(id) ON DELETE SET NULL,
  txn_date date NOT NULL,
  ref text,
  branch text,
  particulars text,
  cheque_no text,
  withdrawal numeric(12,2) NOT NULL DEFAULT 0,
  deposit numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2),
  category text NOT NULL DEFAULT 'SUSPENSE',
  status text NOT NULL DEFAULT 'UNREVIEWED',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_dedup_idx
  ON public.bank_transactions (
    txn_date,
    COALESCE(ref, ''),
    COALESCE(withdrawal, 0),
    COALESCE(deposit, 0),
    COALESCE(balance, 0),
    COALESCE(particulars, '')
  );
