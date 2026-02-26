-- Normalize existing status values and make the check constraint case-insensitive
UPDATE public.units
SET status = lower(status)
WHERE status IS NOT NULL;

ALTER TABLE public.units
  ALTER COLUMN status SET DEFAULT 'vacant';

ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_status_check;

ALTER TABLE public.units
  ADD CONSTRAINT units_status_check
  CHECK (lower(status) IN ('vacant','occupied','maintenance'));
