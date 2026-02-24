DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'units_unit_number_key'
      AND table_name = 'units'
  ) THEN
    ALTER TABLE public.units DROP CONSTRAINT units_unit_number_key;
  END IF;
END$$;

DROP INDEX IF EXISTS units_unit_number_key;
