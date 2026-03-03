-- Chart of Accounts for Orfane Real Estate (Mini-ERP)

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  code        TEXT PRIMARY KEY,          -- e.g. '4010'
  name        TEXT NOT NULL,             -- e.g. 'Rental Income'
  category    TEXT NOT NULL,             -- ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
  sub_type    TEXT,                      -- e.g. 'Current Assets', 'Revenue', 'Operating Expenses'
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT     NOT NULL DEFAULT 0
);

-- Wipe and re-seed so re-running is safe
TRUNCATE public.chart_of_accounts;

INSERT INTO public.chart_of_accounts (code, name, category, sub_type, sort_order) VALUES
  -- ASSETS
  ('1010', 'Business Bank Account',          'ASSET',     'Current Assets',  10),
  ('1020', 'Tenant Receivables (Rent)',       'ASSET',     'Current Assets',  20),
  ('1030', 'Tenant Receivables (Electricity)','ASSET',     'Current Assets',  30),
  ('1040', 'Prepaid Expenses',                'ASSET',     'Current Assets',  40),
  ('1050', 'Suspense Clearing (Asset)',        'ASSET',     'Current Assets',  50),

  -- LIABILITIES
  ('2010', 'Tenant Security Deposits',        'LIABILITY', 'Current Liabilities', 60),
  ('2020', 'Accrued Salaries',                'LIABILITY', 'Current Liabilities', 70),
  ('2030', 'Accrued Expenses',                'LIABILITY', 'Current Liabilities', 80),
  ('2040', 'VAT Control',                     'LIABILITY', 'Current Liabilities', 90),
  ('2050', 'Suspense Account (Liability)',    'LIABILITY', 'Current Liabilities', 100),

  -- EQUITY
  ('3010', 'Owner Capital',                   'EQUITY',    'Equity',          110),
  ('3020', 'Retained Earnings',               'EQUITY',    'Equity',          120),
  ('3030', 'Owner Drawings',                  'EQUITY',    'Equity',          130),

  -- INCOME
  ('4010', 'Rental Income',                   'INCOME',    'Revenue',         140),
  ('4020', 'Electricity Recharge Income',     'INCOME',    'Revenue',         150),
  ('4030', 'Cleaning Income',                 'INCOME',    'Revenue',         160),
  ('4040', 'Late Fee Income',                 'INCOME',    'Revenue',         170),
  ('4050', 'Other Building Income',           'INCOME',    'Revenue',         180),

  -- EXPENSES — Utilities
  ('5010', 'Electricity Expense (Common Areas)', 'EXPENSE', 'Utilities',      190),
  ('5020', 'Water Expense',                   'EXPENSE',   'Utilities',       200),

  -- EXPENSES — Maintenance
  ('5030', 'Cleaning Expense',                'EXPENSE',   'Maintenance',     210),
  ('5040', 'Plumbing & Repairs',              'EXPENSE',   'Maintenance',     220),
  ('5050', 'HVAC / Boiler Maintenance',       'EXPENSE',   'Maintenance',     230),
  ('5060', 'Lift Maintenance',                'EXPENSE',   'Maintenance',     240),
  ('5070', 'General Repairs',                 'EXPENSE',   'Maintenance',     250),

  -- EXPENSES — Admin & Operations
  ('5080', 'Internet',                        'EXPENSE',   'Admin & Operations', 260),
  ('5090', 'Security',                        'EXPENSE',   'Admin & Operations', 270),
  ('5100', 'Software & Hosting (ERP)',        'EXPENSE',   'Admin & Operations', 280),
  ('5110', 'Bank Charges',                    'EXPENSE',   'Admin & Operations', 290),

  -- EXPENSES — Payroll
  ('5120', 'Salaries Expense',                'EXPENSE',   'Payroll',         300);
