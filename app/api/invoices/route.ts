import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get("unit_id") ?? searchParams.get("unitId");
    const tenantName = searchParams.get("tenant_name");
    const status = searchParams.get("status"); // e.g. "Unpaid" or "Partially Paid"

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (unitId) {
      params.push(unitId);
      conditions.push(`i.unit_id = $${params.length}`);
    }
    if (tenantName) {
      // Find tenant IDs matching this name, then find their invoices
      params.push(tenantName.trim());
      conditions.push(`i.tenant_id IN (SELECT id::text FROM public.tenants WHERE LOWER(TRIM(name)) = LOWER(TRIM($${params.length})))`);
    }
    if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      params.push(statuses);
      conditions.push(`i.status = ANY($${params.length}::text[])`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const res = await query(
      `SELECT
         i.id,
         i.invoice_number,
         i.invoice_date,
         i.due_date,
         i.total_amount,
         COALESCE(i.amount_paid, 0) AS amount_paid,
         i.status,
         i.period,
         i.tenant_id,
         i.unit_id,
         u.unit_number
       FROM public.invoices i
       LEFT JOIN public.units u ON u.id = i.unit_id
       ${where}
       ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC
       LIMIT 200`,
      params as any[],
    );

    const data = res.rows.map((r: any) => {
      let period = "";
      if (r.invoice_date) {
        const d = new Date(r.invoice_date);
        if (!isNaN(d.getTime())) {
          period = d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
        }
      }
      if (!period && r.period) period = String(r.period);
      const total = Number(r.total_amount || 0);
      const amount_paid = Number(r.amount_paid || 0);
      return {
        id: String(r.id),
        invoiceNumber: String(r.invoice_number || r.id).slice(0, 20),
        invoiceDate: r.invoice_date ? String(r.invoice_date).slice(0, 10) : null,
        dueDate: r.due_date ? String(r.due_date).slice(0, 10) : null,
        total,
        amount_paid,
        outstanding: Math.max(0, total - amount_paid),
        status: String(r.status || "Unpaid"),
        period,
        tenantId: r.tenant_id ? String(r.tenant_id) : null,
        unitId: r.unit_id ? String(r.unit_id) : null,
        unitNumber: r.unit_number ? String(r.unit_number) : null,
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ GET /api/invoices failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
