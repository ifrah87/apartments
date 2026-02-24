CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_number int NOT NULL UNIQUE,
  floor int NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('3bed','2bed','studio')),
  rent numeric(12,2),
  status text NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant','occupied','maintenance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
