import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/transactions/allocate
 *
 * Body:
 *   {
 *     id:           string   — bank_transactions.id (required)
 *     tenant_id?:   string
 *     property_id?: string
 *     unit_id?:     string
 *     account_code?: string  — e.g. "4000-rent", "5100-utilities"
 *     notes?:       string
 *     status?:      "REVIEWED" | "RECONCILED"  (default: "REVIEWED")
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, tenant_id, property_id, unit_id, account_code, notes } = body;
    const status = (body.status ?? "REVIEWED").toUpperCase();

    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const { rows } = await query(
      `UPDATE public.bank_transactions
         SET tenant_id    = COALESCE($2, tenant_id),
             property_id  = COALESCE($3, property_id),
             unit_id      = COALESCE($4, unit_id),
             account_code = COALESCE($5, account_code),
             alloc_notes  = COALESCE($6, alloc_notes),
             status       = $7
         WHERE id = $1
         RETURNING
           id,
           txn_date AS date,
           CASE WHEN deposit > 0 THEN deposit ELSE -withdrawal END AS amount,
           payee,
           particulars,
           status,
           tenant_id,
           property_id,
           unit_id,
           account_code,
           alloc_notes`,
      [id, tenant_id ?? null, property_id ?? null, unit_id ?? null, account_code ?? null, notes ?? null, status],
    );

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to allocate transaction";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
