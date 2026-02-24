ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_lease_id_fkey;

ALTER TABLE public.payments
ADD CONSTRAINT payments_lease_id_fkey
FOREIGN KEY (lease_id)
REFERENCES public.leases(id)
ON DELETE CASCADE;

ALTER TABLE public.lease_charges
DROP CONSTRAINT IF EXISTS lease_charges_lease_id_fkey;

ALTER TABLE public.lease_charges
ADD CONSTRAINT lease_charges_lease_id_fkey
FOREIGN KEY (lease_id)
REFERENCES public.leases(id)
ON DELETE CASCADE;
