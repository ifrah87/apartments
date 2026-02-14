SET search_path TO public;

SELECT to_regclass('public.bank_import_batches') AS batches,
       to_regclass('public.bank_transactions') AS txns;

SELECT COUNT(*) AS total FROM public.bank_transactions;
SELECT COUNT(*) AS suspense FROM public.bank_transactions WHERE category = 'SUSPENSE';
SELECT status, COUNT(*) FROM public.bank_transactions GROUP BY status ORDER BY status;
SELECT MAX(balance) AS latest_balance FROM public.bank_transactions;
