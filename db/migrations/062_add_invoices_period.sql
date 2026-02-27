-- 062_add_invoices_period.sql
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS period TEXT;

-- Backfill from invoice_date or date if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='invoices' AND column_name='invoice_date'
  ) THEN
    UPDATE invoices
    SET period = to_char(invoice_date::date, 'YYYY-MM')
    WHERE period IS NULL OR period = '';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='invoices' AND column_name='date'
  ) THEN
    UPDATE invoices
    SET period = to_char(date::date, 'YYYY-MM')
    WHERE period IS NULL OR period = '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period);
