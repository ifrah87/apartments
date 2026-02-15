import { NextRequest, NextResponse } from "next/server";
import { computeStatus, nowIso, type OnboardingCheckpoints } from "@/lib/onboarding";
import { getCheckpoints, getTenants, updateCheckpoints, updateTenants } from "@/lib/onboardingStore";

export const runtime = "nodejs";

type Payload = Partial<Pick<
  OnboardingCheckpoints,
  "leaseAcknowledged" | "contactConfirmed" | "moveInConditionConfirmed"
>> & {
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export async function PATCH(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_session")?.value;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await req.json()) as Payload;
  const checkpointUpdates: Partial<OnboardingCheckpoints> = {
    leaseAcknowledged: payload.leaseAcknowledged,
    contactConfirmed: payload.contactConfirmed,
    moveInConditionConfirmed: payload.moveInConditionConfirmed,
    updatedAt: nowIso(),
  };

  let updatedCheckpoint: OnboardingCheckpoints | null = null;
  await updateCheckpoints((items) =>
    items.map((item) => {
      if (item.tenantId !== tenantId) return item;
      updatedCheckpoint = { ...item, ...cleanUndefined(checkpointUpdates) };
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
      return {
        ...tenant,
        phone: payload.phone ?? tenant.phone,
        emergencyContactName: payload.emergencyContactName ?? tenant.emergencyContactName,
        emergencyContactPhone: payload.emergencyContactPhone ?? tenant.emergencyContactPhone,
        onboardingStatus: nextStatus,
        updatedAt: nowIso(),
      };
    }),
  );

  return NextResponse.json({ ok: true, checkpoints: updatedCheckpoint });
}

function cleanUndefined<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;
}
