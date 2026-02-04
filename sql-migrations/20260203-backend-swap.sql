-- Backend Swap: core operational tables

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  property_id TEXT UNIQUE NOT NULL,
  building TEXT,
  units INTEGER,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  building TEXT,
  property_id TEXT,
  unit TEXT,
  monthly_rent NUMERIC,
  due_day INTEGER,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  property_id TEXT,
  unit TEXT NOT NULL,
  floor TEXT,
  type TEXT,
  beds TEXT,
  rent NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT,
  property_id TEXT,
  tenant_id TEXT,
  reference TEXT,
  category_id TEXT,
  matched_tenant_id TEXT,
  match_amount NUMERIC,
  match_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meter_readings (
  id TEXT PRIMARY KEY,
  unit TEXT NOT NULL,
  meter_type TEXT NOT NULL,
  reading_date DATE NOT NULL,
  reading_value NUMERIC NOT NULL,
  prev_value NUMERIC NOT NULL DEFAULT 0,
  usage NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
