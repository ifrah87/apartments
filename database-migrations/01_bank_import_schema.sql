-- Bank import schema and staging pipeline
-- Requires pgcrypto extension for gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bank_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text,
  imported_at timestamptz,
  meta jsonb
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid REFERENCES bank_import_batches(id),
  txn_date date,
  account_type int,
  tran_no text,
  branch text,
  particulars text,
  cheque_no text,
  withdrawal numeric(12,2),
  deposit numeric(12,2),
  balance numeric(12,2),
  category text DEFAULT 'SUSPENSE',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_transactions_stage (
  trandate text,
  accounttype text,
  tran_no text,
  branch text,
  particulars text,
  chequeno text,
  withdrawal text,
  deposit text,
  balance text
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_dedup_idx
  ON bank_transactions (txn_date, tran_no, withdrawal, deposit, balance);

INSERT INTO bank_transactions (
  txn_date,
  account_type,
  tran_no,
  branch,
  particulars,
  cheque_no,
  withdrawal,
  deposit,
  balance,
  category
)
SELECT
  to_date(trandate, 'DD/MM/YYYY') AS txn_date,
  NULLIF(accounttype, '')::int AS account_type,
  tran_no,
  branch,
  particulars,
  chequeno AS cheque_no,
  NULLIF(replace(withdrawal, ',', ''), '')::numeric(12,2) AS withdrawal,
  NULLIF(replace(deposit, ',', ''), '')::numeric(12,2) AS deposit,
  NULLIF(replace(balance, ',', ''), '')::numeric(12,2) AS balance,
  'SUSPENSE' AS category
FROM bank_transactions_stage
ON CONFLICT DO NOTHING;

SELECT COUNT(*) FROM bank_transactions;
SELECT MAX(balance) FROM bank_transactions;
