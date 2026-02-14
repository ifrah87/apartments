import { NextResponse } from "next/server";
import { getTenantOrgSessionId } from "@/lib/tenantOrgSession";
import { getCommercialInvoices } from "@/lib/commercialStore";

export const runtime = "nodejs";

export async function GET() {
  const orgId = await getTenantOrgSessionId();
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const invoices = await getCommercialInvoices();
  const scoped = invoices.filter((invoice) => invoice.tenantOrgId === orgId);
  return NextResponse.json({ ok: true, invoices: scoped });
}
