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
      WHERE COALESCE(bt.is_deleted, false) = false
        AND COALESCE(i.is_deleted, false) = false
        AND LOWER(COALESCE(i.status, '')) <> 'void'
      ${allocationWhere.length ? `AND ${allocationWhere.join(" AND ")}` : ""}
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

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => null)) as
      | {
          lease_id?: string | number | null;
          invoice_id?: string | number | null;
          tenant_id?: string | number | null;
          paid_on?: string | null;
          amount?: number | string | null;
          method?: string | null;
          reference?: string | null;
          bank_transaction_id?: string | null;
        }
      | null;

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payment payload." }, { status: 400 });
    }

    const leaseIdRaw = payload.lease_id;
    const invoiceIdRaw = payload.invoice_id;
    const tenantIdRaw = payload.tenant_id;
    const leaseId = leaseIdRaw === null || leaseIdRaw === undefined ? "" : String(leaseIdRaw).trim();
    const invoiceId = invoiceIdRaw === null || invoiceIdRaw === undefined ? "" : String(invoiceIdRaw).trim();
    const tenantIdInput = tenantIdRaw === null || tenantIdRaw === undefined ? "" : String(tenantIdRaw).trim();
    const bankTransactionId = String(payload.bank_transaction_id || "").trim() || null;
    const paymentDate = String(payload.paid_on || "").trim();
    const amount = Number(payload.amount ?? 0);
    const method = String(payload.method || "bank").trim() || "bank";
    const reference = String(payload.reference || "").trim() || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      return NextResponse.json({ ok: false, error: "paid_on is required in YYYY-MM-DD format." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "amount must be a positive number." }, { status: 400 });
    }
    if (leaseId && !isUuid(leaseId)) {
      return NextResponse.json({ ok: false, error: "lease_id must be a valid UUID when provided." }, { status: 400 });
    }
    if (bankTransactionId && !isUuid(bankTransactionId)) {
      return NextResponse.json({ ok: false, error: "bank_transaction_id must be a valid UUID." }, { status: 400 });
    }

    let resolvedInvoiceId = invoiceId;
    if (!resolvedInvoiceId && leaseId && isUuid(leaseId)) {
      const invoiceByLease = await query<{ id: string }>(
        `SELECT id
         FROM public.invoices
         WHERE lease_id::text = $1::text
           AND COALESCE(is_deleted, false) = false
           AND LOWER(COALESCE(status, '')) <> 'void'
         ORDER BY invoice_date DESC NULLS LAST, created_at DESC
         LIMIT 1`,
        [leaseId],
      );
      resolvedInvoiceId = String(invoiceByLease.rows[0]?.id || "");
    }
    if (!resolvedInvoiceId) {
      return NextResponse.json({ ok: false, error: "invoice_id is required (or resolvable from lease_id)." }, { status: 400 });
    }

    await query("BEGIN");

    const invoiceRes = await query<{
      id: string;
      lease_id: string | null;
      tenant_id: string | null;
      total_amount: number | null;
      amount_paid: number | null;
      status: string | null;
    }>(
      `SELECT id, lease_id, tenant_id, total_amount, amount_paid, status
       FROM public.invoices
       WHERE id::text = $1::text
         AND COALESCE(is_deleted, false) = false
         AND lower(COALESCE(status, '')) <> 'void'
       LIMIT 1`,
      [resolvedInvoiceId],
    );
    if (!invoiceRes.rows.length) {
      await query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
    }

    const invoice = invoiceRes.rows[0];
    const resolvedLeaseId = String(leaseId || invoice.lease_id || "").trim();
    const resolvedTenantId = normalizeId(tenantIdInput || String(invoice.tenant_id || ""));
    if (!resolvedLeaseId || !isUuid(resolvedLeaseId)) {
      await query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "A valid lease_id is required for payment linkage." }, { status: 400 });
    }
    if (!resolvedTenantId || !isUuid(resolvedTenantId)) {
      await query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "A valid tenant_id is required for payment linkage." }, { status: 400 });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO public.payments (lease_id, invoice_id, tenant_id, payment_date, amount, method, reference, bank_transaction_id, is_deleted, deleted_at)
       VALUES ($1::uuid, $2::text, $3::uuid, $4::date, $5::numeric, $6::text, $7::text, $8::uuid, false, NULL)
       RETURNING id`,
      [resolvedLeaseId, resolvedInvoiceId, resolvedTenantId, paymentDate, amount, method, reference, bankTransactionId],
    );

    const totalAmount = Number(invoice.total_amount || 0);
    const currentPaid = Number(invoice.amount_paid || 0);
    const nextPaid = Number(Math.min(totalAmount, currentPaid + amount).toFixed(2));
    const nextStatus =
      nextPaid <= 0 ? "unpaid" : nextPaid >= totalAmount - 0.01 ? "paid" : "partially_paid";
    await query(
      `UPDATE public.invoices
          SET amount_paid = $2,
              status = $3
        WHERE id::text = $1::text`,
      [resolvedInvoiceId, nextPaid, nextStatus],
    );

    await query("COMMIT");
    return NextResponse.json(
      {
        ok: true,
        data: {
          id: result.rows[0]?.id ?? null,
          invoice_id: resolvedInvoiceId,
          lease_id: resolvedLeaseId,
          tenant_id: resolvedTenantId,
          amount_paid: nextPaid,
          status: nextStatus,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    try {
      await query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    console.error("❌ /api/payments POST failed:", err);
    return handleError(err);
  }
}
