SET search_path TO public;

-- List UNREVIEWED suspense transactions, newest first.
SELECT id,
       txn_date,
       ref,
       branch,
       particulars,
       cheque_no,
       withdrawal,
       deposit,
       balance,
       category,
       status,
       created_at
FROM public.bank_transactions
WHERE category = 'SUSPENSE'
  AND status = 'UNREVIEWED'
ORDER BY txn_date DESC, created_at DESC;

-- Mark a transaction as reviewed and set a category.
-- Replace $1 with the transaction id and $2 with the category.
UPDATE public.bank_transactions
SET category = $2,
    status = 'REVIEWED'
WHERE id = $1;
