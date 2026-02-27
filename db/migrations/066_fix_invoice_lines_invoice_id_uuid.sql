-- 066_fix_invoice_lines_invoice_id_uuid.sql
-- Fix FK type mismatch: invoice_lines.invoice_id (text) -> uuid to match invoices.id (uuid)

DO $$
BEGIN
  -- Only run if both tables exist
  IF to_regclass('public.invoices') IS NOT NULL
     AND to_regclass('public.invoice_lines') IS NOT NULL
  THEN

    -- Drop FK if it exists (name may vary, so handle both common cases)
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'invoice_lines_invoice_id_fkey'
    ) THEN
      ALTER TABLE public.invoice_lines DROP CONSTRAINT invoice_lines_invoice_id_fkey;
    END IF;

    -- If invoice_id is text, convert it to uuid
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoice_lines'
        AND column_name = 'invoice_id'
        AND data_type = 'text'
    ) THEN
      ALTER TABLE public.invoice_lines
        ALTER COLUMN invoice_id TYPE uuid
        USING NULLIF(invoice_id, '')::uuid;
    END IF;

    -- Recreate the FK (only if invoice_id is uuid now)
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoice_lines'
        AND column_name = 'invoice_id'
        AND data_type = 'uuid'
    ) THEN
      ALTER TABLE public.invoice_lines
        ADD CONSTRAINT invoice_lines_invoice_id_fkey
        FOREIGN KEY (invoice_id)
        REFERENCES public.invoices(id)
        ON DELETE CASCADE;
    END IF;

  END IF;
END $$;
