-- 063_create_invoice_lines.sql
-- Make invoice_lines.invoice_id match invoices.id type (uuid OR text) then add FK.

DO $$
DECLARE
  invoices_id_type text;
BEGIN
  -- If invoices table doesn't exist yet, just create invoice_lines WITHOUT FK for now.
  IF to_regclass('public.invoices') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public.invoice_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid NULL,
      description text,
      quantity numeric,
      unit_price numeric,
      amount numeric,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    RETURN;
  END IF;

  SELECT data_type
    INTO invoices_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'id';

  -- Create table if missing (use placeholder type first)
  IF to_regclass('public.invoice_lines') IS NULL THEN
    CREATE TABLE public.invoice_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id text NULL,
      description text,
      quantity numeric,
      unit_price numeric,
      amount numeric,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;

  -- Drop FK if it exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_lines_invoice_id_fkey') THEN
    ALTER TABLE public.invoice_lines DROP CONSTRAINT invoice_lines_invoice_id_fkey;
  END IF;

  -- Now force invoice_id to match invoices.id type
  IF invoices_id_type = 'uuid' THEN
    -- convert invoice_lines.invoice_id -> uuid
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='invoice_lines' AND column_name='invoice_id' AND data_type <> 'uuid'
    ) THEN
      ALTER TABLE public.invoice_lines
        ALTER COLUMN invoice_id TYPE uuid
        USING NULLIF(invoice_id::text, '')::uuid;
    END IF;

  ELSE
    -- convert invoice_lines.invoice_id -> text
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='invoice_lines' AND column_name='invoice_id' AND data_type <> 'text'
    ) THEN
      ALTER TABLE public.invoice_lines
        ALTER COLUMN invoice_id TYPE text
        USING invoice_id::text;
    END IF;
  END IF;

  -- Re-add FK (now types match)
  ALTER TABLE public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_fkey
    FOREIGN KEY (invoice_id)
    REFERENCES public.invoices(id)
    ON DELETE CASCADE;

END $$;
