-- 1. Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add property_id column to units
ALTER TABLE units
ADD COLUMN IF NOT EXISTS property_id UUID;

-- 3. Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'units_property_fk'
  ) THEN
    ALTER TABLE units
    ADD CONSTRAINT units_property_fk
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE CASCADE;
  END IF;
END$$;
