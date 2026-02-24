CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_lease_per_unit
ON public.leases (unit_id)
WHERE status = 'active';
