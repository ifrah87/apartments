-- Add CSV import columns to bank_transactions
-- Keeps backward compat with bookmarklet-imported rows (no fingerprint = NULL = not deduplicated)

ALTER TABLE public.bank_transactions
  -- Import identity
  ADD COLUMN IF NOT EXISTS fingerprint        TEXT,
  ADD COLUMN IF NOT EXISTS source_bank        TEXT,
  ADD COLUMN IF NOT EXISTS account_id         TEXT,
  ADD COLUMN IF NOT EXISTS payee              TEXT,
  ADD COLUMN IF NOT EXISTS transaction_number TEXT,
  -- Allocation / coding (set via POST /api/transactions/allocate)
  ADD COLUMN IF NOT EXISTS tenant_id          TEXT,
  ADD COLUMN IF NOT EXISTS property_id        TEXT,
  ADD COLUMN IF NOT EXISTS unit_id            TEXT,
  ADD COLUMN IF NOT EXISTS account_code       TEXT,
  ADD COLUMN IF NOT EXISTS alloc_notes        TEXT;

-- Partial unique index: only deduplicate rows that have a fingerprint.
-- Bookmarklet rows (fingerprint IS NULL) are not affected.
CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_fingerprint_idx
  ON public.bank_transactions (fingerprint)
  WHERE fingerprint IS NOT NULL;
