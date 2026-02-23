import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const stamp = {
    routeVersion: "debug-db-v2",
    builtAt: new Date().toISOString(),
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT || null,
  };
  try {
    const r = await query("SELECT now() as now");
    return Response.json({ ok: true, now: r.rows[0].now, ...stamp });
  } catch (err: any) {
    const causes = Array.isArray(err?.errors)
      ? err.errors.map((e: any) => ({
          name: e?.name,
          message: e?.message,
          code: e?.code,
          errno: e?.errno,
        }))
      : null;

    return Response.json(
      {
        ok: false,
        ...stamp,
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
