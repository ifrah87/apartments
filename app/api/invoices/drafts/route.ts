import { NextResponse } from "next/server";
import crypto from "crypto";
import { readJsonFile, updateJsonFile } from "@/lib/storage/jsonStore";

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

type InvoiceDraft = {
  id: string;
  tenantId: string;
  period: string;
  lineItems: DraftLineItem[];
  notes?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  reference?: string;
  currency?: string;
  createdAt: string;
  updatedAt: string;
};

const DRAFTS_FILE = "invoice_drafts.json";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const period = searchParams.get("period");
  if (!tenantId || !period) {
    return NextResponse.json({ ok: false, error: "Missing tenantId or period." }, { status: 400 });
  }

  const drafts = await readJsonFile<InvoiceDraft[]>(DRAFTS_FILE, []);
  const draft = drafts.find((item) => item.tenantId === tenantId && item.period === period) || null;
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

    const now = new Date().toISOString();
    let saved: InvoiceDraft | null = null;

    await updateJsonFile<InvoiceDraft[]>(
      DRAFTS_FILE,
      (items) => {
        const idx = items.findIndex((item) => item.tenantId === payload.tenantId && item.period === payload.period);
        if (idx >= 0) {
          const next = {
            ...items[idx],
            lineItems: payload.lineItems || [],
            notes: payload.notes,
            invoiceNumber: payload.invoiceNumber ?? items[idx].invoiceNumber,
            issueDate: payload.issueDate ?? items[idx].issueDate,
            dueDate: payload.dueDate ?? items[idx].dueDate,
            reference: payload.reference ?? items[idx].reference,
            currency: payload.currency ?? items[idx].currency,
            updatedAt: now,
          };
          items[idx] = next;
          saved = next;
          return [...items];
        }
        const next: InvoiceDraft = {
          id: crypto.randomUUID(),
          tenantId: payload.tenantId,
          period: payload.period,
          lineItems: payload.lineItems || [],
          notes: payload.notes,
          invoiceNumber: payload.invoiceNumber,
          issueDate: payload.issueDate,
          dueDate: payload.dueDate,
          reference: payload.reference,
          currency: payload.currency,
          createdAt: now,
          updatedAt: now,
        };
        saved = next;
        return [...items, next];
      },
      [],
    );

    return NextResponse.json({ ok: true, draft: saved });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to save draft." }, { status: 500 });
  }
}
