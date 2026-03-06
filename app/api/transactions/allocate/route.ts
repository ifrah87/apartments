import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { getAuthSecret, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

type SplitPayload = {
  amount: number;
  account_code?: string | null;
  tenant_id?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
  notes?: string | null;
  invoice_id?: string | null;
};

async function ensureBankAllocationsTable(run: (sql: string, params?: any[]) => Promise<any>) {
  await run(
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
  await run(
    `CREATE INDEX IF NOT EXISTS bank_allocations_transaction_idx
       ON public.bank_allocations(transaction_id)`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS bank_allocations_invoice_idx
       ON public.bank_allocations(invoice_id)`,
  );
}

async function ensureReconciliationEventsTable(run: (sql: string, params?: any[]) => Promise<any>) {
  await run(
    `CREATE TABLE IF NOT EXISTS public.bank_reconciliation_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
      action text NOT NULL,
      details jsonb,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS bank_reconciliation_events_txn_idx
       ON public.bank_reconciliation_events(transaction_id, created_at DESC)`,
  );
}

async function resolveActor(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token, getAuthSecret());
    return session?.sub ?? null;
  } catch {
    return null;
  }
}

async function recordReconciliationEvent(
  run: (sql: string, params?: any[]) => Promise<any>,
  input: { transactionId: string; action: string; details?: Record<string, unknown>; actorId?: string | null },
) {
  await run(
    `INSERT INTO public.bank_reconciliation_events (transaction_id, action, details, created_by)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [input.transactionId, input.action, JSON.stringify(input.details ?? {}), input.actorId ?? null],
  );
}

async function sumAllocatedForTransaction(id: string) {
  const { rows } = await query<{ allocated: number; txn_amount: number }>(
    `SELECT
       COALESCE((SELECT SUM(allocated_amount) FROM public.bank_allocations WHERE transaction_id = $1), 0) AS allocated,
       COALESCE((SELECT CASE WHEN deposit > 0 THEN deposit ELSE withdrawal END FROM public.bank_transactions WHERE id = $1), 0) AS txn_amount`,
    [id],
  );
  const allocated = Number(rows[0]?.allocated || 0);
  const txnAmount = Number(rows[0]?.txn_amount || 0);
  return { allocated, txnAmount };
}

async function syncInvoiceBalance(
  run: (sql: string, params?: any[]) => Promise<any>,
  invoiceId: string,
) {
  const { rows } = await run(
    `SELECT COALESCE(SUM(allocated_amount), 0) AS paid
     FROM public.bank_allocations
     WHERE invoice_id = $1`,
    [invoiceId],
  );
  const paid = Number(rows[0]?.paid || 0);
  await run(
    `UPDATE public.invoices
        SET amount_paid = LEAST(COALESCE(total_amount, 0), $2),
            status = CASE
              WHEN $2 <= 0 THEN 'unpaid'
              WHEN $2 >= COALESCE(total_amount, 0) - 0.01 THEN 'paid'
              ELSE 'partially_paid'
            END
      WHERE id::text = $1::text`,
    [invoiceId, paid],
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    await ensureBankAllocationsTable(query);
    await ensureReconciliationEventsTable(query);
    const actorId = await resolveActor(req);

    const { rows: statusRows } = await query<{ status: string; allocation_amount: number }>(
      `SELECT
         status,
         CASE WHEN deposit > 0 THEN deposit ELSE withdrawal END AS allocation_amount
       FROM public.bank_transactions
       WHERE id = $1`,
      [id],
    );
    if (!statusRows.length) {
      return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 });
    }

    const currentStatus = String(statusRows[0].status ?? "").toUpperCase();
    const defaultAllocationAmount = Number(statusRows[0].allocation_amount || 0);
    const requestedStatus = String(body.status ?? "REVIEWED").toUpperCase();
    const isExplicitUncode =
      requestedStatus === "UNREVIEWED" &&
      !Array.isArray(body.splits) &&
      (body.tenant_id == null || body.tenant_id === "") &&
      (body.property_id == null || body.property_id === "") &&
      (body.unit_id == null || body.unit_id === "") &&
      (body.account_code == null || body.account_code === "") &&
      (body.notes == null || body.notes === "");

    const { allocated, txnAmount } = await sumAllocatedForTransaction(String(id));
    const isFullyAllocated = allocated > 0 && allocated >= Math.max(0, txnAmount - 0.01);
    if ((currentStatus === "CODED" || isFullyAllocated) && !isExplicitUncode) {
      return NextResponse.json(
        { ok: false, error: "Transaction is reconciled. Mark it unreconciled first before making changes." },
        { status: 409 },
      );
    }

    // ── Split mode ──────────────────────────────────────────────────────────
    if (Array.isArray(body.splits) && body.splits.length > 0) {
      const splits: SplitPayload[] = body.splits;
      const client = await pool.connect();
      try {
        await ensureBankAllocationsTable((sql, params) => client.query(sql, params));
        await ensureReconciliationEventsTable((sql, params) => client.query(sql, params));
        await client.query("BEGIN");
        const affectedInvoiceIds = new Set<string>();

        const oldInvoiceRows = await client.query<{ invoice_id: string }>(
          `SELECT DISTINCT invoice_id
           FROM public.bank_allocations
           WHERE transaction_id = $1
             AND invoice_id IS NOT NULL`,
          [id],
        );
        oldInvoiceRows.rows.forEach((row) => {
          if (row.invoice_id) affectedInvoiceIds.add(String(row.invoice_id));
        });

        // Remove old splits
        await client.query(
          "DELETE FROM public.bank_transaction_splits WHERE transaction_id = $1",
          [id],
        );
        await client.query("DELETE FROM public.bank_allocations WHERE transaction_id = $1", [id]);

        // Insert new splits
        for (let i = 0; i < splits.length; i++) {
          const s = splits[i];
          const amount = Number(s.amount || 0);
          await client.query(
            `INSERT INTO public.bank_transaction_splits
               (transaction_id, amount, account_code, tenant_id, property_id, unit_id, notes, sort_order, invoice_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, amount, s.account_code ?? null, s.tenant_id ?? null,
             s.property_id ?? null, s.unit_id ?? null, s.notes ?? null, i, s.invoice_id ?? null],
          );
          if (s.invoice_id && amount > 0) {
            affectedInvoiceIds.add(String(s.invoice_id));
            await client.query(
              `INSERT INTO public.bank_allocations (transaction_id, invoice_id, allocated_amount, created_by)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (transaction_id, invoice_id)
               DO UPDATE SET allocated_amount = EXCLUDED.allocated_amount`,
              [id, s.invoice_id, amount, actorId],
            );
          }
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

        for (const invoiceId of affectedInvoiceIds) {
          await syncInvoiceBalance((sql, params) => client.query(sql, params), invoiceId);
        }
        await recordReconciliationEvent(
          (sql, params) => client.query(sql, params),
          {
            transactionId: String(id),
            action: "split_allocation_saved",
            details: {
              split_count: splits.length,
              invoices: splits.map((line) => ({ invoice_id: line.invoice_id ?? null, amount: Number(line.amount || 0) })),
            },
            actorId,
          },
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
    const { tenant_id, property_id, unit_id, account_code, notes, invoice_id } = body;
    const status = requestedStatus;
    const affectedInvoiceIds = new Set<string>();

    const oldInvoiceRows = await query<{ invoice_id: string }>(
      `SELECT DISTINCT invoice_id
       FROM public.bank_allocations
       WHERE transaction_id = $1
         AND invoice_id IS NOT NULL`,
      [id],
    );
    oldInvoiceRows.rows.forEach((row) => {
      if (row.invoice_id) affectedInvoiceIds.add(String(row.invoice_id));
    });

    // Remove any existing splits when re-coding as single line
    await query("DELETE FROM public.bank_transaction_splits WHERE transaction_id = $1", [id]);
    await query("DELETE FROM public.bank_allocations WHERE transaction_id = $1", [id]);
    if (invoice_id && defaultAllocationAmount > 0) {
      affectedInvoiceIds.add(String(invoice_id));
      await query(
        `INSERT INTO public.bank_allocations (transaction_id, invoice_id, allocated_amount, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (transaction_id, invoice_id)
         DO UPDATE SET allocated_amount = EXCLUDED.allocated_amount`,
        [id, invoice_id, defaultAllocationAmount, actorId],
      );
    }
    for (const linkedInvoiceId of affectedInvoiceIds) {
      await syncInvoiceBalance(query, linkedInvoiceId);
    }

    const { rows } = await query(
      `UPDATE public.bank_transactions
          SET tenant_id    = $2,
              property_id  = $3,
              unit_id      = $4,
              account_code = $5,
              alloc_notes  = $6,
              status       = $7,
              invoice_id   = $8
        WHERE id = $1
        RETURNING
          id,
          txn_date AS date,
          CASE WHEN deposit > 0 THEN deposit ELSE -withdrawal END AS amount,
          payee, particulars, status,
          tenant_id, property_id, unit_id, account_code, alloc_notes, invoice_id`,
      [id, tenant_id ?? null, property_id ?? null, unit_id ?? null,
       account_code ?? null, notes ?? null, status, invoice_id ?? null],
    );

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 });
    }
    await recordReconciliationEvent(query, {
      transactionId: String(id),
      action: isExplicitUncode
        ? "marked_unreconciled"
        : invoice_id
          ? "invoice_allocation_saved"
          : "coding_saved",
      details: {
        invoice_id: invoice_id ?? null,
        status,
      },
      actorId,
    });
    return NextResponse.json({ ok: true, data: rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to allocate transaction";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
