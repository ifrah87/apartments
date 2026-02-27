import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { datasetsRepo } from "@/lib/repos";
import type { InvoiceLineItem, MeterSnapshot } from "@/lib/invoices/types";

type ParamsMaybePromise = { id: string } | Promise<{ id: string }>;

const INVOICES_KEY = "billing_invoices";

function toNumber(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : fallback;
}

function normalizeLineItems(input: unknown): InvoiceLineItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const description = String((item as any)?.description ?? "").trim();
      const qty = toNumber((item as any)?.qty);
      const rate = toNumber((item as any)?.rate);
      const amount = Number((qty * rate).toFixed(2));
      const id = String((item as any)?.id ?? "");
      return {
        id: id || `line-${Math.random().toString(36).slice(2)}`,
        description,
        qty,
        rate,
        amount,
      };
    })
    .filter((item) => item.description && item.qty >= 0);
}

function normalizeMeterSnapshot(input: unknown): MeterSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const snap = input as any;
  const prevReading = toNumber(snap.prevReading);
  const currReading = toNumber(snap.currReading);
  const usage = Number(Math.max(currReading - prevReading, 0).toFixed(2));
  const rate = toNumber(snap.rate, 0.41);
  const amount = Number((usage * rate).toFixed(2));
  return {
    prevDate: String(snap.prevDate ?? ""),
    prevReading,
    currDate: String(snap.currDate ?? ""),
    currReading,
    usage,
    rate,
    amount,
    unitLabel: snap.unitLabel ? String(snap.unitLabel) : "kWh",
  };
}

export async function GET(_req: NextRequest, context: { params: ParamsMaybePromise }) {
  const { id } = await Promise.resolve(context.params);
  const { rows } = await query(
    `SELECT id, line_items, meter_snapshot, total_amount
     FROM public.invoices
     WHERE id = $1`,
    [id],
  );
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: rows[0] });
}

export async function PATCH(req: NextRequest, context: { params: ParamsMaybePromise }) {
  const { id } = await Promise.resolve(context.params);
  try {
    const body = await req.json();
    const lineItems = normalizeLineItems(body?.lineItems);
    let meterSnapshot = normalizeMeterSnapshot(body?.meterSnapshot);

    if (meterSnapshot) {
      const electricityIndex = lineItems.findIndex((item) =>
        item.description.toLowerCase().includes("electric"),
      );
      const electricityItem: InvoiceLineItem = {
        id: electricityIndex >= 0 ? lineItems[electricityIndex].id : `line-${Math.random().toString(36).slice(2)}`,
        description: "Electricity",
        qty: meterSnapshot.usage,
        rate: meterSnapshot.rate,
        amount: meterSnapshot.amount,
      };
      if (electricityIndex >= 0) {
        lineItems[electricityIndex] = electricityItem;
      } else {
        lineItems.push(electricityItem);
      }
    }

    const totalAmount = Number(lineItems.reduce((sum, item) => sum + toNumber(item.amount), 0).toFixed(2));

    await query(
      `UPDATE public.invoices
       SET line_items = $1,
           meter_snapshot = $2,
           total_amount = $3
       WHERE id = $4`,
      [lineItems, meterSnapshot, totalAmount, id],
    );

    await datasetsRepo.updateDataset<any[]>(
      INVOICES_KEY,
      (current) =>
        Array.isArray(current)
          ? current.map((item) =>
              item?.id === id ? { ...item, total: totalAmount, outstanding: totalAmount } : item,
            )
          : [],
      [],
    );

    return NextResponse.json({ ok: true, data: { id, line_items: lineItems, meter_snapshot: meterSnapshot, total_amount: totalAmount } });
  } catch (err: any) {
    console.error("Failed to update invoice line items", err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed to update invoice." }, { status: 500 });
  }
}
