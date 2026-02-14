import { NextResponse } from "next/server";
import { canActivate, nowIso } from "@/lib/onboarding";
import { getCheckpoints, getTenants, updateTenants } from "@/lib/onboardingStore";

export const runtime = "nodejs";

export async function PATCH(_: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const [tenants, checkpoints] = await Promise.all([getTenants(), getCheckpoints()]);
  const tenant = tenants.find((item) => item.id === tenantId);
  const checkpoint = checkpoints.find((item) => item.tenantId === tenantId);

  if (!tenant || !checkpoint) {
    return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
  }
  if (!canActivate(checkpoint)) {
    return NextResponse.json({ ok: false, error: "Required checkpoints incomplete." }, { status: 400 });
  }

  await updateTenants((items) =>
    items.map((item) =>
      item.id === tenantId ? { ...item, onboardingStatus: "active", updatedAt: nowIso() } : item,
    ),
  );

  return NextResponse.json({ ok: true });
}
