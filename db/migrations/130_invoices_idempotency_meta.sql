-- 130_invoices_idempotency_meta.sql
-- Ensure invoice uniqueness by unit + period and persist line item meta.

DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS period TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_unit_period_unique_idx
      ON public.invoices (unit_id, period);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.invoice_lines') IS NOT NULL THEN
    ALTER TABLE public.invoice_lines
      ADD COLUMN IF NOT EXISTS meta JSONB;
  END IF;
END $$;
