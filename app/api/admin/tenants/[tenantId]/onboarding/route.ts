import { NextResponse } from "next/server";
import {
  computeStatus,
  nowIso,
  type OnboardingCheckpoints,
  type Tenant,
} from "@/lib/onboarding";
import { getCheckpoints, getDocuments, getLeases, getTenants, updateCheckpoints, updateTenants } from "@/lib/onboardingStore";

export const runtime = "nodejs";

type PatchPayload = Partial<Pick<
  OnboardingCheckpoints,
  "leaseUploaded" | "depositExpected" | "depositReceived" | "firstRentReceived" | "portalInviteSent"
>>;

export async function GET(_: Request, { params }: { params: { tenantId: string } }) {
  const { tenantId } = await Promise.resolve(params);
  const [tenants, leases, checkpoints, documents] = await Promise.all([
    getTenants(),
    getLeases(),
    getCheckpoints(),
    getDocuments(),
  ]);

  const tenant = tenants.find((item) => item.id === tenantId);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
  }
  const lease = leases.find((item) => item.id === tenant.leaseId);
  const checkpoint = checkpoints.find((item) => item.tenantId === tenant.id);
  const docs = documents.filter((doc) => doc.tenantId === tenant.id);

  return NextResponse.json({ tenant, lease, checkpoints: checkpoint, documents: docs });
}

export async function PATCH(req: Request, { params }: { params: { tenantId: string } }) {
  const { tenantId } = await Promise.resolve(params);
  try {
    const payload = (await req.json()) as PatchPayload;
    const updates: Partial<OnboardingCheckpoints> = {
      leaseUploaded: payload.leaseUploaded,
      depositExpected: payload.depositExpected,
      depositReceived: payload.depositReceived,
      firstRentReceived: payload.firstRentReceived,
      portalInviteSent: payload.portalInviteSent,
      updatedAt: nowIso(),
    };

    let updatedCheckpoint: OnboardingCheckpoints | null = null;
    await updateCheckpoints((items) =>
      items.map((item) => {
        if (item.tenantId !== tenantId) return item;
        updatedCheckpoint = { ...item, ...cleanUndefined(updates) };
        return updatedCheckpoint;
      }),
    );

    if (!updatedCheckpoint) {
      return NextResponse.json({ ok: false, error: "Onboarding record not found." }, { status: 404 });
    }

    await updateTenants((items) =>
      items.map((tenant) => {
        if (tenant.id !== tenantId) return tenant;
        const nextStatus = computeStatus(tenant.onboardingStatus, updatedCheckpoint!);
        return { ...tenant, onboardingStatus: nextStatus, updatedAt: nowIso() } as Tenant;
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
