ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
CHECK (status IN ('active','archived'));

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS code text;

-- If code exists but is not unique, enforce uniqueness safely by index
-- (Skip if you don’t use code)
CREATE UNIQUE INDEX IF NOT EXISTS uq_properties_code
ON public.properties(code)
WHERE code IS NOT NULL;
