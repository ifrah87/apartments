import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Use tenants table — monthly_rent is set on each tenant record and is the
    // ground truth for occupied-unit revenue. public.leases is used for lease
    // lifecycle tracking but may not always be populated.
    const { rows } = await query(`
      SELECT
        COUNT(*)                              AS active_count,
        COALESCE(SUM(t.monthly_rent), 0)     AS total_rent,
        COALESCE(AVG(t.monthly_rent), 0)     AS avg_rent
      FROM public.tenants t
      WHERE t.unit IS NOT NULL
        AND t.unit <> ''
        AND (t.monthly_rent IS NULL OR t.monthly_rent > 0)
    `);

    const row = rows[0] ?? {};
    return NextResponse.json({
      ok: true,
      data: {
        activeCount:       Number(row.active_count ?? 0),
        totalRent:         Number(row.total_rent ?? 0),
        avgRent:           Number(Number(row.avg_rent ?? 0).toFixed(2)),
        fullOccupancyRent: 37350,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load lease summary";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
