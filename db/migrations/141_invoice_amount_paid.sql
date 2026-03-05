-- Track how much has been paid against each invoice so outstanding balance is computable
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;
