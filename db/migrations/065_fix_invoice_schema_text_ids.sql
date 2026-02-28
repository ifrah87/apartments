-- Ensure invoice_lines.invoice_id matches invoices.id type (uuid)
DO $$
DECLARE
  invoices_id_type text;
  lines_invoice_id_type text;
BEGIN
  SELECT data_type INTO invoices_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='invoices' AND column_name='id';

  SELECT data_type INTO lines_invoice_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='invoice_lines' AND column_name='invoice_id';

  IF invoices_id_type = 'uuid' AND lines_invoice_id_type <> 'uuid' THEN
    EXECUTE 'ALTER TABLE public.invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_invoice_id_fkey';
    EXECUTE 'ALTER TABLE public.invoice_lines ALTER COLUMN invoice_id TYPE uuid USING NULLIF(invoice_id, '''')::uuid';
  END IF;
END $$;

-- Re-add FK (idempotent)
ALTER TABLE public.invoice_lines
  DROP CONSTRAINT IF EXISTS invoice_lines_invoice_id_fkey;

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
  ON DELETE CASCADE;
