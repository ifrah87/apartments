-- Upgrade legacy text-based properties/units tables to the modern UUID schema.
-- This runs before lease migrations so FK creation succeeds.

DO $$
DECLARE
  units_is_legacy boolean := false;
  properties_is_legacy boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'units'
      AND (
        column_name = 'unit'
        OR (column_name = 'id' AND data_type <> 'uuid')
      )
  ) INTO units_is_legacy;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND (
        column_name = 'property_id'
        OR (column_name = 'id' AND data_type <> 'uuid')
      )
  ) INTO properties_is_legacy;

  IF properties_is_legacy THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'properties_legacy_sync'
    ) THEN
      EXECUTE 'DROP TABLE public.properties_legacy_sync';
    END IF;
    EXECUTE 'ALTER TABLE public.properties RENAME TO properties_legacy_sync';
  END IF;

  IF units_is_legacy THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'units_legacy_sync'
    ) THEN
      EXECUTE 'DROP TABLE public.units_legacy_sync';
    END IF;
    EXECUTE 'ALTER TABLE public.units RENAME TO units_legacy_sync';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  country text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.properties
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN status SET DEFAULT 'active';

UPDATE public.properties
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.properties
  ALTER COLUMN status SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS properties_code_unique
ON public.properties (code)
WHERE code IS NOT NULL;

CREATE TEMP TABLE IF NOT EXISTS legacy_property_map_sync (
  legacy_id text,
  legacy_property_id text,
  legacy_name text,
  legacy_building text,
  new_id uuid,
  new_name text,
  created_at timestamptz,
  updated_at timestamptz
);

TRUNCATE legacy_property_map_sync;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'properties_legacy_sync'
  ) THEN
    INSERT INTO legacy_property_map_sync (
      legacy_id,
      legacy_property_id,
      legacy_name,
      legacy_building,
      new_id,
      new_name,
      created_at,
      updated_at
    )
    SELECT
      NULLIF(trim(p.id), ''),
      NULLIF(trim(p.property_id), ''),
      NULLIF(trim(p.name), ''),
      NULLIF(trim(p.building), ''),
      CASE
        WHEN trim(p.id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN trim(p.id)::uuid
        ELSE (
          substr(md5(COALESCE(NULLIF(trim(p.property_id), ''), NULLIF(trim(p.id), ''), NULLIF(trim(p.name), ''), NULLIF(trim(p.building), ''), gen_random_uuid()::text)), 1, 8)
          || '-' ||
          substr(md5(COALESCE(NULLIF(trim(p.property_id), ''), NULLIF(trim(p.id), ''), NULLIF(trim(p.name), ''), NULLIF(trim(p.building), ''), gen_random_uuid()::text)), 9, 4)
          || '-' ||
          substr(md5(COALESCE(NULLIF(trim(p.property_id), ''), NULLIF(trim(p.id), ''), NULLIF(trim(p.name), ''), NULLIF(trim(p.building), ''), gen_random_uuid()::text)), 13, 4)
          || '-' ||
          substr(md5(COALESCE(NULLIF(trim(p.property_id), ''), NULLIF(trim(p.id), ''), NULLIF(trim(p.name), ''), NULLIF(trim(p.building), ''), gen_random_uuid()::text)), 17, 4)
          || '-' ||
          substr(md5(COALESCE(NULLIF(trim(p.property_id), ''), NULLIF(trim(p.id), ''), NULLIF(trim(p.name), ''), NULLIF(trim(p.building), ''), gen_random_uuid()::text)), 21, 12)
        )::uuid
      END AS new_id,
      COALESCE(NULLIF(trim(p.name), ''), NULLIF(trim(p.building), ''), NULLIF(trim(p.property_id), ''), 'Property') AS new_name,
      COALESCE(p.created_at, now()) AS created_at,
      COALESCE(p.updated_at, p.created_at, now()) AS updated_at
    FROM public.properties_legacy_sync p;
  END IF;
END $$;

INSERT INTO public.properties (id, name, code, status, created_at, updated_at)
SELECT
  m.new_id,
  m.new_name,
  NULL::text,
  'active',
  m.created_at,
  m.updated_at
FROM legacy_property_map_sync m
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = GREATEST(public.properties.updated_at, EXCLUDED.updated_at);

CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid,
  unit_number int NOT NULL,
  floor int NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('3bed','2bed','studio')),
  rent numeric(12,2),
  status text NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant','occupied','maintenance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT units_property_fk FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE
);

ALTER TABLE public.units
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN status SET DEFAULT 'vacant';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'units_legacy_sync'
  ) THEN
    INSERT INTO public.units (
      id,
      property_id,
      unit_number,
      floor,
      unit_type,
      rent,
      status,
      created_at,
      updated_at
    )
    SELECT
      CASE
        WHEN trim(u.id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN trim(u.id)::uuid
        ELSE (
          substr(md5('unit:' || COALESCE(NULLIF(trim(u.id), ''), gen_random_uuid()::text)), 1, 8)
          || '-' ||
          substr(md5('unit:' || COALESCE(NULLIF(trim(u.id), ''), gen_random_uuid()::text)), 9, 4)
          || '-' ||
          substr(md5('unit:' || COALESCE(NULLIF(trim(u.id), ''), gen_random_uuid()::text)), 13, 4)
          || '-' ||
          substr(md5('unit:' || COALESCE(NULLIF(trim(u.id), ''), gen_random_uuid()::text)), 17, 4)
          || '-' ||
          substr(md5('unit:' || COALESCE(NULLIF(trim(u.id), ''), gen_random_uuid()::text)), 21, 12)
        )::uuid
      END AS id,
      pm.new_id AS property_id,
      COALESCE(
        NULLIF(regexp_replace(COALESCE(u.unit, ''), '[^0-9]', '', 'g'), '')::int,
        100000 + ROW_NUMBER() OVER (ORDER BY u.created_at, u.id)
      ) AS unit_number,
      COALESCE(
        NULLIF(regexp_replace(COALESCE(u.floor, ''), '[^0-9-]', '', 'g'), '')::int,
        (COALESCE(NULLIF(regexp_replace(COALESCE(u.unit, ''), '[^0-9]', '', 'g'), '')::int, 0) / 100)
      ) AS floor,
      CASE
        WHEN lower(COALESCE(u.type, '')) LIKE '%studio%' THEN 'studio'
        WHEN lower(COALESCE(u.type, '')) LIKE '%3%' THEN '3bed'
        ELSE '2bed'
      END AS unit_type,
      u.rent,
      CASE
        WHEN lower(COALESCE(u.status, '')) LIKE 'occ%' THEN 'occupied'
        WHEN lower(COALESCE(u.status, '')) LIKE 'maint%' THEN 'maintenance'
        ELSE 'vacant'
      END AS status,
      COALESCE(u.created_at, now()) AS created_at,
      COALESCE(u.updated_at, u.created_at, now()) AS updated_at
    FROM public.units_legacy_sync u
    LEFT JOIN legacy_property_map_sync pm
      ON lower(COALESCE(trim(u.property_id), '')) = lower(COALESCE(pm.legacy_id, ''))
      OR lower(COALESCE(trim(u.property_id), '')) = lower(COALESCE(pm.legacy_property_id, ''))
      OR lower(COALESCE(trim(u.property_id), '')) = lower(COALESCE(pm.legacy_name, ''))
      OR lower(COALESCE(trim(u.property_id), '')) = lower(COALESCE(pm.legacy_building, ''))
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

UPDATE public.units
SET status = lower(status)
WHERE status IS NOT NULL;

ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_status_check;

ALTER TABLE public.units
  ADD CONSTRAINT units_status_check
  CHECK (lower(status) IN ('vacant','occupied','maintenance'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_units_property_unit_number
ON public.units(property_id, unit_number);

