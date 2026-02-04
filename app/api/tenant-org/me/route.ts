import { NextResponse } from "next/server";
import { getTenantOrgSessionId } from "@/lib/tenantOrgSession";
import {
  getCommercialCheckpoints,
  getCommercialDocuments,
  getCommercialLeases,
  getTenantOrgs,
} from "@/lib/commercialStore";

export const runtime = "nodejs";

export async function GET() {
  const orgId = getTenantOrgSessionId();
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const [orgs, leases, checkpoints, documents] = await Promise.all([
    getTenantOrgs(),
    getCommercialLeases(),
    getCommercialCheckpoints(),
    getCommercialDocuments(),
  ]);

  const org = orgs.find((item) => item.id === orgId);
  if (!org) {
    return NextResponse.json({ ok: false, error: "Tenant org not found." }, { status: 404 });
  }

  const lease = leases.find((item) => item.tenantOrgId === orgId);
  const checkpoint = checkpoints.find((item) => item.tenantOrgId === orgId);
  const docs = documents.filter((doc) => doc.tenantOrgId === orgId);

  return NextResponse.json({ ok: true, org, lease, checkpoints: checkpoint, documents: docs });
}
