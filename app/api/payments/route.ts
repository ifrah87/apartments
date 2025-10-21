import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export async function GET() {
  const { rows } = await query(`
    SELECT p.id, p.paid_on, p.amount, p.method,
           t.full_name AS tenant, pr.name AS property
    FROM payments p
    JOIN leases l ON l.id = p.lease_id
    JOIN tenants t ON t.id = l.tenant_id
    JOIN properties pr ON pr.id = l.property_id
    ORDER BY p.paid_on DESC, p.id DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { lease_id, paid_on, amount, method } = await req.json();
  if (!lease_id || !paid_on || !amount) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const { rows } = await query(
    `INSERT INTO payments (lease_id, paid_on, amount, method)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [lease_id, paid_on, amount, method ?? null]
  );
  return NextResponse.json(rows[0], { status: 201 });
}
