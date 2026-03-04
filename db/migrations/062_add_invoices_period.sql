-- 062_add_invoices_period.sql
DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS period TEXT';
  END IF;
END $$;

-- Backfill from invoice_date or date if present
DO $$
BEGIN
  IF to_regclass('public.invoices') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='invoice_date'
  ) THEN
    UPDATE public.invoices
    SET period = to_char(invoice_date::date, 'YYYY-MM')
    WHERE period IS NULL OR period = '';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='date'
  ) THEN
    UPDATE public.invoices
    SET period = to_char(date::date, 'YYYY-MM')
    WHERE period IS NULL OR period = '';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(period)';
  END IF;
END $$;
