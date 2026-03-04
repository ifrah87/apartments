import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";

export const runtime = "nodejs";

type SplitPayload = {
  amount: number;
  account_code?: string | null;
  tenant_id?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
  notes?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    // ── Split mode ──────────────────────────────────────────────────────────
    if (Array.isArray(body.splits) && body.splits.length > 0) {
      const splits: SplitPayload[] = body.splits;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Remove old splits
        await client.query(
          "DELETE FROM public.bank_transaction_splits WHERE transaction_id = $1",
          [id],
        );

        // Insert new splits
        for (let i = 0; i < splits.length; i++) {
          const s = splits[i];
          await client.query(
            `INSERT INTO public.bank_transaction_splits
               (transaction_id, amount, account_code, tenant_id, property_id, unit_id, notes, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, s.amount, s.account_code ?? null, s.tenant_id ?? null,
             s.property_id ?? null, s.unit_id ?? null, s.notes ?? null, i],
          );
        }

        // Mark parent as REVIEWED; clear individual fields (detail lives in splits)
        await client.query(
          `UPDATE public.bank_transactions
              SET status       = 'REVIEWED',
                  account_code = NULL,
                  tenant_id    = NULL,
                  property_id  = NULL,
                  unit_id      = NULL,
                  alloc_notes  = $2
            WHERE id = $1`,
          [id, `Split: ${splits.length} line${splits.length !== 1 ? "s" : ""}`],
        );

        await client.query("COMMIT");
        return NextResponse.json({ ok: true, split: true, count: splits.length });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    // ── Single-line coding ───────────────────────────────────────────────────
    const { tenant_id, property_id, unit_id, account_code, notes } = body;
    const status = (body.status ?? "REVIEWED").toUpperCase();

    // Remove any existing splits when re-coding as single line
    await query("DELETE FROM public.bank_transaction_splits WHERE transaction_id = $1", [id]);

    const { rows } = await query(
      `UPDATE public.bank_transactions
          SET tenant_id    = $2,
              property_id  = $3,
              unit_id      = $4,
              account_code = $5,
              alloc_notes  = $6,
              status       = $7
        WHERE id = $1
        RETURNING
          id,
          txn_date AS date,
          CASE WHEN deposit > 0 THEN deposit ELSE -withdrawal END AS amount,
          payee, particulars, status,
          tenant_id, property_id, unit_id, account_code, alloc_notes`,
      [id, tenant_id ?? null, property_id ?? null, unit_id ?? null,
       account_code ?? null, notes ?? null, status],
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
