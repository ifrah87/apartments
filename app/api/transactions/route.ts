import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { TxnDTO } from "@/src/types/transactions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status         = searchParams.get("status") ?? "UNREVIEWED";
    const start          = searchParams.get("start") ?? undefined;
    const end            = searchParams.get("end") ?? undefined;
    const accountId      = searchParams.get("account_id") ?? undefined;
    const bankAccountId  = searchParams.get("bank_account_id") ?? undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status !== "all") {
      params.push(status.toUpperCase());
      conditions.push(`status = $${params.length}`);
    }
    if (start) {
      params.push(start);
      conditions.push(`txn_date >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      conditions.push(`txn_date <= $${params.length}`);
    }
    if (accountId) {
      params.push(accountId);
      conditions.push(`account_id = $${params.length}`);
    }
    if (bankAccountId) {
      params.push(bankAccountId);
      // Also include unassigned transactions (bank_account_id IS NULL)
      conditions.push(`(bank_account_id = $${params.length} OR bank_account_id IS NULL)`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query<TxnDTO>(
      `SELECT
         id,
         txn_date                                    AS date,
         COALESCE(payee, particulars, '')            AS payee,
         particulars                                 AS raw_particulars,
         CASE WHEN deposit > 0 THEN deposit ELSE -withdrawal END AS amount,
         deposit,
         withdrawal,
         balance,
         ref                                         AS reference,
         transaction_number,
         COALESCE(source_bank, '')::text             AS source_bank,
         account_id,
         bank_account_id,
         category,
         status,
         tenant_id,
         property_id,
         unit_id,
         account_code,
         alloc_notes,
         created_at
       FROM public.bank_transactions
       ${where}
       ORDER BY txn_date DESC, created_at DESC`,
      params,
    );

    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load transactions";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
