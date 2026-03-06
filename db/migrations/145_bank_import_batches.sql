-- Operational import batches for bank CSV processing.
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
