import { NextRequest, NextResponse } from "next/server";
import { listInvoices } from "@/src/modules/billing/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get("unit_id") ?? searchParams.get("unitId");
    const tenantName = searchParams.get("tenant_name");
    const status = searchParams.get("status"); // e.g. "Unpaid" or "Partially Paid"
    const listed = await listInvoices({ unitId, tenantName, status });
    const data = listed.map((item) => ({
      ...item,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ GET /api/invoices failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
