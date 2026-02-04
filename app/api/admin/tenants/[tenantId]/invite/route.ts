import { NextResponse } from "next/server";
import { addDays, computeStatus, createActivationToken, nowIso } from "@/lib/onboarding";
import { getCheckpoints, getTenants, updateCheckpoints, updateTenants } from "@/lib/onboardingStore";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: { tenantId: string } }) {
  const { tenantId } = await Promise.resolve(params);
  const [tenants, checkpoints] = await Promise.all([getTenants(), getCheckpoints()]);
  const tenant = tenants.find((item) => item.id === tenantId);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
  }

  const token = createActivationToken();
  const expiresAt = addDays(2);
  let updatedCheckpoint = null;

  await updateCheckpoints((items) =>
    items.map((item) => {
      if (item.tenantId !== tenantId) return item;
      updatedCheckpoint = {
        ...item,
        portalInviteSent: true,
        activationToken: token,
        activationExpiresAt: expiresAt,
        updatedAt: nowIso(),
      };
      return updatedCheckpoint;
    }),
  );

  if (!updatedCheckpoint) {
    return NextResponse.json({ ok: false, error: "Onboarding record not found." }, { status: 404 });
  }

  await updateTenants((items) =>
    items.map((item) => {
      if (item.id !== tenantId) return item;
      const nextStatus = computeStatus(item.onboardingStatus, updatedCheckpoint!);
      return { ...item, onboardingStatus: nextStatus, updatedAt: nowIso() };
    }),
  );

  return NextResponse.json({ ok: true, inviteUrl: `/tenant/activate?token=${token}`, expiresAt });
}
