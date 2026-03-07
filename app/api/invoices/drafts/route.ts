import { NextResponse } from "next/server";
import { getInvoiceDraft, saveInvoiceDraft } from "@/src/modules/billing/repository";

export const runtime = "nodejs";

type DraftLineItem = {
  itemCode?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  account?: string;
  taxRate?: string;
  taxAmount?: number;
  region?: string;
  project?: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const period = searchParams.get("period");
  if (!tenantId || !period) {
    return NextResponse.json({ ok: false, error: "Missing tenantId or period." }, { status: 400 });
  }

  const draft = await getInvoiceDraft(tenantId, period);
  return NextResponse.json({ ok: true, draft });
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      tenantId: string;
      period: string;
      lineItems: DraftLineItem[];
      notes?: string;
      invoiceNumber?: string;
      issueDate?: string;
      dueDate?: string;
      reference?: string;
      currency?: string;
    };

    if (!payload?.tenantId || !payload?.period) {
      return NextResponse.json({ ok: false, error: "Missing tenantId or period." }, { status: 400 });
    }

    const saved = await saveInvoiceDraft({
      tenantId: payload.tenantId,
      period: payload.period,
      lineItems: payload.lineItems || [],
      notes: payload.notes,
      invoiceNumber: payload.invoiceNumber,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      reference: payload.reference,
      currency: payload.currency,
    });

    return NextResponse.json({ ok: true, draft: saved });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to save draft." }, { status: 500 });
  }
}
