-- invoice_id MUST be uuid if invoices.id is uuid
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  description text,
  quantity numeric,
  unit_price numeric,
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoice_lines
  ADD CONSTRAINT invoice_lines_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  ON DELETE CASCADE;
