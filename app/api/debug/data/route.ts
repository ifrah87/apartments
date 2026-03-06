import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  try {
    const [datasets, invoices, tenants, leases] = await Promise.all([
      query(`SELECT key, jsonb_array_length(CASE jsonb_typeof(data) WHEN 'array' THEN data ELSE '[]'::jsonb END) AS count, updated_at FROM app_datasets ORDER BY updated_at DESC`),
      query(`SELECT COUNT(*) AS count FROM public.invoices`),
      query(`SELECT COUNT(*) AS count FROM public.tenants`),
      query(`SELECT COUNT(*) AS count FROM public.leases`),
    ]);

    return Response.json({
      ok: true,
      datasets: datasets.rows,
      invoices: invoices.rows[0].count,
      tenants: tenants.rows[0].count,
      leases: leases.rows[0].count,
    });
  } catch {
    return Response.json({ ok: false, error: "Debug data check failed." }, { status: 500 });
  }
}
