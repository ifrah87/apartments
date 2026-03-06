import { NextRequest, NextResponse } from "next/server";
import { bankTransactionsRepo, RepoError } from "@/lib/repos";
import { normalizeId } from "@/lib/normalizeId";
import { isUuid } from "@/lib/isUuid";
import { query } from "@/lib/db";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start") ?? undefined;
    const end = searchParams.get("end") ?? undefined;
    const propertyId = searchParams.get("propertyId") ?? undefined;
    const tenantIdRaw = searchParams.get("tenantId"); // string | null

    const tenantIdNormalized =
      tenantIdRaw && tenantIdRaw.trim() !== ""
        ? normalizeId(tenantIdRaw)
        : undefined;

    if (tenantIdNormalized && !isUuid(tenantIdNormalized)) {
      return NextResponse.json({ ok: false, error: `Invalid tenant_id: ${tenantIdRaw}` }, { status: 400 });
    }

    const allocationParams: unknown[] = [];
    const allocationWhere: string[] = [];
    if (start) {
      allocationParams.push(start);
      allocationWhere.push(`bt.txn_date >= $${allocationParams.length}`);
    }
    if (end) {
      allocationParams.push(end);
      allocationWhere.push(`bt.txn_date <= $${allocationParams.length}`);
    }
    if (propertyId) {
      allocationParams.push(propertyId);
      allocationWhere.push(`u.property_id::text = $${allocationParams.length}::text`);
    }
    if (tenantIdNormalized) {
      allocationParams.push(tenantIdNormalized);
      allocationWhere.push(`i.tenant_id::text = $${allocationParams.length}::text`);
    }
    const allocationSql = `
      SELECT
        bt.txn_date::text AS date,
        COALESCE(bt.payee, bt.particulars, 'Bank payment') AS description,
        SUM(ba.allocated_amount)::numeric AS amount,
        'credit'::text AS type,
        u.property_id::text AS property_id,
        i.tenant_id::text AS tenant_id
      FROM public.bank_allocations ba
      JOIN public.bank_transactions bt ON bt.id = ba.transaction_id
      JOIN public.invoices i ON i.id::text = ba.invoice_id::text
      LEFT JOIN public.units u ON u.id::text = i.unit_id::text
      ${allocationWhere.length ? `WHERE ${allocationWhere.join(" AND ")}` : ""}
      GROUP BY bt.id, bt.txn_date, bt.payee, bt.particulars, u.property_id, i.tenant_id
      ORDER BY bt.txn_date DESC
    `;
    const allocationResult = await query<{
      date: string;
      description: string;
      amount: number;
      type: string;
      property_id: string | null;
      tenant_id: string | null;
    }>(allocationSql, allocationParams);

    let normalized = allocationResult.rows.map((row) => ({
      date: row.date,
      description: row.description,
      amount: Number(row.amount || 0),
      type: row.type,
      property_id: row.property_id ?? null,
      tenant_id: row.tenant_id ?? null,
    }));

    if (!normalized.length) {
      const transactions = await bankTransactionsRepo.listTransactions({
        start,
        end,
        propertyId,
        tenantId: tenantIdNormalized,
      });
      normalized = transactions.map((txn) => ({
        date: txn.date,
        description: txn.description,
        amount: txn.amount,
        type: txn.type ?? (txn.amount >= 0 ? "credit" : "debit"),
        property_id: txn.property_id ?? null,
        tenant_id: txn.tenant_id ?? null,
      }));
    }

    return NextResponse.json({ ok: true, data: normalized });
  } catch (err) {
    console.error("❌ /api/payments failed:", err);
    return handleError(err);
  }
}
