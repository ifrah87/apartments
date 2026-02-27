import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { datasetsRepo, tenantsRepo, unitsRepo, type RepoError } from "@/lib/repos";
import type { TenantRecord } from "@/src/lib/repos/tenantsRepo";
import { opt } from "@/src/lib/utils/normalize";
import { query } from "@/lib/db";
import { createStatement } from "@/lib/reports/tenantStatement";
import { normalizeId } from "@/lib/normalizeId";
import { isUuid } from "@/lib/isUuid";
import { buildInvoiceLineItems } from "@/lib/invoices/lineItems";

export const runtime = "nodejs";

type ChargeRow = {
  tenant_id: string;
  date: string;
  amount: string | number;
  description?: string;
  category?: string;
  meter_reading_id?: string;
};

type MeterReadingDetail = {
  id: string;
  unit: string;
  meter_type: string;
  reading_date: string;
  reading_value: number;
  prev_value: number;
  usage: number;
  amount: number;
  prev_date?: string | null;
};

async function fetchMeterReadingDetails(ids: string[]) {
  if (!ids.length) return new Map<string, MeterReadingDetail>();
  let rows: any[] = [];
  try {
    const res = await query(
      `WITH target AS (
         SELECT id, unit, meter_type
         FROM meter_readings
         WHERE id = ANY($1)
       ),
       ranked AS (
         SELECT r.*,
                LAG(r.reading_date) OVER (PARTITION BY r.unit, r.meter_type ORDER BY r.reading_date, r.created_at) AS prev_date
         FROM meter_readings r
         JOIN target t ON t.unit = r.unit AND t.meter_type = r.meter_type
       )
       SELECT id, unit, meter_type, reading_date, reading_value, prev_value, usage, amount, prev_date
       FROM ranked
       WHERE id = ANY($1)`,
      [ids],
    );
    rows = res.rows;
  } catch (err: any) {
    const code = err?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || message.includes('relation "meter_readings" does not exist')) {
      return new Map<string, MeterReadingDetail>();
    }
    throw err;
  }

  const map = new Map<string, MeterReadingDetail>();
  rows.forEach((row: any) => {
    map.set(String(row.id), {
      id: String(row.id),
      unit: String(row.unit),
      meter_type: String(row.meter_type),
      reading_date: String(row.reading_date),
      reading_value: Number(row.reading_value || 0),
      prev_value: Number(row.prev_value || 0),
      usage: Number(row.usage || 0),
      amount: Number(row.amount || 0),
      prev_date: row.prev_date ? String(row.prev_date) : null,
    });
  });
  return map;
}

type StoredInvoice = {
  id: string;
  tenantId: string;
  tenantName: string;
  unitId: string;
  unitLabel: string;
  invoiceDate: string;
  total: number;
  outstanding: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
  createdAt: string;
  updatedAt: string;
};

const INVOICES_KEY = "billing_invoices";
const METER_RATE = 0.41;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function handleError(err: unknown) {
  const status = err instanceof Error && (err as RepoError).status ? (err as RepoError).status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

function toMonthIndex(value: string) {
  const idx = MONTHS.findIndex((month) => month.toLowerCase() === value.toLowerCase());
  return idx >= 0 ? idx : null;
}

function monthRange(reference: Date) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { start, end };
}

function dueDateForMonth(reference: Date, dueDayRaw: string | number | undefined) {
  const dueDay = Math.max(1, Number(dueDayRaw || 1));
  const dim = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), Math.min(dueDay, dim)));
}

function toCents(value: number) {
  return Math.round(Number(value || 0) * 100);
}

function stableUuid(seed: string) {
  const hex = crypto.createHash("md5").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function buildTenantIndex(tenants: TenantRecord[]) {
  const map = new Map<string, TenantRecord>();
  tenants.forEach((tenant) => {
    const unit = opt(tenant.unit) || "";
    if (!unit) return;
    const property = opt(tenant.property_id) || opt(tenant.building) || "";
    map.set(`${property}::${unit}`.toLowerCase(), tenant);
    map.set(`::${unit}`.toLowerCase(), tenant);
  });
  return map;
}

export async function GET() {
  try {
    const data = await datasetsRepo.getDataset<StoredInvoice[]>(INVOICES_KEY, []);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ failed to load bills", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const payload = (await req.json().catch(() => ({}))) as {
      unitIds?: string[];
      month?: string;
      year?: string;
      lineItems?: Array<{ description?: string; qty?: number; unit_cents?: number; total_cents?: number }>;
    };
    const unitIds = Array.isArray(payload?.unitIds) ? payload.unitIds.filter(Boolean) : [];
    if (!unitIds.length) {
      return NextResponse.json({ ok: false, error: "Select at least one unit." }, { status: 400 });
    }
    if (unitIds.length !== 1) {
      return NextResponse.json({ ok: false, error: "Select a single unit to generate an invoice." }, { status: 400 });
    }

    const monthValue = payload?.month || "";
    const monthIndex = toMonthIndex(monthValue);
    const year = Number(payload?.year);
    if (monthIndex === null || !Number.isFinite(year)) {
      return NextResponse.json({ ok: false, error: "Invalid month or year." }, { status: 400 });
    }

    const reference = new Date(Date.UTC(year, monthIndex, 1));
    const periodKey = `${reference.getUTCFullYear()}-${String(reference.getUTCMonth() + 1).padStart(2, "0")}`;
    const { start, end } = monthRange(reference);

    const [units, tenants, charges] = await Promise.all([
      unitsRepo.listUnits(),
      tenantsRepo.listTenants(),
      datasetsRepo.getDataset<ChargeRow[]>("tenant_charges", []),
    ]);

    const tenantIndex = buildTenantIndex(tenants);
    const meterIds = charges.map((row) => row.meter_reading_id).filter(Boolean) as string[];
    const readingMap = await fetchMeterReadingDetails(meterIds);
    const chargeIndex = new Map<
      string,
      Array<{ date: string; amount: number; description?: string; category?: string; meta?: Record<string, unknown> }>
    >();
    charges.forEach((row) => {
      const tenantId = normalizeId(row.tenant_id);
      if (!tenantId) return;
      const meterId = row.meter_reading_id ? String(row.meter_reading_id) : "";
      const meter = meterId ? readingMap.get(meterId) : undefined;
      const isUtility = Boolean(meter) || row.category === "utilities";
      const meterType = meter?.meter_type || "";
      const unitLabel = meterType === "water" ? "m3" : "kWh";
      const entry = {
        date: row.date,
        amount: Number(row.amount || 0),
        description: meterType === "water" ? "Water" : meterType === "electricity" ? "Electricity" : row.description,
        category: row.category,
        meta: isUtility && meter
          ? {
              kind: "utility",
              meterType: meterType || row.category || "utility",
              prevDate: meter.prev_date,
              prevValue: meter.prev_value,
              currentDate: meter.reading_date,
              currentValue: meter.reading_value,
              usage: meter.usage,
              rate: METER_RATE,
              unitLabel,
            }
          : undefined,
      };
      if (!chargeIndex.has(tenantId)) {
        chargeIndex.set(tenantId, []);
      }
      chargeIndex.get(tenantId)!.push(entry);
    });

    const now = new Date().toISOString();
    const unitId = unitIds[0];
    const unit = units.find((row) => row.id === unitId);
    if (!unit) {
      return NextResponse.json({ ok: false, error: "Unit not found." }, { status: 404 });
    }
    const propertyKey = (unit.property_id || "").toLowerCase();
    const unitKey = `${propertyKey}::${unit.unit}`.toLowerCase();
    const tenant = tenantIndex.get(unitKey) || tenantIndex.get(`::${unit.unit}`.toLowerCase());
    if (!tenant) {
      return NextResponse.json({ ok: false, error: "Tenant not found for this unit." }, { status: 404 });
    }

    const payloadTenantId = payload?.tenant_id ? normalizeId(payload.tenant_id) : "";
    if (payloadTenantId && !isUuid(payloadTenantId)) {
      return NextResponse.json(
        { ok: false, error: `Invalid tenant_id: ${payload.tenant_id}` },
        { status: 400 },
      );
    }
    const tenantId = payloadTenantId || normalizeId(tenant.id);
    if (!isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: `Invalid tenant_id: ${tenant.id}` }, { status: 400 });
    }
    const { rows, totals } = createStatement({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        property_id: opt(tenant.property_id),
        building: opt(tenant.building),
        unit: opt(tenant.unit),
        reference: opt(tenant.reference),
        monthly_rent: opt(tenant.monthly_rent),
        due_day: opt(tenant.due_day),
      },
      start,
      end,
      payments: [],
      additionalCharges: chargeIndex.get(tenantId) || [],
    });

    if (!totals.charges) {
      return NextResponse.json(
        { ok: false, error: "No charges found for this tenant." },
        { status: 400 },
      );
    }

    const { lineItems } = buildInvoiceLineItems(rows, reference);
    const defaultLineItems = lineItems.map((item) => {
      const unitCents = toCents(item.rate);
      const qty = Number(item.qty || 0);
      return {
        description: item.description,
        qty,
        unit_cents: unitCents,
        total_cents: Math.round(qty * unitCents),
      };
    });

    const invoiceDate = reference;
    const dueDay = tenant.due_day ?? 5;
    const dueDate = dueDateForMonth(reference, dueDay);
    const draft = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      unitId: unit.id,
      unitLabel: unit.unit ? `Unit ${unit.unit}` : `Unit ${unit.id}`,
      period: periodKey,
      invoiceDate: invoiceDate.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      lineItems: defaultLineItems,
    };

    if (dryRun) {
      return NextResponse.json({ ok: true, mode: "preview", draft });
    }

    const inputLineItems = Array.isArray(payload?.lineItems) ? payload.lineItems : draft.lineItems;
    const normalizedLineItems = inputLineItems
      .map((item) => {
        const description = String(item?.description ?? "").trim();
        const qty = Number(item?.qty ?? 0);
        const unitCents = Math.round(Number(item?.unit_cents ?? 0));
        const totalCents = Math.round(Number(item?.total_cents ?? qty * unitCents));
        return {
          description,
          qty,
          unit_cents: unitCents,
          total_cents: totalCents,
        };
      })
      .filter((item) => item.description);

    const totalCents = normalizedLineItems.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
    const id = stableUuid(`inv-${tenantId}-${periodKey}`);

    try {
      await query("BEGIN");
      await query(
        `INSERT INTO public.invoices (id, tenant_id, unit_id, invoice_date, due_date, status, currency, subtotal_cents, tax_cents, total_cents, notes, meta, period)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           unit_id = EXCLUDED.unit_id,
           invoice_date = EXCLUDED.invoice_date,
           due_date = EXCLUDED.due_date,
           status = EXCLUDED.status,
           currency = EXCLUDED.currency,
           subtotal_cents = EXCLUDED.subtotal_cents,
           tax_cents = EXCLUDED.tax_cents,
           total_cents = EXCLUDED.total_cents,
           notes = EXCLUDED.notes,
           meta = EXCLUDED.meta,
           period = EXCLUDED.period`,
        [
          id,
          tenant.id,
          unit.id,
          invoiceDate,
          dueDate,
          "draft",
          "USD",
          totalCents,
          0,
          totalCents,
          null,
          null,
          periodKey,
        ],
      );
      await query(`DELETE FROM public.invoice_lines WHERE invoice_id = $1`, [id]);
      if (normalizedLineItems.length) {
        const values: any[] = [];
        const placeholders = normalizedLineItems
          .map((row, idx) => {
            const offset = idx * 6;
            values.push(id, idx, row.description, row.qty, row.unit_cents, row.total_cents);
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
          })
          .join(",");
        await query(
          `INSERT INTO public.invoice_lines (invoice_id, sort_order, description, qty, unit_cents, total_cents)
           VALUES ${placeholders}`,
          values,
        );
      }
      await query("COMMIT");
    } catch (err) {
      try {
        await query("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
      throw err;
    }

    const created: StoredInvoice = {
      id,
      tenantId: tenant.id,
      tenantName: tenant.name,
      unitId: unit.id,
      unitLabel: unit.unit ? `Unit ${unit.unit}` : `Unit ${unit.id}`,
      invoiceDate: invoiceDate.toISOString().slice(0, 10),
      total: Number((totalCents / 100).toFixed(2)),
      outstanding: Number((totalCents / 100).toFixed(2)),
      status: "Unpaid",
      createdAt: now,
      updatedAt: now,
    };

    const updated = await datasetsRepo.updateDataset<StoredInvoice[]>(
      INVOICES_KEY,
      (current) => {
        const map = new Map<string, StoredInvoice>();
        (Array.isArray(current) ? current : []).forEach((item) => map.set(item.id, item));
        const existing = map.get(created.id);
        map.set(created.id, existing ? { ...existing, ...created, updatedAt: now } : created);
        return Array.from(map.values());
      },
      [],
    );

    return NextResponse.json({ ok: true, invoiceId: id, data: updated, created: [created] });
  } catch (err) {
    console.error("❌ failed to generate bills", err);
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = (await req.json()) as { id?: string };
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "Invoice id is required." }, { status: 400 });
    }

    const updated = await datasetsRepo.updateDataset<StoredInvoice[]>(
      INVOICES_KEY,
      (current) => (Array.isArray(current) ? current.filter((item) => item.id !== payload.id) : []),
      [],
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to delete bill", err);
    return handleError(err);
  }
}
