-- Tracks which Spaces objects have been processed by the spaces-sync script.
-- Prevents re-importing the same file if the watcher restarts.
CREATE TABLE IF NOT EXISTS public.bank_import_log (
  key              TEXT        PRIMARY KEY,            -- Spaces object key
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inserted         INT         NOT NULL DEFAULT 0,
  skipped_dupes    INT         NOT NULL DEFAULT 0,
  skipped_parse    INT         NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'ok',  -- 'ok' | 'error'
  error_msg        TEXT
);
