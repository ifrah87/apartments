import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { datasetsRepo, tenantsRepo, unitsRepo, type RepoError, type TenantRecord as RepoTenantRecord } from "@/lib/repos";
import { query } from "@/lib/db";
import { createStatement, normalizeId } from "@/lib/reports/tenantStatement";
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
  period: string;
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

function monthLabel(reference: Date) {
  return reference.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function monthRange(reference: Date) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { start, end };
}

function buildTenantIndex(tenants: RepoTenantRecord[]) {
  const map = new Map<string, RepoTenantRecord>();
  tenants.forEach((tenant) => {
    const unit = tenant.unit || "";
    if (!unit) return;
    const property = tenant.property_id || tenant.building || "";
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
    const payload = (await req.json()) as { unitIds?: string[]; month?: string; year?: string };
    const unitIds = Array.isArray(payload?.unitIds) ? payload.unitIds.filter(Boolean) : [];
    if (!unitIds.length) {
      return NextResponse.json({ ok: false, error: "Select at least one unit." }, { status: 400 });
    }

    const monthValue = payload?.month || "";
    const monthIndex = toMonthIndex(monthValue);
    const year = Number(payload?.year);
    if (monthIndex === null || !Number.isFinite(year)) {
      return NextResponse.json({ ok: false, error: "Invalid month or year." }, { status: 400 });
    }

    const reference = new Date(Date.UTC(year, monthIndex, 1));
    const period = monthLabel(reference);
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
    const created: StoredInvoice[] = [];
    const skipped: string[] = [];

    for (const unitId of unitIds) {
      const unit = units.find((row) => row.id === unitId);
      if (!unit) {
        skipped.push(unitId);
        continue;
      }
      const propertyKey = (unit.property_id || "").toLowerCase();
      const unitKey = `${propertyKey}::${unit.unit}`.toLowerCase();
      const tenant = tenantIndex.get(unitKey) || tenantIndex.get(`::${unit.unit}`.toLowerCase());
      if (!tenant) {
        skipped.push(unit.unit);
        continue;
      }
      const tenantId = normalizeId(tenant.id);
      const { rows, totals } = createStatement({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          property_id: tenant.property_id ?? undefined,
          building: tenant.building ?? undefined,
          unit: tenant.unit ?? undefined,
          reference: tenant.reference ?? undefined,
          monthly_rent: tenant.monthly_rent ?? undefined,
          due_day: tenant.due_day ?? undefined,
        },
        start,
        end,
        payments: [],
        additionalCharges: chargeIndex.get(tenantId) || [],
      });

      if (!totals.charges) {
        skipped.push(unit.unit);
        continue;
      }

      const { lineItems, meterSnapshot, totalAmount } = buildInvoiceLineItems(rows, reference);
      const id = `inv-${tenantId}-${periodKey}`;
      created.push({
        id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitId: unit.id,
        unitLabel: unit.unit ? `Unit ${unit.unit}` : `Unit ${unit.id}`,
        period,
        total: Number(totalAmount.toFixed(2)),
        outstanding: Number(totalAmount.toFixed(2)),
        status: "Unpaid",
        createdAt: now,
        updatedAt: now,
      });

      await query(
        `INSERT INTO public.invoices (id, tenant_id, unit_id, period, line_items, meter_snapshot, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           line_items = EXCLUDED.line_items,
           meter_snapshot = EXCLUDED.meter_snapshot,
           total_amount = EXCLUDED.total_amount,
           updated_at = now()`,
        [id, tenant.id, unit.id, periodKey, lineItems, meterSnapshot, totalAmount],
      );
    }

    if (!created.length) {
      return NextResponse.json(
        { ok: false, error: "No invoices generated. Ensure tenants and rent are set." },
        { status: 400 },
      );
    }

    const updated = await datasetsRepo.updateDataset<StoredInvoice[]>(
      INVOICES_KEY,
      (current) => {
        const map = new Map<string, StoredInvoice>();
        (Array.isArray(current) ? current : []).forEach((item) => map.set(item.id, item));
        created.forEach((item) => {
          const existing = map.get(item.id);
          map.set(item.id, existing ? { ...existing, ...item, updatedAt: now } : item);
        });
        return Array.from(map.values());
      },
      [],
    );

    return NextResponse.json({ ok: true, data: updated, created, skipped });
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
