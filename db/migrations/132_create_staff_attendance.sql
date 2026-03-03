CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_user_clock_in
ON public.staff_attendance (user_id, clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_open_shift
ON public.staff_attendance (user_id)
WHERE clock_out_at IS NULL;
