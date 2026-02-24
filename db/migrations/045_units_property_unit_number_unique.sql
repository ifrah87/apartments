-- Ensure no duplicates exist before adding the unique index
-- (If duplicates exist, this will show them)
-- SELECT property_id, unit_number, COUNT(*) FROM public.units GROUP BY 1,2 HAVING COUNT(*)>1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_units_property_unit_number
ON public.units(property_id, unit_number);
