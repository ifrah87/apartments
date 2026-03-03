import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*)                           AS active_count,
        COALESCE(SUM(l.rent), 0)          AS total_rent,
        COALESCE(AVG(l.rent), 0)          AS avg_rent,
        COALESCE(SUM(
          CASE u.unit_type
            WHEN '3bed'   THEN 750
            WHEN '2bed'   THEN 650
            ELSE 0
          END
        ), 0)                              AS full_occupancy_rent
      FROM public.leases l
      JOIN public.units u ON u.id = l.unit_id
      WHERE l.status = 'active'
    `);

    const row = rows[0] ?? {};
    return NextResponse.json({
      ok: true,
      data: {
        activeCount:       Number(row.active_count ?? 0),
        totalRent:         Number(row.total_rent ?? 0),
        avgRent:           Number(Number(row.avg_rent ?? 0).toFixed(2)),
        fullOccupancyRent: Number(row.full_occupancy_rent ?? 0),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load lease summary";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
