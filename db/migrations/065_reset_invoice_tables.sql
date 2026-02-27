BEGIN;

-- Drop dependent table first
DROP TABLE IF EXISTS public.invoice_lines CASCADE;

-- Then drop invoices
DROP TABLE IF EXISTS public.invoices CASCADE;

COMMIT;
