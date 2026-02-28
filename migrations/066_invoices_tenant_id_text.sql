BEGIN;

-- drop dependent index if it exists
DROP INDEX IF EXISTS public.invoices_tenant_id_idx;

-- convert invoices.tenant_id from uuid -> text
ALTER TABLE public.invoices
  ALTER COLUMN tenant_id TYPE text
  USING tenant_id::text;

-- re-create index for performance
CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx ON public.invoices(tenant_id);

COMMIT;
