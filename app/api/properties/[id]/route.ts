import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Property id is required." }, { status: 400 });
  }
  const { rows } = await query<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM public.units WHERE property_id = $1",
    [id],
  );
  const count = Number(rows[0]?.count || 0);
  if (count > 0) {
    return NextResponse.json(
      { ok: false, error: "Property has units; archive instead." },
      { status: 409 },
    );
  }
  await query("DELETE FROM public.properties WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Property id is required." }, { status: 400 });
  }
  const payload = await req.json().catch(() => ({}));
  const status = payload?.status === "archived" ? "archived" : "active";
  const { rows } = await query(
    `UPDATE public.properties
     SET status = $1
     WHERE id = $2
     RETURNING id, name, code, address, city, country, status, created_at`,
    [status, id],
  );
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: rows[0] });
}
