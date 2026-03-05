import { assertAdminDelete } from "@/lib/adminDelete";
import { query } from "@/lib/db";

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = assertAdminDelete(req);
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  await query("BEGIN");
  try {
    await query(`DELETE FROM properties WHERE id = $1`, [id]);
    await query("COMMIT");
    return Response.json({ ok: true });
  } catch (e: any) {
    await query("ROLLBACK");
    return Response.json({ ok: false, error: e?.message || "Delete failed" }, { status: 500 });
  }
}
