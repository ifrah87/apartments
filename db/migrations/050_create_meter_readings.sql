CREATE TABLE IF NOT EXISTS public.meter_readings (
  id TEXT PRIMARY KEY,
  unit TEXT NOT NULL,
  tenant_id TEXT,
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
