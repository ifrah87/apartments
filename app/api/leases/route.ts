import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { normalizeId } from "@/lib/normalizeId";
import { isUuid } from "@/lib/isUuid";

export async function GET() {
  const { rows } = await query(`
    SELECT
      l.id,
      l.tenant_id,
      t.name        AS tenant,
      l.unit_id,
      u.unit_number,
      u.unit_type,
      u.property_id,
      p.name        AS property,
      l.rent,
      l.start_date,
      l.end_date,
      l.status
    FROM public.leases l
    JOIN public.tenants t ON t.id = l.tenant_id
    JOIN public.units   u ON u.id = l.unit_id
    LEFT JOIN public.properties p ON p.id = u.property_id
    ORDER BY u.unit_number ASC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { unit_id, tenant_id, rent, start_date } = await req.json();
  if (!unit_id || !tenant_id || !rent || !start_date) {
    return NextResponse.json({ error: "unit_id, tenant_id, rent, and start_date are required" }, { status: 400 });
  }
  if (!isUuid(unit_id)) {
    return NextResponse.json({ error: `Invalid unit_id: ${unit_id}` }, { status: 400 });
  }
  const tenantId = normalizeId(tenant_id);
  const { rows } = await query(
    `INSERT INTO public.leases (unit_id, tenant_id, rent, start_date, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING id`,
    [unit_id, tenantId, rent, start_date],
  );
  return NextResponse.json(rows[0], { status: 201 });
}
