import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rows } = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN age_days <= 30  THEN total_amount ELSE 0 END), 0) AS current_30,
        COALESCE(SUM(CASE WHEN age_days > 30
                           AND age_days <= 60  THEN total_amount ELSE 0 END), 0) AS days_30_60,
        COALESCE(SUM(CASE WHEN age_days > 60   THEN total_amount ELSE 0 END), 0) AS days_60_plus,
        COALESCE(SUM(total_amount), 0)                                            AS total_outstanding,
        COUNT(*)                                                                  AS invoice_count
      FROM (
        SELECT
          total_amount,
          EXTRACT(EPOCH FROM (NOW() - COALESCE(due_date, invoice_date))) / 86400 AS age_days
        FROM public.invoices
        WHERE LOWER(status) NOT IN ('paid', 'partially_paid')
          AND total_amount > 0
      ) sub
    `);

    const row = rows[0] ?? {};
    return NextResponse.json({
      ok: true,
      data: {
        current:      Number(Number(row.current_30   ?? 0).toFixed(2)),
        days30to60:   Number(Number(row.days_30_60   ?? 0).toFixed(2)),
        days60plus:   Number(Number(row.days_60_plus ?? 0).toFixed(2)),
        total:        Number(Number(row.total_outstanding ?? 0).toFixed(2)),
        invoiceCount: Number(row.invoice_count ?? 0),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load arrears";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
