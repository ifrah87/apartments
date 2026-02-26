-- Ensure property -> units cascade
ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_property_fk;

ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_property_id_fkey;

ALTER TABLE public.units
  ADD CONSTRAINT units_property_fk
  FOREIGN KEY (property_id)
  REFERENCES public.properties(id)
  ON DELETE CASCADE;

-- Ensure unit -> leases cascade
ALTER TABLE public.leases
  DROP CONSTRAINT IF EXISTS leases_unit_id_fkey;

ALTER TABLE public.leases
  ADD CONSTRAINT leases_unit_id_fkey
  FOREIGN KEY (unit_id)
  REFERENCES public.units(id)
  ON DELETE CASCADE;
