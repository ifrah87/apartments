import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const { rows } = await query("SELECT * FROM tenants ORDER BY id DESC");
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { full_name, email, phone } = await req.json();
  const { rows } = await query(
    "INSERT INTO tenants (full_name, email, phone) VALUES ($1,$2,$3) RETURNING *",
    [full_name, email, phone]
  );
  return NextResponse.json(rows[0], { status: 201 });
}
