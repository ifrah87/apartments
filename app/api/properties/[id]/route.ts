import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Property id is required." }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const force = ["1", "true", "yes"].includes((searchParams.get("force") || "").toLowerCase());

  const { rows } = await query<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM public.units WHERE property_id = $1",
    [id],
  );
  const count = Number(rows[0]?.count || 0);
  if (count > 0 && !force) {
    return NextResponse.json(
      { ok: false, error: "Property has units; archive instead." },
      { status: 409 },
    );
  }

  try {
    await query("BEGIN");

    if (force) {
      await query(
        `DELETE FROM public.payments
         WHERE lease_id IN (
           SELECT id FROM public.leases
           WHERE unit_id IN (SELECT id FROM public.units WHERE property_id = $1)
         )`,
        [id],
      );
      await query(
        `DELETE FROM public.lease_charges
         WHERE lease_id IN (
           SELECT id FROM public.leases
           WHERE unit_id IN (SELECT id FROM public.units WHERE property_id = $1)
         )`,
        [id],
      );
      await query(
        `DELETE FROM public.leases
         WHERE unit_id IN (SELECT id FROM public.units WHERE property_id = $1)`,
        [id],
      );
      await query("DELETE FROM public.units WHERE property_id = $1", [id]);
      await query("DELETE FROM public.tenants WHERE property_id = $1", [id]);
    }

    const res = await query("DELETE FROM public.properties WHERE id = $1 RETURNING id", [id]);

    await query("COMMIT");

    if (res.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    await query("ROLLBACK");
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Failed to delete property." },
      { status: 500 },
    );
  }
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
