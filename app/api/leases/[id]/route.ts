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

    await query(
      `UPDATE public.payments
          SET is_deleted = true,
              deleted_at = now()
        WHERE lease_id = $1`,
      [leaseId],
    );
    const res = await query(
      `UPDATE public.leases
          SET is_deleted = true,
              deleted_at = now(),
              status = 'ended',
              updated_at = now()
        WHERE id = $1
        RETURNING id`,
      [leaseId],
    );

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
