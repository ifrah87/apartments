import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const stamp = {
    routeVersion: "debug-db-v2",
    builtAt: new Date().toISOString(),
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT || null,
  };
  try {
    const r = await query("SELECT now() as now");
    return Response.json({ ok: true, now: r.rows[0].now, ...stamp });
  } catch {
    return Response.json(
      {
        ok: false,
        ...stamp,
        error: "Debug DB check failed.",
      },
      { status: 500 },
    );
  }
}
