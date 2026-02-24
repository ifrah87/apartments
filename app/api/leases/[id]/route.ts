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
    await query("DELETE FROM public.leases WHERE id = $1", [leaseId]);

    await query("COMMIT");

    return NextResponse.json({ ok: true });
  } catch (error) {
    await query("ROLLBACK");
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
