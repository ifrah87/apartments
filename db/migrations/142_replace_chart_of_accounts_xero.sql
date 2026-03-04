-- Replace COA with Xero-style chart of accounts as specified by user
-- Note: account_code on bank_transactions is a plain text field (no FK),
-- so existing coded transactions won't break — they'll just need re-coding.

TRUNCATE public.chart_of_accounts;

INSERT INTO public.chart_of_accounts (code, name, category, sub_type, sort_order) VALUES

  -- ── ASSETS ────────────────────────────────────────────────────────────────
  ('90',  'Business Bank Account',           'ASSET', 'Bank',                  10),
  ('610', 'Accounts Receivable',             'ASSET', 'Accounts Receivable',   20),
  ('620', 'Prepayments',                     'ASSET', 'Current Asset',         30),
  ('630', 'Inventory',                       'ASSET', 'Inventory',             40),
  ('710', 'Office Equipment',                'ASSET', 'Fixed Asset',           50),
  ('720', 'Computer Equipment',              'ASSET', 'Fixed Asset',           60),
  ('740', 'Buildings',                       'ASSET', 'Fixed Asset',           70),
  ('750', 'Leasehold Improvements',          'ASSET', 'Fixed Asset',           80),
  ('764', 'Plant & Machinery',               'ASSET', 'Fixed Asset',           90),
  ('840', 'Historical Adjustment',           'ASSET', 'Historical',            95),

  -- ── LIABILITIES ───────────────────────────────────────────────────────────
  ('800', 'Accounts Payable',                'LIABILITY', 'Accounts Payable',      100),
  ('803', 'Wage Payables',                   'LIABILITY', 'Wages Payable',         110),
  ('805', 'Accruals',                        'LIABILITY', 'Current Liability',     120),
  ('810', 'Income in Advance',               'LIABILITY', 'Current Liability',     130),
  ('814', 'Wages Payable - Payroll',         'LIABILITY', 'Current Liability',     140),
  ('835', 'Directors'' Loan Account',        'LIABILITY', 'Current Liability',     150),
  ('850', 'Suspense',                        'LIABILITY', 'Current Liability',     160),
  ('900', 'Loan',                            'LIABILITY', 'Non-current Liability', 170),

  -- ── EQUITY ────────────────────────────────────────────────────────────────
  ('950', 'Capital - Ordinary Shares',       'EQUITY', 'Equity',              200),
  ('960', 'Retained Earnings',               'EQUITY', 'Retained Earnings',   210),
  ('970', 'Owner Funds Introduced',          'EQUITY', 'Equity',              220),
  ('980', 'Owner Drawings',                  'EQUITY', 'Equity',              230),

  -- ── INCOME ────────────────────────────────────────────────────────────────
  ('260', 'Other Revenue',                   'INCOME', 'Revenue',             300),

  -- ── EXPENSES — Direct Costs ───────────────────────────────────────────────
  ('320', 'Direct Wages',                    'EXPENSE', 'Direct Costs',       400),
  ('325', 'Direct Expenses',                 'EXPENSE', 'Direct Costs',       410),

  -- ── EXPENSES — Overheads ──────────────────────────────────────────────────
  ('400', 'Advertising & Marketing',         'EXPENSE', 'Overhead',           500),
  ('401', 'Audit & Accountancy Fees',        'EXPENSE', 'Overhead',           510),
  ('404', 'Bank Fees',                       'EXPENSE', 'Overhead',           520),
  ('408', 'Cleaning',                        'EXPENSE', 'Overhead',           530),
  ('412', 'Consulting',                      'EXPENSE', 'Overhead',           540),
  ('416', 'Depreciation Expense',            'EXPENSE', 'Overhead',           550),
  ('418', 'Charitable and Political Donations','EXPENSE','Overhead',           560),
  ('420', 'Entertainment',                   'EXPENSE', 'Overhead',           570),
  ('425', 'Postage, Freight & Courier',      'EXPENSE', 'Overhead',           580),
  ('429', 'General Expenses',                'EXPENSE', 'Overhead',           590),
  ('433', 'Insurance',                       'EXPENSE', 'Overhead',           600),
  ('441', 'Legal Expenses',                  'EXPENSE', 'Overhead',           610),
  ('445', 'Electricity',                     'EXPENSE', 'Overhead',           620),
  ('461', 'Printing & Stationery',           'EXPENSE', 'Overhead',           630),
  ('463', 'IT Software and Consumables',     'EXPENSE', 'Overhead',           640),
  ('473', 'Repairs & Maintenance',           'EXPENSE', 'Overhead',           650),
  ('477', 'Salaries',                        'EXPENSE', 'Overhead',           660),
  ('478', 'Directors'' Remuneration',        'EXPENSE', 'Overhead',           670),
  ('480', 'Staff Training',                  'EXPENSE', 'Overhead',           680),
  ('485', 'Subscriptions',                   'EXPENSE', 'Overhead',           690),
  ('489', 'Telephone & Internet',            'EXPENSE', 'Overhead',           700),
  ('493', 'Travel - National',               'EXPENSE', 'Overhead',           710),
  ('494', 'Travel - International',          'EXPENSE', 'Overhead',           720);
