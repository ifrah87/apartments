CREATE TABLE IF NOT EXISTS public.meter_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  meter_type text NOT NULL,
  period text NOT NULL,
  prev_reading numeric NOT NULL DEFAULT 0,
  cur_reading numeric NOT NULL DEFAULT 0,
  usage numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0.41,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meter_billing_unit_meter_period_idx
  ON public.meter_billing(unit_id, meter_type, period);
