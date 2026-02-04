import { NextResponse } from "next/server";
import { computeStatus, nowIso } from "@/lib/onboarding";
import { getCheckpoints, getTenants, updateCheckpoints, updateTenants } from "@/lib/onboardingStore";

export const runtime = "nodejs";

type Payload = { token: string };

export async function POST(req: Request) {
  const { token } = (await req.json()) as Payload;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });
  }

  const [tenants, checkpoints] = await Promise.all([getTenants(), getCheckpoints()]);
  const checkpoint = checkpoints.find((item) => item.activationToken === token);
  if (!checkpoint) {
    return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 404 });
  }
  if (checkpoint.activationExpiresAt && new Date(checkpoint.activationExpiresAt) < new Date()) {
    return NextResponse.json({ ok: false, error: "Token expired." }, { status: 410 });
  }

  const tenant = tenants.find((item) => item.id === checkpoint.tenantId);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
  }

  await updateCheckpoints((items) =>
    items.map((item) => {
      if (item.tenantId !== tenant.id) return item;
      return {
        ...item,
        tenantFirstLogin: true,
        activationToken: undefined,
        activationExpiresAt: undefined,
        updatedAt: nowIso(),
      };
    }),
  );

  await updateTenants((items) =>
    items.map((item) => {
      if (item.id !== tenant.id) return item;
      const nextStatus = computeStatus(item.onboardingStatus, {
        ...checkpoint,
        tenantFirstLogin: true,
        activationToken: undefined,
        activationExpiresAt: undefined,
      });
      return { ...item, onboardingStatus: nextStatus, updatedAt: nowIso() };
    }),
  );

  const response = NextResponse.json({ ok: true, tenantId: tenant.id });
  response.cookies.set({
    name: "tenant_session",
    value: tenant.id,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
