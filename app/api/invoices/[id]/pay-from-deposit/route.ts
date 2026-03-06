import { NextRequest, NextResponse } from "next/server";
import { datasetsRepo } from "@/lib/repos";
import { normalizeId } from "@/lib/normalizeId";

type RouteParams = Promise<{ id: string }>;

const INVOICES_KEY = "billing_invoices";
const DEPOSIT_TXN_KEY = "deposit_transactions";

function toNumber(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : fallback;
}

export async function POST(req: NextRequest, context: { params: RouteParams }) {
  const { id } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));

    // Load invoices dataset
    const invoices = await datasetsRepo.getDataset<any[]>(INVOICES_KEY, []);
    if (!Array.isArray(invoices)) {
      return NextResponse.json({ ok: false, error: "Invoice store unavailable." }, { status: 500 });
    }

    const invoice = invoices.find((inv) => inv?.id === id);
    if (!invoice) {
      return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
    }

    const tenantId = normalizeId(invoice.tenantId ?? invoice.tenant_id ?? "");
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Invoice has no tenant." }, { status: 400 });
    }

    // Amount to deduct: caller can pass explicit amount, else defaults to invoice total
    const invoiceTotal = toNumber(invoice.total ?? invoice.totalAmount);
    const deductAmount = toNumber(body?.amount, invoiceTotal);
    if (deductAmount <= 0) {
      return NextResponse.json({ ok: false, error: "Deduction amount must be positive." }, { status: 400 });
    }

    const period: string = String(invoice.period ?? invoice.billingPeriod ?? invoice.invoiceDate ?? "").trim();
    const today = new Date().toISOString().slice(0, 10);
    const noteDate = today;
    const note = period
      ? `Rent applied from security deposit — ${period}`
      : "Rent applied from security deposit";

    // 1. Mark invoice as Paid
    await datasetsRepo.updateDataset<any[]>(
      INVOICES_KEY,
      (current) =>
        Array.isArray(current)
          ? current.map((item) =>
              item?.id === id ? { ...item, status: "Paid", payment_method: "deposit" } : item,
            )
          : [],
      [],
    );

    // 2. Append a deposit deduction transaction
    await datasetsRepo.updateDataset<any[]>(
      DEPOSIT_TXN_KEY,
      (current) => {
        const base = Array.isArray(current) ? current : [];
        return [
          ...base,
          {
            tenant_id: tenantId,
            date: noteDate,
            type: "deduction",
            amount: deductAmount,
            note,
            invoice_id: id,
          },
        ];
      },
      [],
    );

    return NextResponse.json({
      ok: true,
      data: { invoiceId: id, tenantId, deducted: deductAmount, note },
    });
  } catch (err) {
    console.error("Failed to allocate deposit payment", err);
    const msg = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
