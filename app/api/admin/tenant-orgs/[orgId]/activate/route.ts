import { NextResponse } from "next/server";
import { COMMERCIAL_REQUIRED_FOR_ACTIVE, nowIso } from "@/lib/commercial";
import { getCommercialCheckpoints, getCommercialLeases, getTenantOrgs, updateTenantOrgs } from "@/lib/commercialStore";
import { tenantsRepo } from "@/lib/repos";

export const runtime = "nodejs";

export async function PATCH(_: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [orgs, checkpoints, leases] = await Promise.all([
    getTenantOrgs(),
    getCommercialCheckpoints(),
    getCommercialLeases(),
  ]);
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

  const lease = leases.find((item) => item.tenantOrgId === orgId);
  await tenantsRepo.upsertTenants([
    {
      id: org.id,
      name: org.name,
      building: org.propertyId ?? undefined,
      property_id: org.propertyId ?? undefined,
      unit: org.unitIds?.join(", ") || undefined,
      monthly_rent: lease?.rentAmount ?? undefined,
      due_day: lease?.dueDay ?? undefined,
      reference: org.id,
    },
  ]);

  return NextResponse.json({ ok: true });
}
