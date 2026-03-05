-- Add Tenant Security Deposits account (missing after Xero COA replacement)
INSERT INTO public.chart_of_accounts (code, name, category, sub_type, sort_order)
VALUES ('820', 'Tenant Security Deposits', 'LIABILITY', 'Current Liability', 155)
ON CONFLICT (code) DO NOTHING;
