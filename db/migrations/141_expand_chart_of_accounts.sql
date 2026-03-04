-- Expand COA with additional accounts for Orfane Tower property management
INSERT INTO public.chart_of_accounts (code, name, category, sub_type, sort_order) VALUES

  -- ASSETS
  ('1060', 'Petty Cash',                        'ASSET',     'Current Assets',        55),
  ('1070', 'Office Equipment',                  'ASSET',     'Fixed Assets',          56),
  ('1080', 'Furniture & Fixtures',              'ASSET',     'Fixed Assets',          57),
  ('1090', 'Building Improvements',             'ASSET',     'Fixed Assets',          58),
  ('1100', 'Accumulated Depreciation',          'ASSET',     'Fixed Assets',          59),

  -- LIABILITIES
  ('2060', 'Advance Rent Received',             'LIABILITY', 'Current Liabilities',   105),
  ('2070', 'Withholding Tax Payable',           'LIABILITY', 'Current Liabilities',   106),
  ('2080', 'Loan Payable',                      'LIABILITY', 'Long-term Liabilities', 107),

  -- INCOME
  ('4060', 'Parking Income',                    'INCOME',    'Revenue',               185),
  ('4070', 'Generator / Fuel Recharge',         'INCOME',    'Revenue',               186),
  ('4080', 'Interest Income',                   'INCOME',    'Other Income',          187),
  ('4090', 'Gain on Disposal',                  'INCOME',    'Other Income',          188),
  ('4100', 'Miscellaneous Income',              'INCOME',    'Revenue',               189),

  -- EXPENSES — Utilities
  ('5025', 'Generator Fuel Expense',            'EXPENSE',   'Utilities',             205),
  ('5026', 'Generator Maintenance',             'EXPENSE',   'Utilities',             206),

  -- EXPENSES — Maintenance
  ('5075', 'Painting & Decoration',             'EXPENSE',   'Maintenance',           255),
  ('5076', 'Pest Control',                      'EXPENSE',   'Maintenance',           256),
  ('5077', 'Fire Safety & Compliance',          'EXPENSE',   'Maintenance',           257),

  -- EXPENSES — Admin & Operations
  ('5115', 'Office Supplies & Stationery',      'EXPENSE',   'Admin & Operations',    292),
  ('5116', 'Telephone & Mobile',                'EXPENSE',   'Admin & Operations',    293),
  ('5117', 'Advertising & Marketing',           'EXPENSE',   'Admin & Operations',    295),
  ('5118', 'Professional Fees (Legal)',         'EXPENSE',   'Admin & Operations',    296),
  ('5119', 'Professional Fees (Accounting)',    'EXPENSE',   'Admin & Operations',    297),

  -- EXPENSES — Payroll
  ('5125', 'Casual Labour',                     'EXPENSE',   'Payroll',               305),
  ('5126', 'Staff Accommodation',               'EXPENSE',   'Payroll',               306),

  -- EXPENSES — Finance
  ('5130', 'Bank Charges & Fees',               'EXPENSE',   'Finance',               310),
  ('5131', 'Interest Expense',                  'EXPENSE',   'Finance',               311),
  ('5132', 'Currency Exchange Loss',            'EXPENSE',   'Finance',               312),

  -- EXPENSES — Insurance & Tax
  ('5140', 'Property Insurance',                'EXPENSE',   'Insurance & Tax',       320),
  ('5141', 'Income Tax Expense',                'EXPENSE',   'Insurance & Tax',       321),
  ('5142', 'Municipal Rates & Taxes',           'EXPENSE',   'Insurance & Tax',       322),

  -- EXPENSES — Depreciation
  ('5150', 'Depreciation Expense',              'EXPENSE',   'Depreciation',          330)

ON CONFLICT (code) DO NOTHING;
