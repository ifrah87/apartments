import { NextResponse } from "next/server";
import {
  addHours,
  computeCommercialStatus,
  createActivationToken,
  nowIso,
} from "@/lib/commercial";
import {
  getCommercialCheckpoints,
  getTenantOrgs,
  updateCommercialCheckpoints,
  updateTenantOrgs,
} from "@/lib/commercialStore";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [orgs, checkpoints] = await Promise.all([getTenantOrgs(), getCommercialCheckpoints()]);
  const org = orgs.find((item) => item.id === orgId);
  if (!org) {
    return NextResponse.json({ ok: false, error: "Tenant org not found." }, { status: 404 });
  }
  const checkpoint = checkpoints.find((item) => item.tenantOrgId === orgId);
  if (!checkpoint) {
    return NextResponse.json({ ok: false, error: "Onboarding record not found." }, { status: 404 });
  }

  const token = createActivationToken();
  const expiresAt = addHours(48);
  await updateCommercialCheckpoints((items) =>
    items.map((item) => {
      if (item.tenantOrgId !== orgId) return item;
      return {
        ...item,
        portalInviteSent: true,
        activationToken: token,
        tokenExpiresAt: expiresAt,
        updatedAt: nowIso(),
      };
    }),
  );

  await updateTenantOrgs((items) =>
    items.map((item) => {
      if (item.id !== orgId) return item;
      const nextStatus = computeCommercialStatus(item.status, {
        ...checkpoint,
        portalInviteSent: true,
        activationToken: token,
        tokenExpiresAt: expiresAt,
      });
      return { ...item, status: nextStatus, updatedAt: nowIso() };
    }),
  );

  return NextResponse.json({ ok: true, inviteUrl: `/tenant-org/activate?token=${token}` });
}
