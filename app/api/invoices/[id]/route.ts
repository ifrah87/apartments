import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { datasetsRepo } from "@/lib/repos";
import type { InvoiceLineItem, MeterSnapshot } from "@/lib/invoices/types";

type RouteParams = Promise<{ id: string }>;

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

function normalizeDateInput(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function normalizeStoredDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return normalizeDateInput(value);
}

function normalizePeriodKey(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  const direct = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (direct) return `${direct[1]}-${direct[2]}`;
  const date = normalizeDateInput(trimmed);
  return date ? date.slice(0, 7) : null;
}

type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  line_index: number;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  meta?: Record<string, unknown> | null;
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
  const prevReading = toNumber(snap.prevReading ?? snap.prev ?? snap.prev_reading);
  const currReading = toNumber(snap.currReading ?? snap.cur ?? snap.cur_reading);
  const usage = Number(Math.max(currReading - prevReading, 0).toFixed(2));
  const rate = toNumber(snap.rate ?? snap.unit_rate, 0.41);
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

function extractMeterSnapshot(meta: Record<string, any> | null | undefined): MeterSnapshot | null {
  if (!meta) return null;
  const snapshot = meta.meter_snapshot ?? meta.meterSnapshot ?? null;
  return normalizeMeterSnapshot(snapshot);
}

export async function GET(_req: NextRequest, context: { params: RouteParams }) {
  const { id } = await Promise.resolve(context.params);
  const invoiceRes = await query(
    `SELECT id, tenant_id, unit_id, invoice_number, invoice_date, due_date, status, currency, notes, meta, period, line_items, meter_snapshot
     FROM public.invoices
     WHERE id = $1`,
    [id],
  );
  if (!invoiceRes.rows.length) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }
  const invoiceMeta = (invoiceRes.rows[0]?.meta ?? null) as Record<string, any> | null;
  const invoiceRow = invoiceRes.rows[0] as any;
  const storedLineItems = Array.isArray(invoiceRow?.line_items) ? invoiceRow.line_items : null;
  let lineItems: InvoiceLineItem[] = [];
  let totalCents = 0;

  if (storedLineItems) {
    lineItems = storedLineItems
      .map((item: any, idx: number) => ({
        id: String(item?.id ?? `line-${idx + 1}`),
        description: String(item?.description ?? ""),
        qty: Number(item?.qty ?? 0),
        rate: toNumber(item?.rate),
        amount: toNumber(item?.amount),
        meta: item?.meta && typeof item.meta === "object" ? item.meta : undefined,
      }))
      .filter((item: InvoiceLineItem) => item.description);
    totalCents = lineItems.reduce((sum, item) => sum + toCents(item.amount), 0);
  } else {
    const lineRes = await query(
      `SELECT id, invoice_id, line_index, description, quantity, unit_price_cents, total_cents, meta, created_at
       FROM public.invoice_lines
       WHERE invoice_id = $1
       ORDER BY line_index ASC, created_at ASC`,
      [id],
    );
    const lineRows = lineRes.rows as InvoiceLineRow[];
    lineItems = mapInvoiceLines(lineRows);
    totalCents = lineRows.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
  }
  const meterSnapshot = invoiceRow?.meter_snapshot ?? extractMeterSnapshot(invoiceMeta);
  return NextResponse.json({
    ok: true,
    data: {
      ...invoiceRow,
      line_items: lineItems,
      meter_snapshot: meterSnapshot,
      total_amount: fromCents(totalCents),
      total_cents: totalCents,
    },
  });
}

function normalizeInvoiceStatus(value: unknown): "draft" | "unpaid" | "paid" | "partially_paid" | null {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (raw === "paid") return "paid";
  if (raw === "partially_paid" || raw === "partially paid") return "partially_paid";
  if (raw === "unpaid") return "unpaid";
  if (raw === "draft") return "draft";
  return null;
}

export async function PATCH(req: NextRequest, context: { params: RouteParams }) {
  const { id } = await Promise.resolve(context.params);
  try {
    const body = await req.json();

    // Fast path: status-only update (Mark Paid / Mark Unpaid)
    if (body?.status !== undefined && Object.keys(body).length === 1) {
      const nextStatus = normalizeInvoiceStatus(body.status);
      if (!nextStatus) {
        return NextResponse.json({ ok: false, error: "Invalid status value." }, { status: 400 });
      }
      const res = await query(
        `UPDATE public.invoices SET status = $1 WHERE id = $2 RETURNING id, status`,
        [nextStatus, id],
      );
      if (!res.rowCount) {
        return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, data: { id, status: nextStatus } });
    }

    const existingInvoiceRes = await query(
      `SELECT id, unit_id, invoice_date, due_date, period
       FROM public.invoices
       WHERE id = $1`,
      [id],
    );
    if (!existingInvoiceRes.rows.length) {
      return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
    }
    const existingInvoice = existingInvoiceRes.rows[0] as Record<string, unknown>;
    const lineItems = normalizeLineItems(body?.lineItems);
    const meterSnapshot = normalizeMeterSnapshot(body?.meterSnapshot);
    const requestedStatus = normalizeInvoiceStatus(body?.status);
    const requestedPeriod = normalizePeriodKey(body?.period);
    const requestedInvoiceDate = normalizeDateInput(body?.invoiceDate);
    const requestedDueDate = normalizeDateInput(body?.dueDate);
    const nextInvoiceDate =
      requestedInvoiceDate ??
      (requestedPeriod ? `${requestedPeriod}-01` : null) ??
      normalizeStoredDate(existingInvoice.invoice_date);
    const nextPeriod =
      requestedPeriod ??
      normalizePeriodKey(nextInvoiceDate) ??
      normalizePeriodKey(existingInvoice.period) ??
      normalizeStoredDate(existingInvoice.invoice_date)?.slice(0, 7) ??
      null;
    const nextDueDate = requestedDueDate ?? normalizeStoredDate(existingInvoice.due_date);

    const lineRows = lineItems.map((item, index) => ({
      line_index: index,
      description: item.description,
      quantity: Number(item.qty || 0),
      unit_price_cents: toCents(item.rate),
      total_cents: toCents(item.amount),
      meta: item.meta && typeof item.meta === "object" ? item.meta : null,
    }));
    const totalCents = lineRows.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
    const totalAmount = fromCents(totalCents);
    const invoiceMetaJson = meterSnapshot ? JSON.stringify({ meter_snapshot: meterSnapshot }) : null;
    const lineItemsJsonb = JSON.stringify(
      lineItems.map((item, index) => ({
        id: item.id || `line-${index + 1}`,
        description: item.description,
        qty: Number(item.qty || 0),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
        meta: item.meta ?? undefined,
      })),
    );
    const meterSnapshotJson = meterSnapshot ? JSON.stringify(meterSnapshot) : null;

    await query("BEGIN");
    await query(`DELETE FROM public.invoice_lines WHERE invoice_id = $1`, [id]);
    if (lineRows.length) {
      const values: any[] = [];
      const placeholders = lineRows
        .map((row, idx) => {
          const offset = idx * 7;
          values.push(id, row.line_index, row.description, row.quantity, row.unit_price_cents, row.total_cents, row.meta);
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
        })
        .join(",");
      await query(
        `INSERT INTO public.invoice_lines (invoice_id, line_index, description, quantity, unit_price_cents, total_cents, meta)
         VALUES ${placeholders}`,
        values,
      );
    }
    await query(
      `UPDATE public.invoices
       SET subtotal_cents = $1,
           tax_cents = $2,
           total_cents = $3,
           invoice_date = $4,
           due_date = $5,
           meta = $6::jsonb,
           line_items = $7::jsonb,
           meter_snapshot = $8::jsonb,
           total_amount = $9,
           status = COALESCE($10, 'draft'),
           period = $11
       WHERE id = $12`,
      [
        totalCents,
        0,
        totalCents,
        nextInvoiceDate,
        nextDueDate,
        invoiceMetaJson,
        lineItemsJsonb,
        meterSnapshotJson,
        totalAmount,
        requestedStatus,
        nextPeriod,
        id,
      ],
    );
    await query("COMMIT");

    await datasetsRepo.updateDataset<any[]>(
      INVOICES_KEY,
      (current) =>
        Array.isArray(current)
          ? current.map((item) =>
              item?.id === id
                ? {
                    ...item,
                    total: totalAmount,
                    outstanding: totalAmount,
                    period: nextPeriod ?? item?.period,
                    invoiceDate: nextInvoiceDate ?? item?.invoiceDate,
                    dueDate: nextDueDate ?? item?.dueDate,
                    invoice_date: nextInvoiceDate ?? item?.invoice_date,
                    due_date: nextDueDate ?? item?.due_date,
                  }
                : item,
            )
          : [],
      [],
    );

    const refreshedLines = await query(
      `SELECT id, invoice_id, line_index, description, quantity, unit_price_cents, total_cents, meta, created_at
       FROM public.invoice_lines
       WHERE invoice_id = $1
       ORDER BY line_index ASC, created_at ASC`,
      [id],
    );
    const refreshedItems = mapInvoiceLines(refreshedLines.rows as InvoiceLineRow[]);

    return NextResponse.json({
      ok: true,
      data: {
        id,
        period: nextPeriod,
        invoice_date: nextInvoiceDate,
        due_date: nextDueDate,
        line_items: refreshedItems,
        meter_snapshot: meterSnapshot,
        total_amount: totalAmount,
        total_cents: totalCents,
      },
    });
  } catch (err: any) {
    try {
      await query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    if (err?.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "An invoice already exists for this unit and billing period." },
        { status: 409 },
      );
    }
    console.error("Failed to update invoice line items", err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed to update invoice." }, { status: 500 });
  }
}
