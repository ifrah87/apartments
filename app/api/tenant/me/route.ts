import { NextResponse } from "next/server";
import { getCheckpoints, getDocuments, getLeases, getTenants } from "@/lib/onboardingStore";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const tenantId = req.cookies.get("tenant_session")?.value;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const [tenants, leases, checkpoints, documents] = await Promise.all([
    getTenants(),
    getLeases(),
    getCheckpoints(),
    getDocuments(),
  ]);

  const tenant = tenants.find((item) => item.id === tenantId);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
  }

  const lease = leases.find((item) => item.id === tenant.leaseId);
  const checkpoint = checkpoints.find((item) => item.tenantId === tenantId);
  const docs = documents.filter((doc) => doc.tenantId === tenantId);

  return NextResponse.json({ ok: true, tenant, lease, checkpoints: checkpoint, documents: docs });
}
