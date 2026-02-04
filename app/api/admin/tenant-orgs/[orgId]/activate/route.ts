import { NextResponse } from "next/server";
import { COMMERCIAL_REQUIRED_FOR_ACTIVE, nowIso } from "@/lib/commercial";
import { getCommercialCheckpoints, getTenantOrgs, updateTenantOrgs } from "@/lib/commercialStore";

export const runtime = "nodejs";

export async function PATCH(_: Request, { params }: { params: { orgId: string } }) {
  const { orgId } = await Promise.resolve(params);
  const [orgs, checkpoints] = await Promise.all([getTenantOrgs(), getCommercialCheckpoints()]);
  const org = orgs.find((item) => item.id === orgId);
  if (!org) {
    return NextResponse.json({ ok: false, error: "Tenant org not found." }, { status: 404 });
  }
  const checkpoint = checkpoints.find((item) => item.tenantOrgId === orgId);
  if (!checkpoint) {
    return NextResponse.json({ ok: false, error: "Onboarding record not found." }, { status: 404 });
  }
  const canActivate = COMMERCIAL_REQUIRED_FOR_ACTIVE.every((key) => Boolean(checkpoint[key]));
  if (!canActivate) {
    return NextResponse.json({ ok: false, error: "Onboarding checklist incomplete." }, { status: 400 });
  }

  await updateTenantOrgs((items) =>
    items.map((item) => (item.id === orgId ? { ...item, status: "active", updatedAt: nowIso() } : item)),
  );

  return NextResponse.json({ ok: true });
}
