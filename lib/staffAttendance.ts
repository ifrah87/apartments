import "server-only";

import { query } from "@/lib/db";
import { datasetsRepo } from "@/lib/repos";

type AttendanceUser = {
  id: string;
  phone?: string | null;
  role: "admin" | "manager" | "accountant" | "reception";
  name?: string | null;
};

export type StaffAttendanceRecord = {
  id: string;
  userId: string;
  name: string | null;
  phone: string | null;
  role: "admin" | "manager" | "accountant" | "reception" | null;
  clockInAt: string;
  clockOutAt: string | null;
  status: "signed_in" | "signed_out";
};

const NAME_DATASET_KEY = "admin_user_names";

async function ensureAttendanceTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS public.staff_attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      clock_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      clock_out_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_staff_attendance_user_clock_in
     ON public.staff_attendance (user_id, clock_in_at DESC)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_staff_attendance_open_shift
     ON public.staff_attendance (user_id)
     WHERE clock_out_at IS NULL`,
  );
}

async function usersHaveNameColumn() {
  const result = await query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'name'
     LIMIT 1`,
  );
  return result.rows.length > 0;
}

export async function clockInUser(user: AttendanceUser) {
  await ensureAttendanceTable();

  const existing = await query<{ id: string }>(
    `SELECT id
     FROM public.staff_attendance
     WHERE user_id = $1
       AND clock_out_at IS NULL
     ORDER BY clock_in_at DESC
     LIMIT 1`,
    [user.id],
  );

  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const recordId = crypto.randomUUID();
  await query(
    `INSERT INTO public.staff_attendance (id, user_id, clock_in_at, created_at, updated_at)
     VALUES ($1, $2, now(), now(), now())`,
    [recordId, user.id],
  );
  return recordId;
}

export async function clockOutUser(userId: string) {
  await ensureAttendanceTable();
  const result = await query<{ id: string }>(
    `UPDATE public.staff_attendance
     SET clock_out_at = now(),
         updated_at = now()
     WHERE id = (
       SELECT id
       FROM public.staff_attendance
       WHERE user_id = $1
         AND clock_out_at IS NULL
       ORDER BY clock_in_at DESC
       LIMIT 1
     )
     RETURNING id`,
    [userId],
  );
  return result.rows[0]?.id ?? null;
}

export async function listStaffAttendance(limit = 50): Promise<StaffAttendanceRecord[]> {
  await ensureAttendanceTable();

  const hasName = await usersHaveNameColumn();
  const result = hasName
    ? await query<{
        id: string;
        user_id: string;
        clock_in_at: string | Date;
        clock_out_at: string | Date | null;
        phone: string | null;
        role: "admin" | "manager" | "accountant" | "reception" | null;
        name: string | null;
      }>(
        `SELECT
           a.id,
           a.user_id,
           a.clock_in_at,
           a.clock_out_at,
           u.phone,
           u.role,
           u.name
         FROM public.staff_attendance a
         LEFT JOIN public.users u ON u.id::text = a.user_id
         ORDER BY a.clock_in_at DESC
         LIMIT $1`,
        [limit],
      )
    : await query<{
        id: string;
        user_id: string;
        clock_in_at: string | Date;
        clock_out_at: string | Date | null;
        phone: string | null;
        role: "admin" | "manager" | "accountant" | "reception" | null;
      }>(
        `SELECT
           a.id,
           a.user_id,
           a.clock_in_at,
           a.clock_out_at,
           u.phone,
           u.role
         FROM public.staff_attendance a
         LEFT JOIN public.users u ON u.id::text = a.user_id
         ORDER BY a.clock_in_at DESC
         LIMIT $1`,
        [limit],
      );

  const namesMap = hasName ? {} : await datasetsRepo.getDataset<Record<string, string>>(NAME_DATASET_KEY, {});

  return result.rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    name:
      ("name" in row ? (row as { name: string | null }).name : null) ||
      namesMap[String(row.user_id)] ||
      null,
    phone: row.phone ?? null,
    role: row.role ?? null,
    clockInAt: new Date(row.clock_in_at).toISOString(),
    clockOutAt: row.clock_out_at ? new Date(row.clock_out_at).toISOString() : null,
    status: row.clock_out_at ? "signed_out" : "signed_in",
  }));
}
