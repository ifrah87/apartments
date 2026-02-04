import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthSecret, verifySession } from "@/lib/auth";

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

export async function GET(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await query<{
    id: string;
    phone: string;
    role: "admin" | "reception";
    created_at: string;
    updated_at: string;
  }>("SELECT id, phone, role, created_at, updated_at FROM users ORDER BY created_at DESC");

  return NextResponse.json({ users: result.rows });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, role } = await request.json();
  if (!id || (role !== "admin" && role !== "reception")) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  await query("UPDATE users SET role = $1, updated_at = now() WHERE id = $2", [role, id]);
  return NextResponse.json({ ok: true });
}
