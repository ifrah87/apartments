CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

CREATE TABLE IF NOT EXISTS public.invoice_numbers (
  seq bigint PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  tenant_id text,
  unit text,
  property_id uuid,
  period text,
  issued_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.invoice_numbers (seq, invoice_number, tenant_id, unit, property_id, period, issued_at)
SELECT
  (regexp_match(i.invoice_number, '^Inv-([0-9]+)$'))[1]::bigint AS seq,
  i.invoice_number,
  i.tenant_id,
  u.unit_number::text AS unit,
  u.property_id,
  i.period,
  COALESCE(i.created_at, now()) AS issued_at
FROM public.invoices i
LEFT JOIN public.units u ON u.id = i.unit_id
WHERE i.invoice_number ~ '^Inv-[0-9]+$'
ON CONFLICT (seq) DO NOTHING;

DO $$
DECLARE
  max_seq bigint;
BEGIN
  SELECT GREATEST(
    COALESCE((SELECT MAX(seq) FROM public.invoice_numbers), 0),
    COALESCE((
      SELECT MAX((regexp_match(invoice_number, '^Inv-([0-9]+)$'))[1]::bigint)
      FROM public.invoices
      WHERE invoice_number ~ '^Inv-[0-9]+$'
    ), 0)
  )
  INTO max_seq;

  IF max_seq > 0 THEN
    PERFORM setval('public.invoice_number_seq', max_seq, true);
  ELSE
    PERFORM setval('public.invoice_number_seq', 1, false);
  END IF;
END $$;
