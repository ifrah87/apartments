import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { datasetsRepo, tenantsRepo, unitsRepo, type RepoError } from "@/lib/repos";
import type { TenantRecord } from "@/src/lib/repos/tenantsRepo";
import { opt } from "@/src/lib/utils/normalize";
import { query } from "@/lib/db";
import { createStatement } from "@/lib/reports/tenantStatement";
import { normalizeId } from "@/lib/normalizeId";
import { buildInvoiceLineItems } from "@/lib/invoices/lineItems";

export const runtime = "nodejs";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normalizeTenantId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i,
  );

  if (!match) return null;

  return match[1];
}

type ChargeRow = {
  tenant_id: string;
  date: string;
  amount: string | number;
  description?: string;
  category?: string;
  meter_reading_id?: string;
};

type ServiceRecord = {
  id: string;
  name?: string;
  rate?: number;
  icon?: string;
};

type UnitServiceRecord = {
  id: string;
  unitId: string;
  propertyId?: string;
  serviceId: string;
  startDate: string;
};

type BuildingServiceRecord = {
  id: string;
  propertyId: string;
  serviceId: string;
  startDate: string;
};

type ReadingSnapshot = {
  prevReading: number;
  prevDate: string;
  currReading: number;
  currDate: string;
  usage: number;
};

function normalizeServiceList(value: unknown): ServiceRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as ServiceRecord[];
}

function normalizeUnitServices(value: unknown): UnitServiceRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as UnitServiceRecord[];
}

function normalizeBuildingServices(value: unknown): BuildingServiceRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as BuildingServiceRecord[];
}

async function buildElectricityLineItem(opts: { unitId: string; periodStart: string; periodEnd: string }) {
  const { unitId, periodStart, periodEnd } = opts;

  const unitRes = await query(
    `SELECT unit_number, property_id
     FROM units
     WHERE id = $1
     LIMIT 1`,
    [unitId],
  );
  const unitRow = unitRes.rows[0];
  const unitNumber = unitRow?.unit_number !== undefined && unitRow?.unit_number !== null ? String(unitRow.unit_number) : "";
  const propertyId = unitRow?.property_id ? String(unitRow.property_id) : null;
  if (!unitNumber) return null;

  const unitRate = await fetchElectricityRate(unitId, propertyId);
  if (unitRate == null) return null;
  const rateCents = Math.round(unitRate * 100);

  const prevRes = await query(
    `SELECT reading_value
     FROM meter_readings
     WHERE unit = $1
       AND lower(meter_type) = 'electricity'
       AND reading_date < $2
     ORDER BY reading_date DESC
     LIMIT 1`,
    [unitNumber, periodStart],
  );

  const curRes = await query(
    `SELECT reading_value
     FROM meter_readings
     WHERE unit = $1
       AND lower(meter_type) = 'electricity'
       AND reading_date >= $2
       AND reading_date < $3
     ORDER BY reading_date DESC
     LIMIT 1`,
    [unitNumber, periodStart, periodEnd],
  );

  const prev = prevRes.rows[0]?.reading_value;
  const cur = curRes.rows[0]?.reading_value;
  if (prev == null || cur == null) return null;

  const prevNum = Number(prev);
  const curNum = Number(cur);
  const usage = curNum - prevNum;
  if (!Number.isFinite(usage) || usage <= 0) return null;

  const totalCents = Math.round(usage * rateCents);
  return {
    description: `Electricity (Prev: ${prevNum}, Cur: ${curNum})`,
    qty: usage,
    unit_cents: rateCents,
    total_cents: totalCents,
  };
}

async function fetchElectricityRate(unitId: string, propertyId?: string | null): Promise<number | null> {
  const [rawServices, rawUnitServices, rawBuildingServices] = await Promise.all([
    datasetsRepo.getDataset<ServiceRecord[]>("services", []),
    datasetsRepo.getDataset<UnitServiceRecord[]>("unit_services", []),
    datasetsRepo.getDataset<BuildingServiceRecord[]>("building_services", []),
  ]);

  const services = normalizeServiceList(rawServices);
  const unitServices = normalizeUnitServices(rawUnitServices);
  const buildingServices = normalizeBuildingServices(rawBuildingServices);

  const electricityServiceIds = new Set(
    services
      .filter((service) => {
        const name = String(service.name ?? "").toLowerCase();
        const icon = String(service.icon ?? "").toLowerCase();
        return name.includes("electric") || icon === "electricity";
      })
      .map((service) => String(service.id)),
  );

  if (!electricityServiceIds.size) return null;

  const unitService = unitServices.find(
    (entry) => entry.unitId === unitId && electricityServiceIds.has(String(entry.serviceId)),
  );
  const buildingService = propertyId
    ? buildingServices.find(
        (entry) => entry.propertyId === propertyId && electricityServiceIds.has(String(entry.serviceId)),
      )
    : undefined;

  const serviceId = unitService?.serviceId ?? buildingService?.serviceId;
  if (!serviceId) return null;

  const service = services.find((entry) => String(entry.id) === String(serviceId));
  const rate = service?.rate !== undefined ? Number(service.rate) : 0;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function fetchElectricitySnapshot(
  unitNumber: string,
  monthStart: string,
  monthEndExclusive: string,
): Promise<ReadingSnapshot | null> {
  if (!unitNumber) return null;
  try {
    const [prevRes, curRes] = await Promise.all([
      query(
        `SELECT reading_value, reading_date
         FROM public.meter_readings
         WHERE unit = $1 AND lower(meter_type) = 'electricity' AND reading_date < $2
         ORDER BY reading_date DESC, created_at DESC
         LIMIT 1`,
        [unitNumber, monthStart],
      ),
      query(
        `SELECT reading_value, reading_date
         FROM public.meter_readings
         WHERE unit = $1 AND lower(meter_type) = 'electricity' AND reading_date >= $2 AND reading_date < $3
         ORDER BY reading_date DESC, created_at DESC
         LIMIT 1`,
        [unitNumber, monthStart, monthEndExclusive],
      ),
    ]);

    const prevRow = prevRes.rows[0];
    const curRow = curRes.rows[0];
    if (!prevRow || !curRow) return null;
    const prevReading = Number(prevRow.reading_value || 0);
    const currReading = Number(curRow.reading_value || 0);
    const usage = Math.max(0, Number((currReading - prevReading).toFixed(2)));
    return {
      prevReading,
      prevDate: String(prevRow.reading_date),
      currReading,
      currDate: String(curRow.reading_date),
      usage,
    };
  } catch (err: any) {
    const code = err?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || message.includes('relation "meter_readings" does not exist')) {
      return null;
    }
    throw err;
  }
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
    type BillsPayload = {
      tenantId?: string;
      tenant_id?: string;
      unitIds?: string[];
      month?: string;
      year?: string;
      lineItems?: {
        description?: string;
        qty?: number;
        unit_cents?: number;
        total_cents?: number;
      }[];
    };

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const payload = (await req.json().catch(() => ({}))) as BillsPayload;
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
    const monthStartKey = start.toISOString().slice(0, 10);
    const monthEndExclusive = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
    const monthEndKey = monthEndExclusive.toISOString().slice(0, 10);

    const [units, tenants, charges] = await Promise.all([
      unitsRepo.listUnits(),
      tenantsRepo.listTenants(),
      datasetsRepo.getDataset<ChargeRow[]>("tenant_charges", []),
    ]);

    const tenantIndex = buildTenantIndex(tenants);
    const chargeIndex = new Map<
      string,
      Array<{ date: string; amount: number; description?: string; category?: string; meta?: Record<string, unknown> }>
    >();
    charges.forEach((row) => {
      const tenantId = normalizeId(row.tenant_id);
      if (!tenantId) return;
      if (row.category === "utilities" || row.meter_reading_id) return;
      const entry = {
        date: row.date,
        amount: Number(row.amount || 0),
        description: row.description,
        category: row.category,
        meta: undefined,
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

    const tenantIdFromPayload = normalizeTenantId(payload?.tenant_id ?? payload?.tenantId ?? null);
    if ((payload?.tenant_id || payload?.tenantId) && !tenantIdFromPayload) {
      return NextResponse.json({ ok: false, error: "Invalid tenant_id format" }, { status: 400 });
    }
    const tenantId =
      tenantIdFromPayload ?? normalizeTenantId(tenant.id) ?? normalizeId(tenant.id);
    if (tenantId && !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: `Invalid tenant_id: ${tenantId}` }, { status: 400 });
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

    // --- ELECTRICITY AUTO CALCULATION ---
    const periodStart = monthStartKey;
    const periodEnd = monthEndKey;
    const lineItemsForInvoice = [...defaultLineItems];

    const electricity = await buildElectricityLineItem({
      unitId: unit.id,
      periodStart,
      periodEnd,
    });
    if (electricity) {
      lineItemsForInvoice.push(electricity);
    }

    let meterSnapshot: {
      prevDate: string;
      prevReading: number;
      currDate: string;
      currReading: number;
      usage: number;
      rate: number;
      amount: number;
      unitLabel: string;
    } | null = null;

    if (electricity) {
      const electricitySnapshot = await fetchElectricitySnapshot(unit.unit, periodStart, periodEnd);
      if (electricitySnapshot) {
        const rate = electricity.unit_cents / 100;
        meterSnapshot = {
          prevDate: electricitySnapshot.prevDate,
          prevReading: electricitySnapshot.prevReading,
          currDate: electricitySnapshot.currDate,
          currReading: electricitySnapshot.currReading,
          usage: electricitySnapshot.usage,
          rate,
          amount: Number((electricitySnapshot.usage * rate).toFixed(2)),
          unitLabel: "kWh",
        };
      }
    }

    const invoiceDate = reference;
    const dueDay = tenant.due_day ?? 5;
    const dueDate = dueDateForMonth(reference, dueDay);
    const draft = {
      tenantId,
      tenantName: tenant.name,
      unitId: unit.id,
      unitLabel: unit.unit ? `Unit ${unit.unit}` : `Unit ${unit.id}`,
      period: periodKey,
      invoiceDate: invoiceDate.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      lineItems: lineItemsForInvoice,
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
          meterSnapshot ? { meterSnapshot } : null,
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
