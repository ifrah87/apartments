import { NextResponse } from "next/server";
import { computeCommercialStatus, nowIso } from "@/lib/commercial";
import { getCommercialCheckpoints, getTenantOrgs, updateCommercialCheckpoints, updateTenantOrgs } from "@/lib/commercialStore";

export const runtime = "nodejs";

type Payload = { token: string };

export async function POST(req: Request) {
  const { token } = (await req.json()) as Payload;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });
  }

  const [orgs, checkpoints] = await Promise.all([getTenantOrgs(), getCommercialCheckpoints()]);
  const checkpoint = checkpoints.find((item) => item.activationToken === token);
  if (!checkpoint) {
    return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 404 });
  }
  if (checkpoint.tokenExpiresAt && new Date(checkpoint.tokenExpiresAt) < new Date()) {
    return NextResponse.json({ ok: false, error: "Token expired." }, { status: 410 });
  }

  const org = orgs.find((item) => item.id === checkpoint.tenantOrgId);
  if (!org) {
    return NextResponse.json({ ok: false, error: "Tenant org not found." }, { status: 404 });
  }

  await updateCommercialCheckpoints((items) =>
    items.map((item) => {
      if (item.tenantOrgId !== org.id) return item;
      return {
        ...item,
        firstLogin: true,
        activationToken: undefined,
        tokenExpiresAt: undefined,
        updatedAt: nowIso(),
      };
    }),
  );

  await updateTenantOrgs((items) =>
    items.map((item) => {
      if (item.id !== org.id) return item;
      const nextStatus = computeCommercialStatus(item.status, {
        ...checkpoint,
        firstLogin: true,
        activationToken: undefined,
        tokenExpiresAt: undefined,
      });
      return { ...item, status: nextStatus, updatedAt: nowIso() };
    }),
  );

  const response = NextResponse.json({ ok: true, orgId: org.id });
  response.cookies.set({
    name: "tenant_org_session",
    value: org.id,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
