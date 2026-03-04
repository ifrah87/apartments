ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE public.users
SET name = phone
WHERE COALESCE(NULLIF(trim(name), ''), '') = ''
  AND COALESCE(NULLIF(trim(phone), ''), '') <> '';

ALTER TABLE public.users
  ALTER COLUMN phone DROP NOT NULL;
