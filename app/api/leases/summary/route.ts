import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const today = toDateOnly(new Date());
    const propertyId = req.nextUrl.searchParams.get("propertyId");
    const normalizedProperty = String(propertyId || "").trim().toLowerCase();
    const params: string[] = [today];
    const propertyClause = normalizedProperty
      ? `AND lower(coalesce(u.property_id::text, '')) = $2`
      : "";
    if (normalizedProperty) params.push(normalizedProperty);

    const { rows } = await query<{
      active_count: number;
      total_rent: number;
      avg_rent: number;
      full_occupancy_rent: number;
    }>(
      `SELECT
         COUNT(*)::int AS active_count,
         COALESCE(SUM(COALESCE(l.rent, 0)), 0)::numeric AS total_rent,
         COALESCE(AVG(COALESCE(l.rent, 0)), 0)::numeric AS avg_rent,
         (
           SELECT COALESCE(SUM(COALESCE(u2.rent, 0)), 0)::numeric
           FROM public.units u2
           ${normalizedProperty ? "WHERE lower(coalesce(u2.property_id::text, '')) = $2" : ""}
         ) AS full_occupancy_rent
       FROM public.leases l
       JOIN public.units u ON u.id = l.unit_id
       WHERE lower(l.status) = 'active'
         AND COALESCE(l.is_deleted, false) = false
         AND l.start_date <= $1
         AND (l.end_date IS NULL OR l.end_date >= $1)
         ${propertyClause}`,
      params,
    );
    const row = rows[0] ?? { active_count: 0, total_rent: 0, avg_rent: 0 };

    return NextResponse.json({
      ok: true,
      data: {
        activeCount: Number(row.active_count || 0),
        totalRent: Number(row.total_rent || 0),
        avgRent: Number(Number(row.avg_rent || 0).toFixed(2)),
        fullOccupancyRent: Number(row.full_occupancy_rent || 0),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load lease summary";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
