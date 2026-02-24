INSERT INTO public.properties (name, code, city, country)
VALUES ('Test Tower 2', 'TEST_TOWER_2', 'Mogadishu', 'Somalia')
ON CONFLICT (code) WHERE code IS NOT NULL DO NOTHING;

-- OPTIONAL: seed a few test units for the second property (non-conflicting because unique is per property)
INSERT INTO public.units (id, unit_number, floor, unit_type, rent, status, created_at, property_id)
SELECT
  gen_random_uuid(),
  u.unit_number,
  u.floor,
  u.unit_type,
  u.rent,
  'vacant',
  now(),
  p.id
FROM (
  VALUES
    (101, 1, '2bed', 650),
    (102, 1, '3bed', 750),
    (103, 1, 'studio', NULL)
) AS u(unit_number, floor, unit_type, rent)
CROSS JOIN (SELECT id FROM public.properties WHERE code='TEST_TOWER_2' LIMIT 1) p
ON CONFLICT (property_id, unit_number) DO NOTHING;
