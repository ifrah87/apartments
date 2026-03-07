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
    WHERE COALESCE(l.is_deleted, false) = false
    ORDER BY u.unit_number ASC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { unit_id, tenant_id, rent, start_date, end_date } = await req.json();
  if (!unit_id || !tenant_id || !rent || !start_date) {
    return NextResponse.json({ error: "unit_id, tenant_id, rent, and start_date are required" }, { status: 400 });
  }
  if (!isUuid(unit_id)) {
    return NextResponse.json({ error: `Invalid unit_id: ${unit_id}` }, { status: 400 });
  }
  const normalizedStart = String(start_date).slice(0, 10);
  const normalizedEnd = end_date ? String(end_date).slice(0, 10) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedStart)) {
    return NextResponse.json({ error: "start_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (normalizedEnd && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedEnd)) {
    return NextResponse.json({ error: "end_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (normalizedEnd && normalizedEnd < normalizedStart) {
    return NextResponse.json({ error: "end_date cannot be before start_date" }, { status: 400 });
  }

  const overlapRes = await query<{ id: string }>(
    `SELECT id
     FROM public.leases
     WHERE unit_id = $1
       AND status = 'active'
       AND COALESCE(is_deleted, false) = false
       AND daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]')
           && daterange($2::date, COALESCE($3::date, 'infinity'::date), '[]')
     LIMIT 1`,
    [unit_id, normalizedStart, normalizedEnd],
  );
  if (overlapRes.rows.length) {
    return NextResponse.json({ error: "Unit already has active lease" }, { status: 409 });
  }

  const tenantId = normalizeId(tenant_id);
  const { rows } = await query(
    `INSERT INTO public.leases (unit_id, tenant_id, rent, start_date, end_date, status, is_deleted, deleted_at)
     VALUES ($1, $2, $3, $4, $5, 'active', false, NULL)
     RETURNING id`,
    [unit_id, tenantId, rent, normalizedStart, normalizedEnd],
  );
  return NextResponse.json(rows[0], { status: 201 });
}
