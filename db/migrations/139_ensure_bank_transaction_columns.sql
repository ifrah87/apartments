-- Ensure all bank_transactions columns exist regardless of which path created the table
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS ref                text,
  ADD COLUMN IF NOT EXISTS branch             text,
  ADD COLUMN IF NOT EXISTS cheque_no          text,
  ADD COLUMN IF NOT EXISTS balance            numeric(12,2),
  ADD COLUMN IF NOT EXISTS category           text NOT NULL DEFAULT 'SUSPENSE',
  ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'UNREVIEWED',
  ADD COLUMN IF NOT EXISTS fingerprint        text,
  ADD COLUMN IF NOT EXISTS source_bank        text,
  ADD COLUMN IF NOT EXISTS source_key         text,
  ADD COLUMN IF NOT EXISTS account_id         text,
  ADD COLUMN IF NOT EXISTS payee              text,
  ADD COLUMN IF NOT EXISTS transaction_number text,
  ADD COLUMN IF NOT EXISTS tenant_id          text,
  ADD COLUMN IF NOT EXISTS property_id        text,
  ADD COLUMN IF NOT EXISTS unit_id            text,
  ADD COLUMN IF NOT EXISTS account_code       text,
  ADD COLUMN IF NOT EXISTS alloc_notes        text;

-- Add bank_account_id FK only after ensuring bank_accounts table exists (migration 138)
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS bank_account_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bank_transactions_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT bank_transactions_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Partial unique index for fingerprint dedup (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_fingerprint_idx
  ON public.bank_transactions (fingerprint)
  WHERE fingerprint IS NOT NULL;
