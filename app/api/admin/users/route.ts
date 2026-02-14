import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthSecret, verifySession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { datasetsRepo } from "@/lib/repos";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|; )session=([^;]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const session = await verifySession(token, getAuthSecret());
  if (!session || session.role !== "admin") return null;
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

function normalizePermissions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item))
    .filter((item) => SECURITY_KEYS.has(item));
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

export async function GET(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const columnCheck = await query("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name' LIMIT 1");
  const hasName = columnCheck.rows.length > 0;

  const result = hasName
    ? await query<{
        id: string;
        name: string | null;
        phone: string;
        role: "admin" | "reception";
        created_at: string;
        updated_at: string;
      }>("SELECT id, name, phone, role, created_at, updated_at FROM users ORDER BY created_at DESC")
    : await query<{
        id: string;
        phone: string;
        role: "admin" | "reception";
        created_at: string;
        updated_at: string;
      }>("SELECT id, phone, role, created_at, updated_at FROM users ORDER BY created_at DESC");

  const [permissionsMap, namesMap] = await Promise.all([getPermissionsMap(), getNamesMap()]);
  const users = result.rows.map((row) => ({
    ...row,
    name:
      ("name" in row ? (row as { name: string | null }).name : null) ||
      namesMap[(row as { id: string }).id] ||
      null,
    permissions: permissionsMap[(row as { id: string }).id] || [],
  }));

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => ({}));
  const id = String(payload?.id || "").trim();
  const role = payload?.role === "admin" || payload?.role === "reception" ? payload.role : null;
  const name = typeof payload?.name === "string" ? payload.name.trim() : null;
  const phone = typeof payload?.phone === "string" ? payload.phone.trim() : null;
  const hasPermissions = Array.isArray(payload?.permissions);
  const permissions = normalizePermissions(payload?.permissions);

  if (!id) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const updates: string[] = [];
  const values: string[] = [];
  let index = 1;

  if (role) {
    updates.push(`role = $${index++}`);
    values.push(role);
  }
  if (phone) {
    updates.push(`phone = $${index++}`);
    values.push(phone);
  }

  const columnCheck = await query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name' LIMIT 1",
  );
  const hasName = columnCheck.rows.length > 0;
  if (hasName && name !== null) {
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

  if (!hasName && name !== null) {
    const namesMap = await getNamesMap();
    if (name) {
      namesMap[id] = name;
    } else {
      delete namesMap[id];
    }
    await setNamesMap(namesMap);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => ({}));
  const name = String(payload?.name || "").trim();
  const phone = String(payload?.phone || "").trim();
  const password = String(payload?.password || "").trim();
  const role = payload?.role === "admin" ? "admin" : "reception";
  const permissions = normalizePermissions(payload?.permissions);

  if (!phone || !password) {
    return NextResponse.json({ error: "Phone and password are required." }, { status: 400 });
  }

  const passwordHash = hashPassword(password);

  const columnCheck = await query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name' LIMIT 1",
  );
  const hasName = columnCheck.rows.length > 0;

  try {
    const result = hasName
      ? await query<{
          id: string;
          name: string | null;
          phone: string;
          role: "admin" | "reception";
          created_at: string;
          updated_at: string;
        }>(
          "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, phone, role, created_at, updated_at",
          [name || null, phone, passwordHash, role],
        )
      : await query<{
          id: string;
          phone: string;
          role: "admin" | "reception";
          created_at: string;
          updated_at: string;
        }>(
          "INSERT INTO users (phone, password_hash, role) VALUES ($1, $2, $3) RETURNING id, phone, role, created_at, updated_at",
          [phone, passwordHash, role],
        );

    const row = result.rows[0];
    const userId = (row as { id: string }).id;
    if (permissions.length) {
      const permissionsMap = await getPermissionsMap();
      permissionsMap[userId] = permissions;
      await setPermissionsMap(permissionsMap);
    }
    if (!hasName && name) {
      const namesMap = await getNamesMap();
      namesMap[userId] = name;
      await setNamesMap(namesMap);
    }
    const user = {
      ...row,
      name: "name" in row ? (row as { name: string | null }).name : name || null,
      permissions,
    };
    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "A user with this phone already exists." }, { status: 409 });
    }
    console.error("Failed to create user", err);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
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
