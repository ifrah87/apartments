ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS code text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'properties'
      AND indexname = 'uq_properties_code'
  ) THEN
    EXECUTE 'ALTER INDEX public.uq_properties_code RENAME TO properties_code_unique';
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS properties_code_unique
ON public.properties (code)
WHERE code IS NOT NULL;
