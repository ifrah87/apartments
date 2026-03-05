import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const endDate = body.endDate || new Date().toISOString().slice(0, 10);

  try {
    await query("BEGIN");

    const leaseRes = await query(
      `SELECT unit_id FROM public.leases WHERE id = $1 AND status = 'active'`,
      [id],
    );

    if (leaseRes.rowCount === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Active lease not found" }, { status: 404 });
    }

    const unitId = leaseRes.rows[0].unit_id;

    await query(
      `UPDATE public.leases
       SET status = 'ended',
           end_date = $2,
           updated_at = now()
       WHERE id = $1`,
      [id, endDate],
    );

    await query(
      `UPDATE public.units
       SET status = 'vacant',
           updated_at = now()
       WHERE id = $1`,
      [unitId],
    );

    await query("COMMIT");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await query("ROLLBACK");
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to end lease" },
      { status: 500 },
    );
  }
}
