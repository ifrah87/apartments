INSERT INTO properties (name, city, country)
VALUES ('Orfane Tower', 'Mogadishu', 'Somalia')
ON CONFLICT DO NOTHING;

UPDATE units
SET property_id = (
  SELECT id FROM properties
  WHERE name = 'Orfane Tower'
  LIMIT 1
)
WHERE property_id IS NULL;
