import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthSecret, verifySession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { datasetsRepo } from "@/lib/repos";
import { listStaffAttendance } from "@/lib/staffAttendance";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|; )session=([^;]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const session = await verifySession(token, getAuthSecret());
  if (!session || normalizeAppRole(session.role) !== "admin") return null;
  return session;
}

const PERMISSIONS_DATASET_KEY = "admin_user_permissions";
const NAME_DATASET_KEY = "admin_user_names";

const SECURITY_KEYS = new Set([
  "dashboard",
  "units",
  "readings",
  "bills",
  "leases",
  "expenses",
  "services",
  "team",
  "settings",
]);

type AppRole = "admin" | "reception";

type UsersColumnMeta = {
  data_type: string | null;
  udt_name: string | null;
  column_default: string | null;
};

function normalizeLoginName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePermissions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item))
    .filter((item) => SECURITY_KEYS.has(item));
}

function normalizeAppRole(value: unknown): AppRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "reception";
  return normalized === "admin" || normalized.includes("admin") ? "admin" : "reception";
}

function isRoleConstraintError(err: unknown) {
  const code = String((err as { code?: string })?.code ?? "");
  const message = err instanceof Error ? err.message.toLowerCase() : String(err ?? "").toLowerCase();
  if (message.includes("invalid input value for enum") && message.includes("role")) return true;
  if (message.includes("check constraint") && message.includes("role")) return true;
  return ["22P02", "23514", "42804"].includes(code) && message.includes("role");
}

async function getUsersColumnMeta(column: string): Promise<UsersColumnMeta | null> {
  const result = await query<UsersColumnMeta>(
    `SELECT data_type, udt_name, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = $1
     LIMIT 1`,
    [column],
  );
  return result.rows[0] ?? null;
}

async function getEnumLabels(typeName: string): Promise<string[]> {
  const result = await query<{ enumlabel: string }>(
    `SELECT e.enumlabel
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = $1
     ORDER BY e.enumsortorder ASC`,
    [typeName],
  );
  return result.rows.map((row) => String(row.enumlabel || "").trim()).filter(Boolean);
}

function buildRoleCandidates(requestedRole: AppRole, preferredRole: string) {
  const candidates = [preferredRole, requestedRole];
  if (requestedRole === "reception") {
    candidates.push("customer_service", "staff", "user", "team", "agent", "support");
  }
  return Array.from(new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean)));
}

async function resolvePreferredDbRole(requestedRole: AppRole): Promise<string> {
  const meta = await getUsersColumnMeta("role");
  if (!meta || String(meta.data_type || "").toUpperCase() !== "USER-DEFINED" || !meta.udt_name) {
    return requestedRole;
  }

  const labels = await getEnumLabels(meta.udt_name);
  if (!labels.length) return requestedRole;

  if (requestedRole === "admin") {
    const adminExact = labels.find((label) => label.toLowerCase() === "admin");
    if (adminExact) return adminExact;
    const adminLike = labels.find((label) => label.toLowerCase().includes("admin"));
    return adminLike || labels[0];
  }

  const preferred = ["reception", "customer_service", "staff", "user", "team", "agent", "support"];
  for (const value of preferred) {
    const found = labels.find((label) => label.toLowerCase() === value);
    if (found) return found;
  }

  const nonAdmin = labels.find((label) => !label.toLowerCase().includes("admin"));
  return nonAdmin || labels[0];
}

async function resolveExplicitUserIdForInsert(): Promise<string | null> {
  const meta = await getUsersColumnMeta("id");
  if (!meta) return null;
  if (meta.column_default) return null;
  const dataType = String(meta.data_type || "").toLowerCase();
  if (dataType === "uuid" || dataType === "text" || dataType === "character varying" || dataType === "varchar") {
    return crypto.randomUUID();
  }
  return null;
}

async function getPermissionsMap(): Promise<Record<string, string[]>> {
  return datasetsRepo.getDataset<Record<string, string[]>>(PERMISSIONS_DATASET_KEY, {});
}

async function setPermissionsMap(map: Record<string, string[]>) {
  await datasetsRepo.setDataset(PERMISSIONS_DATASET_KEY, map);
}

async function getNamesMap(): Promise<Record<string, string>> {
  return datasetsRepo.getDataset<Record<string, string>>(NAME_DATASET_KEY, {});
}

async function setNamesMap(map: Record<string, string>) {
  await datasetsRepo.setDataset(NAME_DATASET_KEY, map);
}

async function usersHaveNameColumn() {
  const columnCheck = await query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name' LIMIT 1",
  );
  return columnCheck.rows.length > 0;
}

async function ensureUsersAuthSchema() {
  await query("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT");
  await query("ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL");
}

async function ensureUniqueLoginName(name: string, excludeId?: string) {
  await ensureUsersAuthSchema();
  const normalizedName = normalizeLoginName(name);
  if (!normalizedName) {
    throw new Error("Login name is required.");
  }

  const hasName = await usersHaveNameColumn();
  if (hasName) {
    const params: string[] = [normalizedName];
    let sql = `
      SELECT id
      FROM users
      WHERE lower(regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g')) = $1
    `;
    if (excludeId) {
      params.push(excludeId);
      sql += ` AND id <> $2`;
    }
    sql += " LIMIT 1";
    const result = await query<{ id: string }>(sql, params);
    if (result.rows.length > 0) {
      throw new Error("A team member with this login name already exists.");
    }
    return;
  }

  const namesMap = await getNamesMap();
  const duplicate = Object.entries(namesMap).find(
    ([userId, storedName]) => userId !== excludeId && normalizeLoginName(storedName) === normalizedName,
  );
  if (duplicate) {
    throw new Error("A team member with this login name already exists.");
  }
}

export async function GET(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureUsersAuthSchema();

  const result = await query<{
    id: string;
    name: string | null;
    phone: string | null;
    role: string | null;
    created_at: string;
    updated_at: string;
  }>("SELECT id, name, phone, role, created_at, updated_at FROM users ORDER BY created_at DESC");

  const [permissionsMap, namesMap, attendance] = await Promise.all([
    getPermissionsMap(),
    getNamesMap(),
    listStaffAttendance(100),
  ]);
  const users = result.rows.map((row) => ({
    ...row,
    role: normalizeAppRole(row.role),
    name: row.name || namesMap[row.id] || null,
    permissions: permissionsMap[row.id] || [],
  }));

  return NextResponse.json({ users, attendance });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => ({}));
  const id = String(payload?.id || "").trim();
  const role: AppRole | null = payload?.role === "admin" || payload?.role === "reception" ? payload.role : null;
  const name = typeof payload?.name === "string" ? payload.name.trim() : null;
  const hasPhoneField = Object.prototype.hasOwnProperty.call(payload, "phone");
  const phone = typeof payload?.phone === "string" ? payload.phone.trim() : payload?.phone === null ? null : undefined;
  const password = typeof payload?.password === "string" ? payload.password.trim() : "";
  const hasPermissions = Array.isArray(payload?.permissions);
  const permissions = normalizePermissions(payload?.permissions);

  if (!id) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Login name is required." }, { status: 400 });
  }
  if (password && !/^\d{4}$/.test(password)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
  }

  try {
    await ensureUniqueLoginName(name, id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid login name." }, { status: 409 });
  }

  await ensureUsersAuthSchema();

  const updates: string[] = [];
  const values: Array<string | null> = [];
  let index = 1;

  if (role) {
    const dbRole = await resolvePreferredDbRole(role);
    updates.push(`role = $${index++}`);
    values.push(dbRole);
  }
  if (hasPhoneField) {
    updates.push(`phone = $${index++}`);
    values.push(phone ?? null);
  }
  if (password) {
    updates.push(`password_hash = $${index++}`);
    values.push(hashPassword(password));
  }

  if (name !== null) {
    updates.push(`name = $${index++}`);
    values.push(name);
  }

  if (updates.length) {
    updates.push("updated_at = now()");
    values.push(id);
    await query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${index}`, values);
  }

  if (hasPermissions) {
    const permissionsMap = await getPermissionsMap();
    permissionsMap[id] = permissions;
    await setPermissionsMap(permissionsMap);
  }

  const namesMap = await getNamesMap();
  if (name) {
    namesMap[id] = name;
  } else {
    delete namesMap[id];
  }
  await setNamesMap(namesMap);

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => ({}));
  const name = String(payload?.name || "").trim();
  const phone = typeof payload?.phone === "string" ? payload.phone.trim() : "";
  const password = String(payload?.password || "").trim();
  const role: AppRole = payload?.role === "admin" ? "admin" : "reception";
  const permissions = normalizePermissions(payload?.permissions);

  if (!name || !password) {
    return NextResponse.json({ error: "Login name and 4-digit PIN are required." }, { status: 400 });
  }
  if (!/^\d{4}$/.test(password)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
  }

  try {
    await ensureUniqueLoginName(name);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid login name." }, { status: 409 });
  }

  await ensureUsersAuthSchema();

  const passwordHash = hashPassword(password);

  try {
    const preferredRole = await resolvePreferredDbRole(role);
    const roleCandidates = buildRoleCandidates(role, preferredRole);
    const explicitId = await resolveExplicitUserIdForInsert();
    let row:
      | {
          id: string;
          name: string | null;
          phone: string | null;
          role: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    for (const candidateRole of roleCandidates) {
      try {
        const result = explicitId
          ? await query<{
              id: string;
              name: string | null;
              phone: string | null;
              role: string | null;
              created_at: string;
              updated_at: string;
            }>(
              "INSERT INTO users (id, name, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, phone, role, created_at, updated_at",
              [explicitId, name || null, phone || null, passwordHash, candidateRole],
            )
          : await query<{
              id: string;
              name: string | null;
              phone: string | null;
              role: string | null;
              created_at: string;
              updated_at: string;
            }>(
              "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, phone, role, created_at, updated_at",
              [name || null, phone || null, passwordHash, candidateRole],
            );
        row = result.rows[0];
        break;
      } catch (error) {
        if (isRoleConstraintError(error) && candidateRole !== roleCandidates[roleCandidates.length - 1]) {
          continue;
        }
        throw error;
      }
    }

    if (!row) {
      throw new Error("Failed to create user.");
    }
    const userId = (row as { id: string }).id;
    if (permissions.length) {
      const permissionsMap = await getPermissionsMap();
      permissionsMap[userId] = permissions;
      await setPermissionsMap(permissionsMap);
    }
    const namesMap = await getNamesMap();
    namesMap[userId] = name;
    await setNamesMap(namesMap);
    const user = {
      ...row,
      role: normalizeAppRole(row.role),
      name: row.name ?? (name || null),
      permissions,
    };
    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "A team member with this login already exists." }, { status: 409 });
    }
    console.error("Failed to create user", err);
    const message = err instanceof Error && err.message ? err.message : "Failed to create user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => ({}));
  const id = String(payload?.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }
  if (id === session.sub) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const result = await query("DELETE FROM users WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const permissionsMap = await getPermissionsMap();
  if (permissionsMap[id]) {
    delete permissionsMap[id];
    await setPermissionsMap(permissionsMap);
  }

  const namesMap = await getNamesMap();
  if (namesMap[id]) {
    delete namesMap[id];
    await setNamesMap(namesMap);
  }

  return NextResponse.json({ ok: true });
}
