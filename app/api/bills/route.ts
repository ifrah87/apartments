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
  code?: string;
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

type InitialReadingRecord = {
  unit?: string;
  unit_id?: string | null;
  meter_type?: string;
  reading_value?: number | string;
  reading_date?: string;
  updated_at?: string;
};

type ElectricityLineItem = {
  description: string;
  qty: number;
  unit_cents: number;
  total_cents: number;
};

type ElectricityDebug = {
  unitNumber: string | null;
  foundElectricService: boolean;
  rate: number | null;
  prev: { value: number | null; date: string | null } | null;
  cur: { value: number | null; date: string | null } | null;
  usage: number | null;
  reason?: string;
};

type ElectricityBuildResult = {
  lineItem: ElectricityLineItem | null;
  debug: ElectricityDebug;
  snapshot: ReadingSnapshot | null;
};

type ElectricityServiceMatch = {
  found: boolean;
  rate: number | null;
  serviceId?: string;
};

type ElectricityReading = {
  value: number;
  date: string;
  source: "reading" | "initial";
};

type ElectricityReadings = {
  prev: ElectricityReading | null;
  cur: ElectricityReading | null;
  usage: number | null;
  reason?: string;
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

function formatPeriodLabel(periodStart: string) {
  const date = new Date(`${periodStart}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function toNumberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

async function fetchInitialElectricityReading(
  unitNumber: string,
  unitId?: string | null,
): Promise<ElectricityReading | null> {
  const raw = await datasetsRepo.getDataset<InitialReadingRecord[]>(INITIAL_READINGS_KEY, []);
  const rows = Array.isArray(raw) ? raw : [];
  const matches = rows.filter((row) => {
    const meterType = String(row?.meter_type ?? "").toLowerCase();
    if (meterType !== "electricity") return false;
    const rowUnit = row?.unit !== undefined && row?.unit !== null ? String(row.unit) : "";
    const rowUnitId = row?.unit_id !== undefined && row?.unit_id !== null ? String(row.unit_id) : "";
    if (unitId && rowUnitId && rowUnitId === unitId) return true;
    return rowUnit === unitNumber;
  });
  if (!matches.length) return null;
  const sorted = matches.slice().sort((a, b) => {
    const aDate = Date.parse(String(a.reading_date || a.updated_at || "")) || 0;
    const bDate = Date.parse(String(b.reading_date || b.updated_at || "")) || 0;
    return bDate - aDate;
  });
  const pick = sorted[0];
  const value = toNumberOrNull(pick?.reading_value);
  if (value === null) return null;
  return { value, date: "Initial", source: "initial" };
}

async function resolveElectricityReadings(opts: {
  unitNumber: string;
  unitId?: string | null;
  periodStart: string;
  periodEnd: string;
}): Promise<ElectricityReadings> {
  const { unitNumber, unitId, periodStart, periodEnd } = opts;
  if (!unitNumber) {
    return { prev: null, cur: null, usage: null, reason: "missing unit number" };
  }
  try {
    const [prevRes, curRes] = await Promise.all([
      query(
        `SELECT reading_value, reading_date
         FROM public.meter_readings
         WHERE unit = $1 AND lower(meter_type) = 'electricity' AND reading_date < $2
         ORDER BY reading_date DESC, created_at DESC
         LIMIT 1`,
        [unitNumber, periodStart],
      ),
      query(
        `SELECT reading_value, reading_date
         FROM public.meter_readings
         WHERE unit = $1 AND lower(meter_type) = 'electricity' AND reading_date >= $2 AND reading_date < $3
         ORDER BY reading_date DESC, created_at DESC
         LIMIT 1`,
        [unitNumber, periodStart, periodEnd],
      ),
    ]);

    const curRow = curRes.rows[0];
    const curValue = toNumberOrNull(curRow?.reading_value);
    if (curValue === null) {
      return { prev: null, cur: null, usage: null, reason: "missing current reading within period" };
    }
    const cur: ElectricityReading = {
      value: curValue,
      date: String(curRow.reading_date),
      source: "reading",
    };

    const prevRow = prevRes.rows[0];
    const prevValue = toNumberOrNull(prevRow?.reading_value);
    let prev: ElectricityReading | null =
      prevValue === null
        ? null
        : {
            value: prevValue,
            date: String(prevRow.reading_date),
            source: "reading",
          };

    if (!prev) {
      prev = await fetchInitialElectricityReading(unitNumber, unitId);
    }

    if (!prev) {
      return { prev: null, cur, usage: null, reason: "missing prev reading" };
    }

    const usage = Math.max(0, Number((cur.value - prev.value).toFixed(2)));
    return { prev, cur, usage };
  } catch (err: any) {
    const code = err?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || message.includes('relation "meter_readings" does not exist')) {
      return { prev: null, cur: null, usage: null, reason: "meter readings table missing" };
    }
    throw err;
  }
}

async function buildElectricityLineItem(
  opts: { unitId: string; periodStart: string; periodEnd: string },
): Promise<ElectricityBuildResult> {
  const { unitId, periodStart, periodEnd } = opts;
  const debug: ElectricityDebug = {
    unitNumber: null,
    foundElectricService: false,
    rate: null,
    prev: null,
    cur: null,
    usage: null,
  };

  const unitRes = await query(
    `SELECT unit_number, property_id
     FROM units
     WHERE id = $1
     LIMIT 1`,
    [unitId],
  );
  const unitRow = unitRes.rows[0];
  const unitNumber =
    unitRow?.unit_number !== undefined && unitRow?.unit_number !== null ? String(unitRow.unit_number) : "";
  const propertyId = unitRow?.property_id ? String(unitRow.property_id) : null;
  debug.unitNumber = unitNumber || null;
  if (!unitNumber) {
    debug.reason = "missing unit number";
    return { lineItem: null, debug, snapshot: null };
  }

  const serviceMatch = await fetchElectricityRate(unitId, propertyId);
  debug.foundElectricService = serviceMatch.found;
  debug.rate = serviceMatch.rate;
  if (!serviceMatch.found) {
    debug.reason = "electricity service not assigned";
    return { lineItem: null, debug, snapshot: null };
  }
  const rate = serviceMatch.rate;
  if (rate === null) {
    debug.reason = "missing electricity rate";
    return { lineItem: null, debug, snapshot: null };
  }

  const readings = await resolveElectricityReadings({
    unitNumber,
    unitId,
    periodStart,
    periodEnd,
  });
  debug.prev = readings.prev ? { value: readings.prev.value, date: readings.prev.date } : null;
  debug.cur = readings.cur ? { value: readings.cur.value, date: readings.cur.date } : null;
  debug.usage = readings.usage ?? null;
  if (readings.reason) {
    debug.reason = readings.reason;
  }

  if (!readings.cur) {
    console.warn("⚠️ missing current electricity reading within period", { unitNumber, periodStart, periodEnd });
    return { lineItem: null, debug, snapshot: null };
  }

  const rateCents = Math.round(rate * 100);
  const periodLabel = formatPeriodLabel(periodStart);

  if (!readings.prev) {
    console.warn("⚠️ missing previous electricity reading", { unitNumber, periodStart });
    return {
      lineItem: {
        description: `Electricity (${periodLabel}) — Missing prev reading`,
        qty: 0,
        unit_cents: rateCents,
        total_cents: 0,
      },
      debug,
      snapshot: null,
    };
  }

  const usage = readings.usage ?? Math.max(0, Number((readings.cur.value - readings.prev.value).toFixed(2)));
  const totalCents = Math.round(usage * rateCents);
  const prevLabel = readings.prev.date || "Initial";
  const curLabel = readings.cur.date || "";
  return {
    lineItem: {
      description: `Electricity (${periodLabel}) — Prev: ${readings.prev.value} (${prevLabel}), Cur: ${readings.cur.value} (${curLabel})`,
      qty: usage,
      unit_cents: rateCents,
      total_cents: totalCents,
    },
    debug: { ...debug, usage },
    snapshot: {
      prevReading: readings.prev.value,
      prevDate: prevLabel,
      currReading: readings.cur.value,
      currDate: curLabel,
      usage,
    },
  };
}

async function fetchElectricityRate(unitId: string, propertyId?: string | null): Promise<ElectricityServiceMatch> {
  const [rawServices, rawUnitServices, rawBuildingServices] = await Promise.all([
    datasetsRepo.getDataset<ServiceRecord[]>("services", []),
    datasetsRepo.getDataset<UnitServiceRecord[]>("unit_services", []),
    datasetsRepo.getDataset<BuildingServiceRecord[]>("building_services", []),
  ]);

  const services = normalizeServiceList(rawServices);
  const unitServices = normalizeUnitServices(rawUnitServices);
  const buildingServices = normalizeBuildingServices(rawBuildingServices);

  const codedServices = services.filter(
    (service) => String(service.code ?? "").trim().toUpperCase() === "ELECTRICITY",
  );
  const namedServices = services.filter((service) =>
    String(service.name ?? "").toLowerCase().includes("electric"),
  );
  const electricityServices = codedServices.length ? codedServices : namedServices;
  const electricityServiceIds = new Set(electricityServices.map((service) => String(service.id)));

  if (!electricityServiceIds.size) {
    return { found: false, rate: null };
  }

  const unitService = unitServices.find(
    (entry) => entry.unitId === unitId && electricityServiceIds.has(String(entry.serviceId)),
  );
  const buildingService = propertyId
    ? buildingServices.find(
        (entry) => entry.propertyId === propertyId && electricityServiceIds.has(String(entry.serviceId)),
      )
    : undefined;

  const serviceId = unitService?.serviceId ?? buildingService?.serviceId;
  if (!serviceId) {
    return { found: false, rate: null };
  }

  const service = services.find((entry) => String(entry.id) === String(serviceId));
  const rate = service?.rate !== undefined ? Number(service.rate) : null;
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    return { found: true, rate: null, serviceId: String(serviceId) };
  }
  return { found: true, rate, serviceId: String(serviceId) };
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
const INITIAL_READINGS_KEY = "initial-readings";
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
    const debugEnabled = url.searchParams.get("debug") === "1";
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

    const electricityResult = await buildElectricityLineItem({
      unitId: unit.id,
      periodStart,
      periodEnd,
    });
    const electricity = electricityResult.lineItem;
    const electricityDebugPayload = {
      unitNumber: electricityResult.debug.unitNumber,
      rate: electricityResult.debug.rate,
      prev: electricityResult.debug.prev,
      cur: electricityResult.debug.cur,
      usage: electricityResult.debug.usage,
    };
    if (!electricity) {
      console.log("ELECTRICITY DEBUG", {
        unitNumber: electricityResult.debug.unitNumber,
        foundService: electricityResult.debug.foundElectricService,
        rate: electricityResult.debug.rate,
        prev: electricityResult.debug.prev,
        cur: electricityResult.debug.cur,
      });
    }
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

    if (electricityResult.snapshot && electricity) {
      const rate = electricity.unit_cents / 100;
      meterSnapshot = {
        prevDate: electricityResult.snapshot.prevDate,
        prevReading: electricityResult.snapshot.prevReading,
        currDate: electricityResult.snapshot.currDate,
        currReading: electricityResult.snapshot.currReading,
        usage: electricityResult.snapshot.usage,
        rate,
        amount: Number((electricityResult.snapshot.usage * rate).toFixed(2)),
        unitLabel: "kWh",
      };
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
      const response: Record<string, unknown> = { ok: true, mode: "preview", draft };
      if (debugEnabled) {
        response.debug = electricityDebugPayload;
        response.lineItems = lineItemsForInvoice;
      }
      return NextResponse.json(response);
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
          tenantId,
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
      tenantId,
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

    const response: Record<string, unknown> = { ok: true, invoiceId: id, data: updated, created: [created] };
    if (debugEnabled) {
      response.debug = electricityDebugPayload;
      response.lineItems = lineItemsForInvoice;
    }
    return NextResponse.json(response);
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
