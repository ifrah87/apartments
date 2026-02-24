ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS code text;

DROP INDEX IF EXISTS public.uq_properties_code;

CREATE UNIQUE INDEX IF NOT EXISTS properties_code_unique
ON public.properties (code)
WHERE code IS NOT NULL;
