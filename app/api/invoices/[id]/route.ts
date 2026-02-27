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

function toCents(value: number) {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(value: number | null | undefined) {
  return Number(((value ?? 0) / 100).toFixed(2));
}

type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  line_index: number;
  description: string;
  quantity: number;
  unit_price_cents: number;
  tax_cents: number;
  total_cents: number;
  meta: Record<string, any> | null;
  created_at?: string;
};

function normalizeLineItems(input: unknown): InvoiceLineItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const description = String((item as any)?.description ?? "").trim();
      const qty = toNumber((item as any)?.qty);
      const rate = toNumber((item as any)?.rate);
      const amount = Number((qty * rate).toFixed(2));
      const id = String((item as any)?.id ?? "");
      const meta = (item as any)?.meta && typeof (item as any).meta === "object" ? (item as any).meta : undefined;
      return {
        id: id || `line-${Math.random().toString(36).slice(2)}`,
        description,
        qty,
        rate,
        amount,
        meta,
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

function applyMeterSnapshot(lineItems: InvoiceLineItem[], meterSnapshot: MeterSnapshot | null) {
  if (!meterSnapshot) return lineItems;
  const next = [...lineItems];
  const electricityIndex = next.findIndex((item) =>
    item.description.toLowerCase().includes("electric"),
  );
  const electricityItem: InvoiceLineItem = {
    id: electricityIndex >= 0 ? next[electricityIndex].id : `line-${Math.random().toString(36).slice(2)}`,
    description: "Electricity",
    qty: meterSnapshot.usage,
    rate: meterSnapshot.rate,
    amount: meterSnapshot.amount,
    meta: {
      kind: "utility",
      meterType: "electricity",
      prevDate: meterSnapshot.prevDate,
      prevValue: meterSnapshot.prevReading,
      currentDate: meterSnapshot.currDate,
      currentValue: meterSnapshot.currReading,
      usage: meterSnapshot.usage,
      rate: meterSnapshot.rate,
      unitLabel: meterSnapshot.unitLabel || "kWh",
    },
  };
  if (electricityIndex >= 0) {
    next[electricityIndex] = electricityItem;
  } else {
    next.push(electricityItem);
  }
  return next;
}

function mapInvoiceLines(rows: InvoiceLineRow[]): InvoiceLineItem[] {
  return rows.map((row) => ({
    id: String(row.id),
    description: String(row.description || ""),
    qty: Number(row.quantity || 0),
    rate: fromCents(row.unit_price_cents),
    amount: fromCents(row.total_cents),
    meta: row.meta ?? undefined,
  }));
}

function extractMeterSnapshot(rows: InvoiceLineRow[]): MeterSnapshot | null {
  for (const row of rows) {
    const meta = row.meta;
    if (!meta || typeof meta !== "object") continue;
    if (String(meta.kind || "").toLowerCase() !== "utility") continue;
    if (String(meta.meterType || "").toLowerCase() !== "electricity") continue;
    const usage = toNumber(meta.usage ?? row.quantity);
    const rate = toNumber(meta.rate, fromCents(row.unit_price_cents));
    const amount = toNumber(meta.amount ?? usage * rate);
    return {
      prevDate: String(meta.prevDate ?? ""),
      prevReading: toNumber(meta.prevValue),
      currDate: String(meta.currentDate ?? ""),
      currReading: toNumber(meta.currentValue),
      usage,
      rate,
      amount,
      unitLabel: meta.unitLabel ? String(meta.unitLabel) : "kWh",
    };
  }
  return null;
}

export async function GET(_req: NextRequest, context: { params: ParamsMaybePromise }) {
  const { id } = await Promise.resolve(context.params);
  const invoiceRes = await query(
    `SELECT id, tenant_id, unit_id, invoice_number, invoice_date, due_date, status, currency, notes, meta
     FROM public.invoices
     WHERE id = $1`,
    [id],
  );
  if (!invoiceRes.rows.length) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }
  const lineRes = await query(
    `SELECT id, invoice_id, line_index, description, quantity, unit_price_cents, tax_cents, total_cents, meta, created_at
     FROM public.invoice_lines
     WHERE invoice_id = $1
     ORDER BY line_index ASC, created_at ASC`,
    [id],
  );
  const lineRows = lineRes.rows as InvoiceLineRow[];
  const lineItems = mapInvoiceLines(lineRows);
  const totalCents = lineRows.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
  const meterSnapshot = extractMeterSnapshot(lineRows);
  return NextResponse.json({
    ok: true,
    data: {
      ...invoiceRes.rows[0],
      line_items: lineItems,
      meter_snapshot: meterSnapshot,
      total_amount: fromCents(totalCents),
      total_cents: totalCents,
    },
  });
}

export async function PATCH(req: NextRequest, context: { params: ParamsMaybePromise }) {
  const { id } = await Promise.resolve(context.params);
  try {
    const body = await req.json();
    let lineItems = normalizeLineItems(body?.lineItems);
    const meterSnapshot = normalizeMeterSnapshot(body?.meterSnapshot);
    lineItems = applyMeterSnapshot(lineItems, meterSnapshot);

    const lineRows = lineItems.map((item, index) => ({
      line_index: index,
      description: item.description,
      quantity: Number(item.qty || 0),
      unit_price_cents: toCents(item.rate),
      tax_cents: 0,
      total_cents: toCents(item.amount),
      meta: item.meta ?? null,
    }));
    const totalCents = lineRows.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
    const totalAmount = fromCents(totalCents);

    await query("BEGIN");
    await query(`DELETE FROM public.invoice_lines WHERE invoice_id = $1`, [id]);
    if (lineRows.length) {
      const values: any[] = [];
      const placeholders = lineRows
        .map((row, idx) => {
          const offset = idx * 8;
          values.push(id, row.line_index, row.description, row.quantity, row.unit_price_cents, row.tax_cents, row.total_cents, row.meta);
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
        })
        .join(",");
      await query(
        `INSERT INTO public.invoice_lines (invoice_id, line_index, description, quantity, unit_price_cents, tax_cents, total_cents, meta)
         VALUES ${placeholders}`,
        values,
      );
    }
    await query(
      `UPDATE public.invoices
       SET subtotal_cents = $1,
           tax_cents = $2,
           total_cents = $3,
           updated_at = now()
       WHERE id = $4`,
      [totalCents, 0, totalCents, id],
    );
    await query("COMMIT");

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

    return NextResponse.json({
      ok: true,
      data: { id, line_items: lineItems, meter_snapshot: meterSnapshot, total_amount: totalAmount, total_cents: totalCents },
    });
  } catch (err: any) {
    try {
      await query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    console.error("Failed to update invoice line items", err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed to update invoice." }, { status: 500 });
  }
}
