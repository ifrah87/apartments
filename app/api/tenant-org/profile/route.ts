import { NextResponse } from "next/server";
import { nowIso } from "@/lib/commercial";
import { getTenantOrgSessionId } from "@/lib/tenantOrgSession";
import { getCommercialCheckpoints, getTenantOrgs, updateCommercialCheckpoints, updateTenantOrgs } from "@/lib/commercialStore";

export const runtime = "nodejs";

type Payload = {
  billingPhone?: string;
  financeContactName?: string;
  facilitiesContactEmail?: string;
  facilitiesContactName?: string;
};

export async function PATCH(req: Request) {
  const orgId = getTenantOrgSessionId();
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await req.json()) as Payload;
  const [orgs, checkpoints] = await Promise.all([getTenantOrgs(), getCommercialCheckpoints()]);
  const org = orgs.find((item) => item.id === orgId);
  if (!org) {
    return NextResponse.json({ ok: false, error: "Tenant org not found." }, { status: 404 });
  }
  const checkpoint = checkpoints.find((item) => item.tenantOrgId === orgId);
  if (!checkpoint) {
    return NextResponse.json({ ok: false, error: "Onboarding record not found." }, { status: 404 });
  }

  await updateTenantOrgs((items) =>
    items.map((item) =>
      item.id === orgId
        ? {
            ...item,
            billingPhone: payload.billingPhone ?? item.billingPhone,
            financeContactName: payload.financeContactName ?? item.financeContactName,
            facilitiesContactEmail: payload.facilitiesContactEmail ?? item.facilitiesContactEmail,
            facilitiesContactName: payload.facilitiesContactName ?? item.facilitiesContactName,
            updatedAt: nowIso(),
          }
        : item,
    ),
  );

  await updateCommercialCheckpoints((items) =>
    items.map((item) =>
      item.tenantOrgId === orgId ? { ...item, contactsConfirmed: true, updatedAt: nowIso() } : item,
    ),
  );

  return NextResponse.json({ ok: true });
}
