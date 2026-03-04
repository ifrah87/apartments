-- Bank accounts table (DB-backed, replaces dataset-stored bank info)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  bank_name    text        NOT NULL DEFAULT 'Salaam Bank',
  account_number text,
  currency     text        NOT NULL DEFAULT 'USD',
  color        text        NOT NULL DEFAULT '#13c2c2',
  is_default   boolean     NOT NULL DEFAULT false,
  is_active    boolean     NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Only one account can be the default at a time
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_one_default_idx
  ON public.bank_accounts (is_default)
  WHERE is_default = true;

-- Link bank_transactions rows to a bank account (nullable — legacy rows have no account)
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS bank_account_id uuid
  REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- Seed the default "Current Account"
INSERT INTO public.bank_accounts (name, bank_name, currency, is_default, color)
VALUES ('Current Account', 'Salaam Bank', 'USD', true, '#13c2c2')
ON CONFLICT DO NOTHING;
