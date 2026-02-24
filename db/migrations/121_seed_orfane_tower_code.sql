INSERT INTO public.properties (id, name, code, status, created_at, updated_at)
VALUES (gen_random_uuid(), 'Orfane Tower', 'ORFANE_TOWER', 'active', now(), now())
ON CONFLICT (code) WHERE code IS NOT NULL
DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, updated_at = now();
