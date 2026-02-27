BEGIN;

-- 1) Drop the FK if a previous attempt partially created it
ALTER TABLE IF EXISTS invoice_lines
  DROP CONSTRAINT IF EXISTS invoice_lines_invoice_id_fkey;

-- 2) If invoice_lines.invoice_id is text, convert it to uuid
--    (If you have any non-uuid values, this would fail. Since you're early,
--     we just delete any rows that can’t be converted.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='invoice_lines'
      AND column_name='invoice_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    -- delete rows that aren't valid UUID strings
    DELETE FROM invoice_lines
    WHERE invoice_id IS NULL
       OR invoice_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

    ALTER TABLE invoice_lines
      ALTER COLUMN invoice_id TYPE uuid
      USING invoice_id::uuid;
  END IF;
END $$;

-- 3) Recreate the FK with matching uuid types
ALTER TABLE invoice_lines
  ADD CONSTRAINT invoice_lines_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  ON DELETE CASCADE;

COMMIT;
