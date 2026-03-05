import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const leaseId = id;

  try {
    await query("BEGIN");

    await query("DELETE FROM public.payments WHERE lease_id = $1", [leaseId]);
    await query("DELETE FROM public.lease_charges WHERE lease_id = $1", [leaseId]);
    const res = await query("DELETE FROM public.leases WHERE id = $1 RETURNING id", [leaseId]);

    await query("COMMIT");

    if (res.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Lease not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: leaseId });
  } catch (error: any) {
    await query("ROLLBACK");
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Delete failed" },
      { status: 500 },
    );
  }
}
