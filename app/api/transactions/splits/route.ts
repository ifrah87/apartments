import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transaction_id");
    if (!transactionId) {
      return NextResponse.json({ ok: false, error: "transaction_id required" }, { status: 400 });
    }
    const { rows } = await query(
      `SELECT id, transaction_id, amount, account_code, tenant_id, property_id, unit_id, notes, sort_order, invoice_id
         FROM public.bank_transaction_splits
        WHERE transaction_id = $1
        ORDER BY sort_order, created_at`,
      [transactionId],
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
