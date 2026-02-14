import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";

function handleError(err: unknown) {
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export async function GET() {
  try {
    const { rows } = await query<{
      id: string;
      name: string;
      building: string | null;
      property_id: string | null;
      unit: string | null;
    }>(
      `SELECT id, name, building, property_id, unit
       FROM tenants
       ORDER BY name ASC`,
    );
    const data = rows.map((tenant) => ({
      id: String(tenant.id),
      name: tenant.name,
      building: tenant.building ?? undefined,
      property_id: tenant.property_id ?? undefined,
      unit: tenant.unit ?? undefined,
    }));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/dashboard/occupancy failed:", err);
    return handleError(err);
  }
}
