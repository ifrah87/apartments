import { NextRequest, NextResponse } from "next/server";
import { tenantsRepo, RepoError } from "@/lib/repos";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const data = await tenantsRepo.listTenants({ propertyId, search });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/tenants failed:", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = await tenantsRepo.createTenant(payload);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("❌ /api/tenants POST failed:", err);
    return handleError(err);
  }
}
