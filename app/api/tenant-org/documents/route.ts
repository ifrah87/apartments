import { NextResponse } from "next/server";
import { getTenantOrgSessionId } from "@/lib/tenantOrgSession";
import { getCommercialDocuments } from "@/lib/commercialStore";

export const runtime = "nodejs";

export async function GET() {
  const orgId = getTenantOrgSessionId();
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const documents = await getCommercialDocuments();
  const scoped = documents.filter((doc) => doc.tenantOrgId === orgId);
  return NextResponse.json({ ok: true, documents: scoped });
}
