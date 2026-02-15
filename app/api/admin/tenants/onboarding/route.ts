import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  computeMissing,
  computeStatus,
  nowIso,
  type Lease,
  type OnboardingCheckpoints,
  type Tenant,
} from "@/lib/onboarding";
import { getCheckpoints, getLeases, getTenants, updateCheckpoints, updateLeases, updateTenants } from "@/lib/onboardingStore";

export const runtime = "nodejs";

type CreatePayload = {
  fullName: string;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  propertyId: string;
  unitId: string;
  leaseStart: string;
  leaseEnd: string;
  rentAmount: number;
  dueDay: number;
  currency: string;
};

function buildMissingSummary(checkpoints: OnboardingCheckpoints) {
  const missing = computeMissing(checkpoints);
  return missing.length > 2 ? [...missing.slice(0, 2), `+${missing.length - 2} more`] : missing;
}

export async function GET() {
  const [tenants, leases, checkpoints] = await Promise.all([getTenants(), getLeases(), getCheckpoints()]);

  const rows = tenants.map((tenant) => {
    const lease = leases.find((item) => item.id === tenant.leaseId);
    const checkpoint = checkpoints.find((item) => item.tenantId === tenant.id);
    const missing = checkpoint ? buildMissingSummary(checkpoint) : ["Onboarding"];

    return {
      tenant,
      lease,
      checkpoints: checkpoint,
      missing,
    };
  });

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as CreatePayload;
    const timestamp = nowIso();
    const tenantId = crypto.randomUUID();
    const leaseId = crypto.randomUUID();

    const tenant: Tenant = {
      id: tenantId,
      fullName: payload.fullName,
      email: payload.email ?? "",
      phone: payload.phone,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone,
      unitId: payload.unitId,
      propertyId: payload.propertyId,
      leaseId,
      role: "tenant",
      onboardingStatus: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const lease: Lease = {
      id: leaseId,
      tenantId,
      startDate: payload.leaseStart,
      endDate: payload.leaseEnd,
      rentAmount: Number(payload.rentAmount || 0),
      dueDay: Number(payload.dueDay || 1),
      graceDays: 0,
      currency: payload.currency || "USD",
    };

    const checkpoints: OnboardingCheckpoints = {
      tenantId,
      leaseUploaded: false,
      leaseAcknowledged: false,
      depositExpected: 0,
      depositReceived: false,
      firstRentExpected: lease.rentAmount,
      firstRentReceived: false,
      portalInviteSent: false,
      tenantFirstLogin: false,
      contactConfirmed: false,
      moveInConditionConfirmed: false,
      updatedAt: timestamp,
    };

    await updateTenants((items) => [...items, tenant]);
    await updateLeases((items) => [...items, lease]);
    await updateCheckpoints((items) => [...items, checkpoints]);

    const status = computeStatus(tenant.onboardingStatus, checkpoints);
    if (status !== tenant.onboardingStatus) {
      await updateTenants((items) =>
        items.map((item) => (item.id === tenantId ? { ...item, onboardingStatus: status, updatedAt: nowIso() } : item)),
      );
    }

    return NextResponse.json({ ok: true, tenantId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to create onboarding." }, { status: 500 });
  }
}
