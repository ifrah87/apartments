import { query } from "@/lib/db";

export async function GET() {
  try {
    const r = await query("SELECT now() as now");
    return Response.json({ ok: true, now: r.rows[0].now });
  } catch (err: any) {
    const causes = Array.isArray(err?.errors)
      ? err.errors.map((e: any) => ({
          name: e?.name,
          message: e?.message,
          code: e?.code,
          errno: e?.errno,
        }))
      : undefined;

    return Response.json(
      {
        ok: false,
        name: err?.name,
        message: err?.message,
        code: err?.code,
        errno: err?.errno,
        causes,
      },
      { status: 500 }
    );
  }
}
