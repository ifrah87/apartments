import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  computeCommercialMissing,
  computeCommercialStatus,
  nowIso,
  type LeaseCommercial,
  type OnboardingCheckpointsCommercial,
  type TenantOrg,
} from "@/lib/commercial";
import {
  getCommercialCheckpoints,
  getCommercialLeases,
  getTenantOrgs,
  updateCommercialCheckpoints,
  updateCommercialLeases,
  updateTenantOrgs,
} from "@/lib/commercialStore";

export const runtime = "nodejs";

type CreatePayload = {
  name: string;
  billingEmail?: string;
  billingPhone?: string;
  financeContactName?: string;
  facilitiesContactName?: string;
  facilitiesContactEmail?: string;
  unitIds: string[];
  propertyId: string;
  leaseStart: string;
  leaseEnd: string;
  rentAmount: number;
  serviceChargeAmount?: number;
  dueDay: number;
  graceDays: number;
  currency: string;
};

function summarizeMissing(checkpoints: OnboardingCheckpointsCommercial) {
  const missing = computeCommercialMissing(checkpoints);
  return missing.length > 2 ? [...missing.slice(0, 2), `+${missing.length - 2}`] : missing;
}

export async function GET() {
  const [orgs, leases, checkpoints] = await Promise.all([
    getTenantOrgs(),
    getCommercialLeases(),
    getCommercialCheckpoints(),
  ]);

  const rows = orgs.map((org) => {
    const lease = leases.find((item) => item.tenantOrgId === org.id);
    const checkpoint = checkpoints.find((item) => item.tenantOrgId === org.id);
    const missing = checkpoint ? summarizeMissing(checkpoint) : ["Lease", "Deposit/Guarantee", "Invoices"];
    return { org, lease, checkpoints: checkpoint, missing };
  });

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as CreatePayload;
    const timestamp = nowIso();
    const tenantOrgId = crypto.randomUUID();
    const leaseId = crypto.randomUUID();

    const org: TenantOrg = {
      id: tenantOrgId,
      name: payload.name,
      billingEmail: payload.billingEmail ?? "",
      billingPhone: payload.billingPhone,
      financeContactName: payload.financeContactName,
      facilitiesContactName: payload.facilitiesContactName,
      facilitiesContactEmail: payload.facilitiesContactEmail,
      unitIds: payload.unitIds || [],
      propertyId: payload.propertyId,
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const lease: LeaseCommercial = {
      id: leaseId,
      tenantOrgId,
      startDate: payload.leaseStart,
      endDate: payload.leaseEnd,
      rentAmount: Number(payload.rentAmount || 0),
      serviceChargeAmount: payload.serviceChargeAmount,
      dueDay: Number(payload.dueDay || 1),
      graceDays: Number(payload.graceDays || 0),
      currency: payload.currency || "USD",
    };

    const checkpoints: OnboardingCheckpointsCommercial = {
      tenantOrgId,
      leaseUploaded: false,
      invoicesEnabled: false,
      depositOrGuaranteeConfirmed: false,
      houseRulesConfirmed: false,
      idCopyTaken: false,
      accessCardsIssued: false,
      portalInviteSent: false,
      firstLogin: false,
      contactsConfirmed: false,
      updatedAt: timestamp,
    };

    await updateTenantOrgs((items) => [...items, org]);
    await updateCommercialLeases((items) => [...items, lease]);
    await updateCommercialCheckpoints((items) => [...items, checkpoints]);

    const status = computeCommercialStatus(org.status, checkpoints);
    if (status !== org.status) {
      await updateTenantOrgs((items) =>
        items.map((item) => (item.id === tenantOrgId ? { ...item, status, updatedAt: nowIso() } : item)),
      );
    }

    return NextResponse.json({ ok: true, orgId: tenantOrgId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to create onboarding." }, { status: 500 });
  }
}
