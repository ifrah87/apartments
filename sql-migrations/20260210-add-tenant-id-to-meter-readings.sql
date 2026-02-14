ALTER TABLE meter_readings
ADD COLUMN IF NOT EXISTS tenant_id TEXT;
