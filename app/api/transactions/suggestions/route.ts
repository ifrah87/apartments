import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type TxnRow = {
  id: string;
  txn_date: string;
  payee: string | null;
  tenant_id: string | null;
  unit_id: string | null;
  amount_abs: number;
};

type InvoiceCandidate = {
  id: string;
  period: string | null;
  invoice_number: string | null;
  tenant_id: string | null;
  unit_id: string | null;
  status: string | null;
  total_amount: number;
  amount_paid: number;
  invoice_date: string | null;
  tenant_name: string | null;
};

function normalizedText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function scoreCandidate(txn: TxnRow, invoice: InvoiceCandidate) {
  const reasons: string[] = [];
  const txnAmount = Math.abs(toNumber(txn.amount_abs));
  const outstanding = Math.max(0, toNumber(invoice.total_amount) - toNumber(invoice.amount_paid));
  const diff = Math.abs(txnAmount - outstanding);
  let score = 0;

  if (diff <= 0.01) {
    score += 0.6;
    reasons.push("Exact amount match");
  } else if (diff <= 5) {
    score += 0.4;
    reasons.push("Near amount match");
  } else if (diff <= 25) {
    score += 0.2;
    reasons.push("Close amount");
  }

  if (txn.unit_id && invoice.unit_id && txn.unit_id === invoice.unit_id) {
    score += 0.2;
    reasons.push("Same unit");
  }

  if (txn.tenant_id && invoice.tenant_id && txn.tenant_id === invoice.tenant_id) {
    score += 0.15;
    reasons.push("Same tenant");
  }

  const payee = normalizedText(txn.payee);
  const tenantName = normalizedText(invoice.tenant_name);
  if (payee && tenantName && (payee.includes(tenantName) || tenantName.includes(payee))) {
    score += 0.1;
    reasons.push("Payee name similarity");
  }

  if (txn.txn_date && invoice.invoice_date) {
    const txnDate = new Date(txn.txn_date);
    const invDate = new Date(invoice.invoice_date);
    const days = Math.abs((txnDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isFinite(days) && days <= 45) {
      score += 0.05;
      reasons.push("Close invoice date");
    }
  }

  return {
    score: Math.min(1, Number(score.toFixed(4))),
    reasons,
    outstanding,
    diff,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transaction_id");
    if (!transactionId) {
      return NextResponse.json({ ok: false, error: "transaction_id is required" }, { status: 400 });
    }

    const txnResult = await query<TxnRow>(
      `SELECT
         id,
         txn_date,
         payee,
         tenant_id,
         unit_id,
         CASE WHEN deposit > 0 THEN deposit ELSE withdrawal END AS amount_abs
       FROM public.bank_transactions
       WHERE id = $1`,
      [transactionId],
    );
    const txn = txnResult.rows[0];
    if (!txn) {
      return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 });
    }

    const payee = normalizedText(txn.payee);
    const likePattern = `%${payee}%`;
    const candidatesResult = await query<InvoiceCandidate>(
      `SELECT
         i.id,
         i.period,
         i.invoice_number,
         i.tenant_id,
         i.unit_id,
         i.status,
         COALESCE(i.total_amount, 0)::numeric AS total_amount,
         COALESCE(i.amount_paid, 0)::numeric AS amount_paid,
         i.invoice_date::text AS invoice_date,
         t.name AS tenant_name
       FROM public.invoices i
       LEFT JOIN public.tenants t ON t.id::text = i.tenant_id::text
       WHERE
         i.status IN ('unpaid', 'partially_paid', 'UNPAID', 'PARTIALLY_PAID')
         AND (
           ($1::text IS NOT NULL AND i.unit_id::text = $1::text)
           OR ($2::text IS NOT NULL AND i.tenant_id::text = $2::text)
           OR ($3::text <> '' AND LOWER(COALESCE(t.name, '')) LIKE $4)
         )
       ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC NULLS LAST
       LIMIT 30`,
      [txn.unit_id, txn.tenant_id, payee, likePattern],
    );

    const suggestions = candidatesResult.rows
      .map((invoice) => {
        const scored = scoreCandidate(txn, invoice);
        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number ?? null,
          period: invoice.period ?? null,
          tenantId: invoice.tenant_id ?? null,
          unitId: invoice.unit_id ?? null,
          tenantName: invoice.tenant_name ?? null,
          status: invoice.status ?? null,
          total: toNumber(invoice.total_amount),
          amountPaid: toNumber(invoice.amount_paid),
          outstanding: scored.outstanding,
          score: scored.score,
          reasonSummary: scored.reasons.join(", "),
        };
      })
      .filter((row) => row.score >= 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json({ ok: true, data: suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build suggestions";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
