import { NextRequest, NextResponse } from "next/server";
import { normalizeId } from "@/lib/normalizeId";
import { query } from "@/lib/db";

type RouteParams = Promise<{ id: string }>;

function toNumber(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : fallback;
}

export async function POST(req: NextRequest, context: { params: RouteParams }) {
  const { id } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));

    const invoiceRes = await query<{
      id: string;
      tenant_id: string | null;
      total_amount: number | null;
      amount_paid: number | null;
      status: string | null;
    }>(
      `SELECT id, tenant_id, total_amount, amount_paid, status
       FROM public.invoices
       WHERE id = $1
         AND COALESCE(is_deleted, false) = false
         AND lower(COALESCE(status, '')) <> 'void'
       LIMIT 1`,
      [id],
    );
    if (!invoiceRes.rows.length) {
      return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
    }
    const invoice = invoiceRes.rows[0];
    const tenantId = normalizeId(invoice.tenant_id ?? "");
    const invoiceTotal = toNumber(invoice.total_amount ?? 0);
    const currentPaid = toNumber(invoice.amount_paid ?? 0);
    const remaining = Math.max(0, invoiceTotal - currentPaid);
    const deductAmount = toNumber(body?.amount, remaining);
    if (deductAmount <= 0) {
      return NextResponse.json({ ok: false, error: "Deduction amount must be positive." }, { status: 400 });
    }
    if (deductAmount > remaining + 0.01) {
      return NextResponse.json({ ok: false, error: "Deduction exceeds outstanding invoice balance." }, { status: 400 });
    }

    const period: string = String(body?.period ?? "").trim();
    const today = new Date().toISOString().slice(0, 10);
    const noteDate = today;
    const note = period
      ? `Rent applied from security deposit — ${period}`
      : "Rent applied from security deposit";

    const nextPaid = Number(Math.min(invoiceTotal, currentPaid + deductAmount).toFixed(2));
    const nextStatus =
      nextPaid <= 0 ? "unpaid" : nextPaid >= invoiceTotal - 0.01 ? "paid" : "partially_paid";

    await query(
      `UPDATE public.invoices
          SET amount_paid = $2,
              status = $3
        WHERE id = $1`,
      [id, nextPaid, nextStatus],
    );

    return NextResponse.json({
      ok: true,
      data: {
        invoiceId: id,
        tenantId,
        deducted: deductAmount,
        amount_paid: nextPaid,
        outstanding: Number(Math.max(0, invoiceTotal - nextPaid).toFixed(2)),
        status: nextStatus,
        note,
      },
    });
  } catch (err) {
    console.error("Failed to allocate deposit payment", err);
    const msg = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
