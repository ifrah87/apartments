-- Seed Orfane Tower units after the default property exists.
-- Earlier seed migrations run before property creation in some environments.

WITH p AS (
  SELECT id
  FROM public.properties
  WHERE code = 'ORFANE_TOWER'
  LIMIT 1
),
floors AS (
  SELECT generate_series(1, 11) AS floor
),
slots AS (
  SELECT generate_series(1, 6) AS slot
),
all_units AS (
  SELECT
    f.floor,
    (f.floor * 100 + s.slot) AS unit_number,
    CASE
      WHEN s.slot = 6 THEN 'studio'
      WHEN s.slot = 3 THEN '3bed'
      WHEN f.floor <= 5 AND s.slot = 1 THEN '3bed'
      ELSE '2bed'
    END AS unit_type
  FROM floors f
  CROSS JOIN slots s
)
INSERT INTO public.units (property_id, unit_number, floor, unit_type, rent, status)
SELECT
  p.id,
  u.unit_number,
  u.floor,
  u.unit_type,
  CASE
    WHEN u.unit_type = '3bed' THEN 750
    WHEN u.unit_type = '2bed' THEN 650
    ELSE NULL
  END AS rent,
  'vacant'
FROM all_units u
CROSS JOIN p
ON CONFLICT (property_id, unit_number) DO NOTHING;

