import { query } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const leaseId = params.id;

  try {
    await query("BEGIN");

    await query("DELETE FROM public.payments WHERE lease_id = $1", [leaseId]);
    await query("DELETE FROM public.lease_charges WHERE lease_id = $1", [leaseId]);
    await query("DELETE FROM public.leases WHERE id = $1", [leaseId]);

    await query("COMMIT");

    return Response.json({ ok: true });
  } catch (error) {
    await query("ROLLBACK");
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
