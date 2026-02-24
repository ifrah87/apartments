INSERT INTO properties (id, name, code, status, city, country, created_at, updated_at)
VALUES (gen_random_uuid(), 'Orfane Tower', 'ORFANE_TOWER', 'active', 'Mogadishu', 'Somalia', now(), now())
ON CONFLICT (code) WHERE code IS NOT NULL
DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, updated_at = now();

UPDATE units
SET property_id = (
  SELECT id FROM properties
WHERE code = 'ORFANE_TOWER'
  LIMIT 1
)
WHERE property_id IS NULL;
