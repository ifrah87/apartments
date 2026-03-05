import { NextRequest, NextResponse } from "next/server";
import { datasetsRepo } from "@/lib/repos";
import { verifySession, getAuthSecret } from "@/lib/auth";

export const runtime = "nodejs";

const DATASET_KEY = "role_permissions";

export const ALL_SECTIONS = [
  "dashboard",
  "properties",
  "units",
  "readings",
  "bills",
  "bank",
  "leases",
  "services",
  "reports",
  "settings",
  "team",
] as const;

export type Section = (typeof ALL_SECTIONS)[number];

export type RolePermissions = Record<string, Section[]>;

// Admin always has full access — never stored, always computed
const ADMIN_PERMISSIONS: Section[] = [...ALL_SECTIONS];

const DEFAULT_PERMISSIONS: RolePermissions = {
  admin: ADMIN_PERMISSIONS,
  manager: ["dashboard", "properties", "units", "readings", "bills", "bank", "leases", "services", "reports"],
  accountant: ["dashboard", "bills", "bank", "reports"],
  reception: ["dashboard", "units", "readings", "bills"],
  maintenance: ["dashboard", "units", "readings"],
};

async function requireAdmin(req: NextRequest) {
  const cookie = req.cookies.get("session")?.value ?? "";
  if (!cookie) return false;
  try {
    const session = await verifySession(cookie, getAuthSecret());
    return session?.role === "admin";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const stored = await datasetsRepo.getDataset<Partial<RolePermissions>>(DATASET_KEY, {});
    const merged: RolePermissions = { ...DEFAULT_PERMISSIONS, ...stored, admin: ADMIN_PERMISSIONS };
    return NextResponse.json({ ok: true, data: merged });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    // Validate: body must be an object of role → string[]
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    // Sanitize: only allow known sections, never modify admin
    const sanitized: RolePermissions = { admin: ADMIN_PERMISSIONS };
    for (const [role, perms] of Object.entries(body)) {
      if (role === "admin") continue;
      if (!Array.isArray(perms)) continue;
      sanitized[role] = (perms as string[]).filter((p) =>
        (ALL_SECTIONS as readonly string[]).includes(p),
      ) as Section[];
    }
    await datasetsRepo.setDataset(DATASET_KEY, sanitized);
    return NextResponse.json({ ok: true, data: sanitized });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
