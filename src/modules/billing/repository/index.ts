import { query } from "@/lib/db";
import { readJsonFile } from "@/lib/storage/jsonStore";
import type { InvoiceLineItem, MeterSnapshot } from "../types";

const DRAFTS_FILE = "invoice_drafts.json";

export type InvoiceListFilters = {
  unitId?: string | null;
  tenantName?: string | null;
  status?: string | null;
  limit?: number;
};

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  total: number;
  amount_paid: number;
  outstanding: number;
  status: string;
  period: string;
  tenantId: string | null;
  unitId: string | null;
  unitNumber: string | null;
};

export type InvoiceDetails = {
  id: string;
  tenant_id: string | null;
  unit_id: string | null;
  invoice_number: string | null;
  invoice_date: string | Date | null;
  due_date: string | Date | null;
  status: string | null;
  currency: string | null;
  notes: string | null;
  meta: Record<string, unknown> | null;
  period: string | null;
  line_items: InvoiceLineItem[];
  meter_snapshot: MeterSnapshot | null;
  total_amount: number;
  total_cents: number;
};

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

export type InvoiceDraft = {
  id: string;
  tenantId: string;
  period: string;
  lineItems: Array<{
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
  }>;
  notes?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  reference?: string;
  currency?: string;
  createdAt: string;
  updatedAt: string;
};

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

function extractMeterSnapshot(meta: Record<string, unknown> | null | undefined): MeterSnapshot | null {
  if (!meta) return null;
  const snapshot = (meta as any).meter_snapshot ?? (meta as any).meterSnapshot ?? null;
  if (!snapshot || typeof snapshot !== "object") return null;
  const snap = snapshot as Record<string, unknown>;
  const prevReading = toNumber((snap as any).prevReading ?? (snap as any).prev ?? (snap as any).prev_reading);
  const currReading = toNumber((snap as any).currReading ?? (snap as any).cur ?? (snap as any).cur_reading);
  const usage = Number(Math.max(currReading - prevReading, 0).toFixed(2));
  const rate = toNumber((snap as any).rate ?? (snap as any).unit_rate, 0.41);
  return {
    prevDate: String((snap as any).prevDate ?? ""),
    prevReading,
    currDate: String((snap as any).currDate ?? ""),
    currReading,
    usage,
    rate,
    amount: Number((usage * rate).toFixed(2)),
    unitLabel: (snap as any).unitLabel ? String((snap as any).unitLabel) : "kWh",
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

function normalizeInvoicePeriod(invoiceDate: unknown, period: unknown) {
  let normalized = "";
  if (invoiceDate) {
    const d = new Date(String(invoiceDate));
    if (!Number.isNaN(d.getTime())) {
      normalized = d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    }
  }
  if (!normalized && period) {
    normalized = String(period);
  }
  return normalized;
}

export async function listInvoices(filters: InvoiceListFilters = {}): Promise<InvoiceListItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.unitId) {
    params.push(filters.unitId);
    conditions.push(`i.unit_id = $${params.length}`);
  }

  if (filters.tenantName) {
    params.push(String(filters.tenantName).trim());
    conditions.push(
      `i.tenant_id IN (SELECT id::text FROM public.tenants WHERE LOWER(TRIM(name)) = LOWER(TRIM($${params.length})))`,
    );
  }

  if (filters.status) {
    const statuses = String(filters.status)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (statuses.length) {
      params.push(statuses);
      conditions.push(`i.status = ANY($${params.length}::text[])`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Number.isFinite(filters.limit) ? Math.max(1, Math.min(Number(filters.limit), 1000)) : 200;

  let res;
  try {
    res = await query(
      `SELECT
         i.id,
         i.invoice_number,
         i.invoice_date,
         i.due_date,
         i.total_amount,
         COALESCE(i.amount_paid, 0) AS amount_paid,
         i.status,
         i.period,
         i.tenant_id,
         i.unit_id,
         u.unit_number
       FROM public.invoices i
       LEFT JOIN public.units u ON u.id = i.unit_id
       ${where}
       ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC
       LIMIT ${limit}`,
      params as any[],
    );
  } catch (err: any) {
    const code = err?.code;
    const message = err instanceof Error ? err.message : String(err);
    const missingAmountPaid = code === "42703" || message.includes("amount_paid");
    if (!missingAmountPaid) throw err;
    // Backward-compatible path for databases that have not added invoices.amount_paid yet.
    try {
      res = await query(
        `SELECT
           i.id,
           i.invoice_number,
           i.invoice_date,
           i.due_date,
           i.total_amount,
           COALESCE(alloc.amount_paid, 0) AS amount_paid,
           i.status,
           i.period,
           i.tenant_id,
           i.unit_id,
           u.unit_number
         FROM public.invoices i
         LEFT JOIN public.units u ON u.id = i.unit_id
         LEFT JOIN (
           SELECT invoice_id::text AS invoice_id, COALESCE(SUM(allocated_amount), 0)::numeric AS amount_paid
           FROM public.bank_allocations
           GROUP BY invoice_id::text
         ) alloc ON alloc.invoice_id = i.id::text
         ${where}
         ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC
         LIMIT ${limit}`,
        params as any[],
      );
    } catch (allocErr: any) {
      const allocCode = allocErr?.code;
      const allocMsg = allocErr instanceof Error ? allocErr.message : String(allocErr);
      const missingAllocations = allocCode === "42P01" || allocMsg.includes('relation "public.bank_allocations" does not exist');
      if (!missingAllocations) throw allocErr;
      // Final fallback for legacy databases: expose invoices without payment offsets.
      res = await query(
        `SELECT
           i.id,
           i.invoice_number,
           i.invoice_date,
           i.due_date,
           i.total_amount,
           0::numeric AS amount_paid,
           i.status,
           i.period,
           i.tenant_id,
           i.unit_id,
           u.unit_number
         FROM public.invoices i
         LEFT JOIN public.units u ON u.id = i.unit_id
         ${where}
         ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC
         LIMIT ${limit}`,
        params as any[],
      );
    }
  }

  return res.rows.map((row: any) => {
    const total = Number(row.total_amount || 0);
    const amount_paid = Number(row.amount_paid || 0);
    return {
      id: String(row.id),
      invoiceNumber: String(row.invoice_number || row.id).slice(0, 20),
      invoiceDate: row.invoice_date ? String(row.invoice_date).slice(0, 10) : null,
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
      total,
      amount_paid,
      outstanding: Math.max(0, total - amount_paid),
      status: String(row.status || "Unpaid"),
      period: normalizeInvoicePeriod(row.invoice_date, row.period),
      tenantId: row.tenant_id ? String(row.tenant_id) : null,
      unitId: row.unit_id ? String(row.unit_id) : null,
      unitNumber: row.unit_number ? String(row.unit_number) : null,
    };
  });
}

export async function getInvoiceById(id: string): Promise<InvoiceDetails | null> {
  const invoiceRes = await query(
    `SELECT id, tenant_id, unit_id, invoice_number, invoice_date, due_date, status, currency, notes, meta, period, line_items, meter_snapshot
     FROM public.invoices
     WHERE id = $1`,
    [id],
  );

  if (!invoiceRes.rows.length) return null;

  const invoiceRow = invoiceRes.rows[0] as Record<string, unknown>;
  const invoiceMeta = (invoiceRow.meta ?? null) as Record<string, unknown> | null;
  const storedLineItems = Array.isArray(invoiceRow.line_items) ? invoiceRow.line_items : null;

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

  const meterSnapshot =
    (invoiceRow.meter_snapshot as MeterSnapshot | null | undefined) ?? extractMeterSnapshot(invoiceMeta);

  return {
    id: String(invoiceRow.id),
    tenant_id: invoiceRow.tenant_id ? String(invoiceRow.tenant_id) : null,
    unit_id: invoiceRow.unit_id ? String(invoiceRow.unit_id) : null,
    invoice_number: invoiceRow.invoice_number ? String(invoiceRow.invoice_number) : null,
    invoice_date: normalizeDateInput(invoiceRow.invoice_date) ?? null,
    due_date: normalizeDateInput(invoiceRow.due_date) ?? null,
    status: invoiceRow.status ? String(invoiceRow.status) : null,
    currency: invoiceRow.currency ? String(invoiceRow.currency) : null,
    notes: invoiceRow.notes ? String(invoiceRow.notes) : null,
    meta: invoiceMeta,
    period: invoiceRow.period ? String(invoiceRow.period) : null,
    line_items: lineItems,
    meter_snapshot: meterSnapshot,
    total_amount: fromCents(totalCents),
    total_cents: totalCents,
  };
}

export async function getInvoiceDraft(tenantId: string, period: string): Promise<InvoiceDraft | null> {
  const drafts = await readJsonFile<InvoiceDraft[]>(DRAFTS_FILE, []);
  return drafts.find((draft) => draft.tenantId === tenantId && draft.period === period) ?? null;
}
