-- Track which Spaces object a transaction came from (Spaces pipeline imports)
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS source_key TEXT;  -- e.g. bank-imports/default/2026-03/20260301-143022-march.csv
