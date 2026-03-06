import { NextResponse } from "next/server";
import { getAuthSecret, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

const VALID_ROLES = ["admin", "manager", "accountant", "reception"] as const;
type AppRole = (typeof VALID_ROLES)[number];

function normalizeAppRole(value: unknown): AppRole {
  const normalized = String(value ?? "").trim().toLowerCase() as AppRole;
  return VALID_ROLES.includes(normalized) ? normalized : "reception";
}

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|; )session=([^;]+)/);
  if (!match) return NextResponse.json({ authenticated: false });
  let session: Awaited<ReturnType<typeof verifySession>> = null;
  try {
    const token = decodeURIComponent(match[1]);
    session = await verifySession(token, getAuthSecret());
  } catch {
    return NextResponse.json({ authenticated: false });
  }
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    name: session.name ?? null,
    role: normalizeAppRole(session.role),
  });
}
