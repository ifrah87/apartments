import { NextResponse } from "next/server";
import {
  computeCommercialStatus,
  nowIso,
  type OnboardingCheckpointsCommercial,
  type TenantOrg,
} from "@/lib/commercial";
import {
  getCommercialCheckpoints,
  getCommercialDocuments,
  getCommercialLeases,
  getTenantOrgs,
  updateCommercialCheckpoints,
  updateTenantOrgs,
} from "@/lib/commercialStore";

export const runtime = "nodejs";

type PatchPayload = Partial<Pick<
  OnboardingCheckpointsCommercial,
  | "leaseUploaded"
  | "depositOrGuaranteeConfirmed"
  | "invoicesEnabled"
  | "portalInviteSent"
  | "contactsConfirmed"
  | "houseRulesConfirmed"
  | "idCopyTaken"
  | "accessCardsIssued"
>>;

export async function GET(_: Request, { params }: { params: { orgId: string } }) {
  const { orgId } = await Promise.resolve(params);
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
  const lease = leases.find((item) => item.tenantOrgId === org.id);
  const checkpoint = checkpoints.find((item) => item.tenantOrgId === org.id);
  const docs = documents.filter((doc) => doc.tenantOrgId === org.id);

  return NextResponse.json({ org, lease, checkpoints: checkpoint, documents: docs });
}

export async function PATCH(req: Request, { params }: { params: { orgId: string } }) {
  const { orgId } = await Promise.resolve(params);
  try {
    const payload = (await req.json()) as PatchPayload;
    const updates: Partial<OnboardingCheckpointsCommercial> = {
      leaseUploaded: payload.leaseUploaded,
      depositOrGuaranteeConfirmed: payload.depositOrGuaranteeConfirmed,
      invoicesEnabled: payload.invoicesEnabled,
      portalInviteSent: payload.portalInviteSent,
      contactsConfirmed: payload.contactsConfirmed,
      houseRulesConfirmed: payload.houseRulesConfirmed,
      idCopyTaken: payload.idCopyTaken,
      accessCardsIssued: payload.accessCardsIssued,
      updatedAt: nowIso(),
    };

    let updatedCheckpoint: OnboardingCheckpointsCommercial | null = null;
    await updateCommercialCheckpoints((items) =>
      items.map((item) => {
        if (item.tenantOrgId !== orgId) return item;
        updatedCheckpoint = { ...item, ...cleanUndefined(updates) };
        return updatedCheckpoint;
      }),
    );

    if (!updatedCheckpoint) {
      return NextResponse.json({ ok: false, error: "Onboarding record not found." }, { status: 404 });
    }

    await updateTenantOrgs((items) =>
      items.map((org) => {
        if (org.id !== orgId) return org;
        const nextStatus = computeCommercialStatus(org.status, updatedCheckpoint!);
        return { ...org, status: nextStatus, updatedAt: nowIso() } as TenantOrg;
      }),
    );

    return NextResponse.json({ ok: true, checkpoints: updatedCheckpoint });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to update onboarding." }, { status: 500 });
  }
}

function cleanUndefined<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;
}
