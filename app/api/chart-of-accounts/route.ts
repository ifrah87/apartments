import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT code, name, category, sub_type, sort_order
       FROM public.chart_of_accounts
       WHERE active = TRUE
       ORDER BY sort_order ASC`,
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load chart of accounts";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
