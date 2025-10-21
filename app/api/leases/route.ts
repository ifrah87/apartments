import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export async function GET() {
  const { rows } = await query(`
    SELECT l.id, t.full_name AS tenant, p.name AS property, l.rent_amount, l.rent_day,
           l.start_date, l.end_date, l.status
    FROM leases l
    JOIN tenants t ON t.id = l.tenant_id
    JOIN properties p ON p.id = l.property_id
    ORDER BY l.id DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { tenant_id, property_id, rent_amount, rent_day, start_date } = await req.json();
  if (!tenant_id || !property_id || !rent_amount || !rent_day || !start_date) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const { rows } = await query(
    `INSERT INTO leases (tenant_id, property_id, rent_amount, rent_day, start_date, status)
     VALUES ($1,$2,$3,$4,$5,'active')
     RETURNING id`,
    [tenant_id, property_id, rent_amount, rent_day, start_date]
  );
  return NextResponse.json(rows[0], { status: 201 });
}
