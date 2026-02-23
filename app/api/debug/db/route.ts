import { query } from "@/lib/db";

export async function GET() {
  try {
    const r = await query("SELECT now() as now");
    return Response.json({ ok: true, now: r.rows[0].now });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
