import { NextResponse } from "next/server";
import { getTenantOrgSessionId } from "@/lib/tenantOrgSession";
import { getNotices, getTenantOrgs } from "@/lib/commercialStore";

export const runtime = "nodejs";

export async function GET() {
  const orgId = getTenantOrgSessionId();
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const [orgs, notices] = await Promise.all([getTenantOrgs(), getNotices()]);
  const org = orgs.find((item) => item.id === orgId);
  if (!org) {
    return NextResponse.json({ ok: false, error: "Tenant org not found." }, { status: 404 });
  }

  const scoped = notices.filter((notice) => {
    if (notice.propertyId !== org.propertyId) return false;
    if (notice.visibility === "all_tenants") return true;
    if (notice.visibility === "tenantOrgIds") {
      return notice.tenantOrgIds?.includes(orgId) ?? false;
    }
    return false;
  });

  return NextResponse.json({ ok: true, notices: scoped });
}
