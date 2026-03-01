-- Remove Test Tower 2 (seeded for development, not needed in production)
DELETE FROM public.units
WHERE property_id IN (
  SELECT id FROM public.properties WHERE code = 'TEST_TOWER_2'
);
DELETE FROM public.properties WHERE code = 'TEST_TOWER_2';

-- Remove duplicate Orfane Tower rows that have no units (keep the one with units)
DELETE FROM public.properties
WHERE lower(name) = 'orfane tower'
  AND id NOT IN (
    SELECT property_id
    FROM public.units
    WHERE property_id IS NOT NULL
    GROUP BY property_id
    HAVING COUNT(*) > 0
  )
  AND id NOT IN (
    -- Keep at least one: the one with code ORFANE_TOWER and the most units
    SELECT id FROM public.properties
    WHERE code = 'ORFANE_TOWER'
    LIMIT 1
  );
