import { NextResponse } from "next/server";
import crypto from "crypto";
import { nowIso, type FacilitiesTicket } from "@/lib/commercial";
import { getTenantOrgSessionId } from "@/lib/tenantOrgSession";
import { getFacilitiesTickets, updateFacilitiesTickets } from "@/lib/commercialStore";

export const runtime = "nodejs";

type Payload = {
  unitId?: string;
  category: FacilitiesTicket["category"];
  title: string;
  description: string;
};

export async function GET() {
  const orgId = getTenantOrgSessionId();
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const tickets = await getFacilitiesTickets();
  const scoped = tickets.filter((ticket) => ticket.tenantOrgId === orgId);
  return NextResponse.json({ ok: true, tickets: scoped });
}

export async function POST(req: Request) {
  const orgId = getTenantOrgSessionId();
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await req.json()) as Payload;
  if (!payload?.title || !payload?.description) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  const ticket: FacilitiesTicket = {
    id: crypto.randomUUID(),
    tenantOrgId: orgId,
    unitId: payload.unitId || undefined,
    category: payload.category || "Other",
    title: payload.title,
    description: payload.description,
    status: "open",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await updateFacilitiesTickets((items) => [...items, ticket]);
  return NextResponse.json({ ok: true, ticket });
}
