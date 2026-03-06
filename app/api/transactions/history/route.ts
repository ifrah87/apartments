import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

async function ensureReconciliationEventsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS public.bank_reconciliation_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
      action text NOT NULL,
      details jsonb,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transaction_id");
    if (!transactionId) {
      return NextResponse.json({ ok: false, error: "transaction_id is required" }, { status: 400 });
    }

    await ensureReconciliationEventsTable();

    const [allocRes, eventRes] = await Promise.all([
      query<{
        id: string;
        invoice_id: string;
        allocated_amount: number;
        created_by: string | null;
        created_at: string;
        invoice_number: string | null;
      }>(
        `SELECT
           ba.id,
           ba.invoice_id,
           ba.allocated_amount,
           ba.created_by,
           ba.created_at::text,
           i.invoice_number
         FROM public.bank_allocations ba
         LEFT JOIN public.invoices i ON i.id::text = ba.invoice_id::text
         WHERE ba.transaction_id = $1
         ORDER BY ba.created_at DESC`,
        [transactionId],
      ),
      query<{
        id: string;
        action: string;
        details: Record<string, unknown> | null;
        created_by: string | null;
        created_at: string;
      }>(
        `SELECT id, action, details, created_by, created_at::text
         FROM public.bank_reconciliation_events
         WHERE transaction_id = $1
         ORDER BY created_at DESC`,
        [transactionId],
      ),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        allocations: allocRes.rows,
        events: eventRes.rows,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load transaction history";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
