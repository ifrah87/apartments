import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { TxnDTO } from "@/src/types/transactions";

export const runtime = "nodejs";

async function ensureBankAllocationsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS public.bank_allocations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
      invoice_id text NOT NULL,
      allocated_amount numeric(12,2) NOT NULL CHECK (allocated_amount > 0),
      match_score numeric(5,4),
      match_reason text,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (transaction_id, invoice_id)
    )`,
  );
}

export async function GET(req: NextRequest) {
  try {
    await ensureBankAllocationsTable();

    const { searchParams } = new URL(req.url);
    const status         = searchParams.get("status") ?? "UNREVIEWED";
    const start          = searchParams.get("start") ?? undefined;
    const end            = searchParams.get("end") ?? undefined;
    const accountId      = searchParams.get("account_id") ?? undefined;
    const bankAccountId  = searchParams.get("bank_account_id") ?? undefined;
    const rawLimit       = Number(searchParams.get("limit") ?? "500");
    const limit          = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 2000) : 500;

    const conditions: string[] = ["COALESCE(bt.is_deleted, false) = false"];
    const params: unknown[] = [];

    if (start) {
      params.push(start);
      conditions.push(`bt.txn_date >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      conditions.push(`bt.txn_date <= $${params.length}`);
    }
    if (accountId) {
      params.push(accountId);
      conditions.push(`bt.account_id = $${params.length}`);
    }
    if (bankAccountId) {
      params.push(bankAccountId);
      // Also include unassigned transactions (bank_account_id IS NULL)
      conditions.push(`(bt.bank_account_id = $${params.length} OR bt.bank_account_id IS NULL)`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query<TxnDTO>(
      `SELECT
         bt.id,
         bt.txn_date                                 AS date,
         COALESCE(bt.payee, bt.particulars, '')      AS payee,
         bt.particulars                              AS raw_particulars,
         CASE WHEN bt.deposit > 0 THEN bt.deposit ELSE -bt.withdrawal END AS amount,
         bt.deposit,
         bt.withdrawal,
         bt.balance,
         bt.ref                                      AS reference,
         bt.transaction_number,
         COALESCE(bt.source_bank, '')::text          AS source_bank,
         bt.account_id,
         bt.bank_account_id,
         bt.category,
         CASE
           WHEN COALESCE(alloc.total_allocated, 0) >= ABS(CASE WHEN bt.deposit > 0 THEN bt.deposit ELSE bt.withdrawal END) - 0.01
                AND COALESCE(alloc.total_allocated, 0) > 0
             THEN 'RECONCILED'
           WHEN COALESCE(alloc.total_allocated, 0) > 0
             THEN 'REVIEWED'
           ELSE bt.status
         END                                         AS status,
         bt.tenant_id,
         bt.property_id,
         bt.unit_id,
         bt.account_code,
         bt.alloc_notes,
         bt.created_at
       FROM public.bank_transactions bt
       LEFT JOIN (
         SELECT
           transaction_id,
           SUM(allocated_amount) AS total_allocated
         FROM public.bank_allocations
         GROUP BY transaction_id
       ) alloc ON alloc.transaction_id = bt.id
       ${where}
       ORDER BY bt.txn_date DESC, bt.created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );

    const requestedStatus = status.toUpperCase();
    const filteredRows =
      requestedStatus === "ALL"
        ? rows
        : rows.filter((row) => String(row.status || "").toUpperCase() === requestedStatus);

    return NextResponse.json({ ok: true, data: filteredRows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load transactions";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
