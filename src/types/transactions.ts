export type TxnStatus = "UNREVIEWED" | "REVIEWED" | "CODED";

export type TxnDTO = {
  id: string;

  // what the UI consumes (matches current SELECT aliases)
  date: string; // txn_date AS date
  payee: string; // COALESCE(payee, particulars, '')
  raw_particulars: string; // particulars AS raw_particulars

  amount: number; // CASE ... AS amount
  deposit: number;
  withdrawal: number;
  balance: number | null;

  reference: string | null; // ref AS reference
  transaction_number: string | null;

  source_bank: string | null;
  account_id: string | null;
  bank_account_id: string | null;

  category: string | null;
  status: string;

  tenant_id: string | null;
  property_id: string | null;
  unit_id: string | null;

  account_code: string | null;
  alloc_notes: string | null;

  created_at: string;
};
