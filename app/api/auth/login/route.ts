import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getAuthSecret, signSession } from "@/lib/auth";
import { clockInUser } from "@/lib/staffAttendance";
import { datasetsRepo } from "@/lib/repos";

export const runtime = "nodejs";

const NAME_DATASET_KEY = "admin_user_names";

function normalizeLoginName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const VALID_ROLES = ["admin", "manager", "accountant", "reception"] as const;
type AppRole = (typeof VALID_ROLES)[number];

function normalizeAppRole(value: unknown): AppRole {
  const normalized = String(value ?? "").trim().toLowerCase() as AppRole;
  return VALID_ROLES.includes(normalized) ? normalized : "reception";
}

let _usersHasNameColumn: boolean | null = null;
async function usersHaveNameColumn() {
  if (_usersHasNameColumn !== null) return _usersHasNameColumn;
  const result = await query(
    `SELECT 1
     FROM pg_catalog.pg_attribute a
     JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'users' AND a.attname = 'name'
       AND a.attnum > 0 AND NOT a.attisdropped
     LIMIT 1`,
  );
  _usersHasNameColumn = result.rows.length > 0;
  return _usersHasNameColumn;
}

export async function POST(request: Request) {
  try {
    const { name, pin } = await request.json();
    if (!name || !pin) {
      return NextResponse.json({ error: "Name and 4-digit PIN are required." }, { status: 400 });
    }
    if (!/^\d{4}$/.test(String(pin))) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }

    const hasName = await usersHaveNameColumn();
    const normalizedName = normalizeLoginName(String(name));

    let user:
      | {
          id: string;
          name: string | null;
          phone: string | null;
          password_hash: string;
          role: string | null;
        }
      | undefined;

    if (hasName) {
      const result = await query<{
        id: string;
        name: string | null;
        phone: string | null;
        password_hash: string;
        role: string | null;
      }>(
        `SELECT id, name, phone, password_hash, role
         FROM users
         WHERE lower(regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g')) = $1
         LIMIT 1`,
        [normalizedName],
      );
      user = result.rows[0];
    } else {
      const namesMap = await datasetsRepo.getDataset<Record<string, string>>(NAME_DATASET_KEY, {});
      const matchedUserId = Object.entries(namesMap).find(([, storedName]) => normalizeLoginName(storedName) === normalizedName)?.[0];
      if (matchedUserId) {
        const result = await query<{
          id: string;
          name: string | null;
          phone: string | null;
          password_hash: string;
          role: string | null;
        }>(
          "SELECT id, NULL::text as name, phone, password_hash, role FROM users WHERE id = $1 LIMIT 1",
          [matchedUserId],
        );
        user = result.rows[0];
      }
    }

    if (!user || !verifyPassword(String(pin), user.password_hash)) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const appRole = normalizeAppRole(user.role);

    await clockInUser({
      id: user.id,
      phone: user.phone,
      role: appRole,
      name: "name" in user ? (user as { name: string | null }).name : null,
    });

    const session = await signSession(
      {
        sub: user.id,
        role: appRole,
        name: user.name ?? null,
        phone: user.phone ?? null,
        exp: Date.now() + 1000 * 60 * 60 * 12,
      },
      getAuthSecret()
    );

    const response = NextResponse.json({ ok: true, role: appRole });
    response.cookies.set("session", session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
