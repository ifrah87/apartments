import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { datasetsRepo, tenantsRepo, unitsRepo, type RepoError } from "@/lib/repos";
import type { TenantRecord } from "@/src/lib/repos/tenantsRepo";
import { opt } from "@/src/lib/utils/normalize";
import { query } from "@/lib/db";
import { dateOnlyToUtcTimestamp, toDateOnlyString } from "@/lib/dateOnly";
import { createStatement } from "@/lib/reports/tenantStatement";
import { buildInvoiceLineItems } from "@/lib/invoices/lineItems";
import type { LeaseAgreement } from "@/lib/leases";

export const runtime = "nodejs";


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
  type?: string;
  unit?: string;
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
  meta: Record<string, unknown> | null;
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

type GenericServiceLineItem = {
  description: string;
  qty: number;
  unit_cents: number;
  total_cents: number;
  meta: Record<string, unknown> | null;
};

type MeterSnapshot = {
  service: "ELECTRICITY";
  unit: string;
  prev_reading: number | null;
  prev_date?: string | null;
  cur_reading: number | null;
  cur_date?: string | null;
  usage: number;
  rate: number;
  amount?: number;
  unit_label?: string;
};

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function generatedLineItemKey(line: ElectricityLineItem | GenericServiceLineItem) {
  const meta = line.meta && typeof line.meta === "object" ? line.meta : null;
  const kind = String(meta?.kind || "").trim().toUpperCase();
  const serviceId = String(meta?.service_id || "").trim();
  const description = String(line.description || "").trim().toLowerCase();
  return [kind, serviceId, description, Number(line.qty || 0), Number(line.unit_cents || 0)].join("::");
}

function dedupeGeneratedLineItems(lines: Array<ElectricityLineItem | GenericServiceLineItem>) {
  const seen = new Set<string>();
  const deduped: Array<ElectricityLineItem | GenericServiceLineItem> = [];
  for (const line of lines) {
    const key = generatedLineItemKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }
  return deduped;
}

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

type LeaseRow = {
  id: string;
  tenant_id: string;
  rent: number | null;
  start_date: string;
  end_date: string | null;
  status: string;
};

type ResolvedLease = {
  id: string;
  tenant_id: string;
  rent: number | null;
  start_date: string;
  end_date: string | null;
  status: string;
  source: "db" | "dataset";
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

function toNumberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatReadingDate(value?: string | Date | null) {
  if (!value) return "";
  if (value === "Initial") return "Initial";
  return toDateOnlyString(value);
}

function buildElectricityLineDescription(input: {
  prevValue: number | null;
  prevDate?: string | null;
  curValue: number | null;
  curDate?: string | null;
  usage: number;
  rate: number;
  total: number;
  missingPrev?: boolean;
}) {
  const prevDateLabel = formatReadingDate(input.prevDate);
  const curDateLabel = formatReadingDate(input.curDate);
  const prevLabel =
    input.prevValue === null
      ? "missing"
      : `${Number(input.prevValue).toFixed(2)}${prevDateLabel ? ` (${prevDateLabel})` : ""}`;
  const curLabel =
    input.curValue === null
      ? "missing"
      : `${Number(input.curValue).toFixed(2)}${curDateLabel ? ` (${curDateLabel})` : ""}`;
  const base = `Electricity | Initial reading: ${prevLabel} | Current reading: ${curLabel} | Usage: ${input.usage.toFixed(2)} | Rate: ${input.rate.toFixed(2)} | Total: ${input.total.toFixed(2)}`;
  return input.missingPrev ? `${base} | Missing previous reading` : base;
}

function isElectricityService(service: ServiceRecord) {
  const code = String(service.code || "").trim().toUpperCase();
  if (code === "ELECTRICITY") return true;
  return String(service.name || "").toLowerCase().includes("electric");
}

function normalizeMeterSnapshotInput(input: unknown): MeterSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const prevReading = toNumberOrNull(row.prevReading ?? row.prev_reading ?? row.prev);
  const currReading = toNumberOrNull(row.currReading ?? row.cur_reading ?? row.cur);
  const usage = toNumberOrNull(row.usage) ?? Math.max(Number(currReading ?? 0) - Number(prevReading ?? 0), 0);
  const rate = toNumberOrNull(row.rate ?? row.unit_rate) ?? 0.41;
  const amount = toNumberOrNull(row.amount) ?? Number((usage * rate).toFixed(2));
  return {
    service: "ELECTRICITY" as const,
    unit: String(row.unit ?? ""),
    prev_reading: prevReading,
    prev_date: formatReadingDate(String(row.prevDate ?? row.prev_date ?? "Initial")),
    cur_reading: currReading,
    cur_date: formatReadingDate(String(row.currDate ?? row.cur_date ?? "")),
    usage: Number(usage.toFixed(2)),
    rate: Number(rate.toFixed(2)),
    amount,
    unit_label: String(row.unitLabel ?? row.unit_label ?? "kWh"),
  };
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
    const aDate = dateOnlyToUtcTimestamp(a.reading_date || a.updated_at || "") || 0;
    const bDate = dateOnlyToUtcTimestamp(b.reading_date || b.updated_at || "") || 0;
    return bDate - aDate;
  });
  const pick = sorted[0];
  const value = toNumberOrNull(pick?.reading_value);
  if (value === null) return null;
  return { value, date: formatReadingDate(pick?.reading_date || pick?.updated_at || ""), source: "initial" };
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
         WHERE unit = $1 AND lower(meter_type) = 'electricity' AND reading_date >= $2 AND reading_date <= $3
         ORDER BY reading_date DESC, created_at DESC
         LIMIT 1`,
        [unitNumber, periodStart, periodEnd],
      ),
    ]);

    const curRow = curRes.rows[0];
    const curValue = toNumberOrNull(curRow?.reading_value);
    if (curValue === null) {
      return { prev: null, cur: null, usage: null, reason: "missing current reading within billing window" };
    }
    const cur: ElectricityReading = {
      value: curValue,
      date: toDateOnlyString(curRow?.reading_date),
      source: "reading",
    };

    const prevRow = prevRes.rows[0];
    const prevValue = toNumberOrNull(prevRow?.reading_value);
    let prev: ElectricityReading | null =
      prevValue === null
        ? null
        : {
            value: prevValue,
            date: toDateOnlyString(prevRow?.reading_date),
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
    return { lineItem: null, debug, snapshot: null };
  }

  const rateCents = Math.round(rate * 100);

  if (!readings.prev) {
    const curValue = readings.cur.value;
    const total = 0;
    return {
      lineItem: {
        description: buildElectricityLineDescription({
          prevValue: null,
          prevDate: "Initial",
          curValue,
          curDate: readings.cur.date,
          usage: 0,
          rate,
          total,
          missingPrev: true,
        }),
        qty: 0,
        unit_cents: rateCents,
        total_cents: 0,
        meta: {
          kind: "METER_ELECTRICITY",
          prev: null,
          cur: curValue,
          usage: 0,
          unit_rate: rate,
          prev_date: "Initial",
          curr_date: readings.cur.date,
          amount: total,
          periodStart,
          periodEnd,
          sourcePrev: "missing",
        },
      },
      debug,
      snapshot: null,
    };
  }

  const usage = readings.usage ?? Math.max(0, Number((readings.cur.value - readings.prev.value).toFixed(2)));
  const totalCents = Math.round(usage * rateCents);
  const total = Number((totalCents / 100).toFixed(2));
  const prevLabel = formatReadingDate(readings.prev.date || "Initial");
  const curLabel = formatReadingDate(readings.cur.date || "");
  const sourcePrev = readings.prev.source === "initial" ? "baseline" : "reading";
  return {
    lineItem: {
      description: buildElectricityLineDescription({
        prevValue: readings.prev.value,
        prevDate: prevLabel,
        curValue: readings.cur.value,
        curDate: curLabel,
        usage,
        rate,
        total,
      }),
      qty: usage,
      unit_cents: rateCents,
      total_cents: totalCents,
      meta: {
        kind: "METER_ELECTRICITY",
        prev: readings.prev.value,
        prev_date: prevLabel,
        cur: readings.cur.value,
        curr_date: curLabel,
        usage,
        unit_rate: rate,
        amount: total,
        periodStart,
        periodEnd,
        sourcePrev,
      },
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

  const codedServices = services.filter((service) => String(service.code ?? "").trim().toUpperCase() === "ELECTRICITY");
  const namedServices = services.filter((service) => String(service.name ?? "").toLowerCase().includes("electric"));
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
    // Some live datasets have a valid electricity service/rate but incomplete unit/building assignments.
    // Fall back to the first configured electricity service so metered units still bill correctly.
    const fallbackService = electricityServices[0];
    const fallbackRate = fallbackService?.rate !== undefined ? Number(fallbackService.rate) : null;
    if (fallbackRate === null || !Number.isFinite(fallbackRate) || fallbackRate <= 0) {
      return { found: false, rate: null };
    }
    return { found: true, rate: fallbackRate, serviceId: String(fallbackService.id) };
  }

  const service = services.find((entry) => String(entry.id) === String(serviceId));
  const rate = service?.rate !== undefined ? Number(service.rate) : null;
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    return { found: true, rate: null, serviceId: String(serviceId) };
  }
  return { found: true, rate, serviceId: String(serviceId) };
}

async function buildAssignedServiceLineItems(input: {
  unitId: string;
  propertyId?: string | null;
  reference: Date;
}): Promise<GenericServiceLineItem[]> {
  const [rawServices, rawUnitServices, rawBuildingServices] = await Promise.all([
    datasetsRepo.getDataset<ServiceRecord[]>("services", []),
    datasetsRepo.getDataset<UnitServiceRecord[]>("unit_services", []),
    datasetsRepo.getDataset<BuildingServiceRecord[]>("building_services", []),
  ]);

  const services = normalizeServiceList(rawServices);
  const unitServices = normalizeUnitServices(rawUnitServices);
  const buildingServices = normalizeBuildingServices(rawBuildingServices);
  const effectiveBefore = new Date(Date.UTC(input.reference.getUTCFullYear(), input.reference.getUTCMonth() + 1, 1));
  const periodLabel = input.reference.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

  const isEffective = (startDate?: string | null) => {
    if (!startDate) return true;
    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) return true;
    return parsed < effectiveBefore;
  };

  const selected = new Map<string, { service: ServiceRecord; source: "unit" | "building" }>();

  unitServices
    .filter((entry) => entry.unitId === input.unitId && isEffective(entry.startDate))
    .forEach((entry) => {
      const service = services.find((item) => String(item.id) === String(entry.serviceId));
      if (!service || isElectricityService(service)) return;
      selected.set(String(service.id), { service, source: "unit" });
    });

  if (input.propertyId) {
    buildingServices
      .filter((entry) => String(entry.propertyId || "") === String(input.propertyId || "") && isEffective(entry.startDate))
      .forEach((entry) => {
        const service = services.find((item) => String(item.id) === String(entry.serviceId));
        if (!service || isElectricityService(service)) return;
        if (!selected.has(String(service.id))) {
          selected.set(String(service.id), { service, source: "building" });
        }
      });
  }

  return Array.from(selected.values())
    .map<GenericServiceLineItem | null>(({ service, source }) => {
      const rate = toNumberOrNull(service.rate);
      if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
      const unitCents = Math.round(rate * 100);
      return {
        description: `${String(service.name || "Service").trim()} (${periodLabel})`,
        qty: 1,
        unit_cents: unitCents,
        total_cents: unitCents,
        meta: {
          kind: "ASSIGNED_SERVICE",
          service_id: String(service.id),
          service_code: String(service.code || "").trim().toUpperCase() || null,
          service_name: String(service.name || "").trim() || "Service",
          assignment_source: source,
          service_type: service.type || null,
          service_unit: service.unit || null,
        },
      } satisfies GenericServiceLineItem;
    })
    .filter(isNonNull);
}

type StoredInvoice = {
  id: string;
  tenantId: string;
  tenantName: string;
  unitId: string;
  unitLabel: string;
  invoiceDate: string;
  total: number;
  rentAmount: number;
  cleaningAmount: number;
  electricityAmount: number;
  outstanding: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
  createdAt: string;
  updatedAt: string;
};

type StoredInvoiceDbRow = {
  id: string;
  tenant_id: string | null;
  unit_id: string | null;
  invoice_date: string | Date | null;
  due_date: string | Date | null;
  status: string | null;
  total_amount: string | number | null;
  total_cents: string | number | null;
  line_items: unknown;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  tenant_name?: string | null;
  tenant_unit?: string | null;
  unit_number?: string | number | null;
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

function normalizeStoredInvoiceStatus(value: unknown): StoredInvoice["status"] {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "paid") return "Paid";
  if (raw === "partially paid" || raw === "partial" || raw === "partially_paid") return "Partially Paid";
  return "Unpaid";
}

function deriveLineItemAmount(item: Record<string, unknown>) {
  return (
    ("amount" in item ? toNumberOrNull(item.amount) : null) ??
    ("total" in item ? toNumberOrNull(item.total) : null) ??
    ("total_cents" in item ? (toNumberOrNull(item.total_cents) ?? 0) / 100 : null) ??
    0
  );
}

function deriveStoredInvoiceAmounts(lineItems: unknown) {
  const totals = { rentAmount: 0, cleaningAmount: 0, electricityAmount: 0 };
  if (!Array.isArray(lineItems)) return totals;

  lineItems.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const record = item as Record<string, unknown>;
    const meta =
      record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
        ? (record.meta as Record<string, unknown>)
        : null;
    const kind = String(meta?.kind || "").trim().toUpperCase();
    const description = String(record.description || "").toLowerCase();
    const serviceCode = String(meta?.service_code || "").trim().toUpperCase();
    const serviceName = String(meta?.service_name || "").trim().toLowerCase();
    const amount = deriveLineItemAmount(record);

    if (kind === "RENT" || description.includes("rent")) {
      totals.rentAmount += amount;
      return;
    }

    if (
      kind === "METER_ELECTRICITY" ||
      serviceCode === "ELECTRICITY" ||
      serviceName.includes("electric") ||
      description.includes("electric")
    ) {
      totals.electricityAmount += amount;
      return;
    }

    if (
      serviceCode.includes("CLEAN") ||
      serviceName.includes("clean") ||
      description.includes("clean")
    ) {
      totals.cleaningAmount += amount;
    }
  });

  return {
    rentAmount: Number(totals.rentAmount.toFixed(2)),
    cleaningAmount: Number(totals.cleaningAmount.toFixed(2)),
    electricityAmount: Number(totals.electricityAmount.toFixed(2)),
  };
}

async function listStoredInvoicesFromDb(): Promise<StoredInvoice[]> {
  const { rows } = await query<StoredInvoiceDbRow>(
    `SELECT i.id, i.tenant_id, i.unit_id, i.invoice_date, i.due_date, i.status, i.total_amount, i.total_cents,
            i.line_items, i.created_at, i.updated_at,
            t.name AS tenant_name, t.unit AS tenant_unit,
            u.unit_number
     FROM public.invoices i
     LEFT JOIN public.tenants t ON t.id = i.tenant_id
     LEFT JOIN public.units u ON u.id = i.unit_id
     ORDER BY i.invoice_date DESC, i.created_at DESC, i.id DESC`,
  );

  return rows.map((row) => {
    const amounts = deriveStoredInvoiceAmounts(row.line_items);
    const total = toNumberOrNull(row.total_amount) ?? (toNumberOrNull(row.total_cents) ?? 0) / 100;
    const invoiceDate = toDateOnlyString(row.invoice_date || "") || "";
    const updatedAt = toDateOnlyString(row.updated_at || row.invoice_date || "") || invoiceDate;
    const createdAt = toDateOnlyString(row.created_at || row.invoice_date || "") || invoiceDate;
    const unitNumber = row.unit_number !== undefined && row.unit_number !== null ? String(row.unit_number).trim() : "";
    const tenantUnit = row.tenant_unit ? String(row.tenant_unit).trim() : "";

    return {
      id: String(row.id),
      tenantId: String(row.tenant_id || ""),
      tenantName: String(row.tenant_name || "Tenant"),
      unitId: String(row.unit_id || ""),
      unitLabel: unitNumber ? `Unit ${unitNumber}` : tenantUnit ? `Unit ${tenantUnit}` : "Unit",
      invoiceDate,
      total: Number(total.toFixed(2)),
      rentAmount: amounts.rentAmount,
      cleaningAmount: amounts.cleaningAmount,
      electricityAmount: amounts.electricityAmount,
      outstanding: Number(total.toFixed(2)),
      status: normalizeStoredInvoiceStatus(row.status),
      createdAt,
      updatedAt,
    };
  });
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

function formatInvoiceNumber(seq: number) {
  return `Inv-${String(seq).padStart(3, "0")}`;
}

function isFormattedInvoiceNumber(value: string | null | undefined) {
  return /^Inv-\d+$/.test(String(value || "").trim());
}

async function ensureInvoiceNumberRegistry() {
  await query(`CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq`);
  await query(
    `CREATE TABLE IF NOT EXISTS public.invoice_numbers (
      seq bigint PRIMARY KEY,
      invoice_number text NOT NULL UNIQUE,
      tenant_id text,
      unit text,
      property_id uuid,
      period text,
      issued_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
}

async function syncInvoiceNumberSequence() {
  await ensureInvoiceNumberRegistry();
  const { rows } = await query<{ max_seq: string | number | null }>(
    `SELECT GREATEST(
        COALESCE((SELECT MAX(seq) FROM public.invoice_numbers), 0),
        COALESCE((
          SELECT MAX((regexp_match(invoice_number, '^Inv-([0-9]+)$'))[1]::bigint)
          FROM public.invoices
          WHERE invoice_number ~ '^Inv-[0-9]+$'
        ), 0)
      ) AS max_seq`,
  );
  const maxSeq = Number(rows[0]?.max_seq ?? 0);
  if (maxSeq > 0) {
    await query(`SELECT setval('public.invoice_number_seq', $1, true)`, [maxSeq]);
    return;
  }
  await query(`SELECT setval('public.invoice_number_seq', 1, false)`);
}

async function allocateInvoiceNumber(input: {
  tenantId: string;
  unitLabel: string;
  propertyId?: string | null;
  period: string;
}) {
  await syncInvoiceNumberSequence();
  const seqRes = await query<{ seq: string | number }>(`SELECT nextval('public.invoice_number_seq') AS seq`);
  const seq = Number(seqRes.rows[0]?.seq ?? 0);
  const invoiceNumber = formatInvoiceNumber(seq);
  await query(
    `INSERT INTO public.invoice_numbers (seq, invoice_number, tenant_id, unit, property_id, period)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (seq) DO NOTHING`,
    [seq, invoiceNumber, input.tenantId, input.unitLabel, input.propertyId ?? null, input.period],
  );
  return invoiceNumber;
}

function parsePeriod(period?: string) {
  if (!period) return null;
  const trimmed = String(period).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const reference = new Date(Date.UTC(year, month - 1, 1));
  return { reference, periodKey: `${year}-${String(month).padStart(2, "0")}` };
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

function coerceLeaseStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function buildLeaseIndex(leases: LeaseAgreement[]) {
  const map = new Map<string, LeaseAgreement>();
  leases.forEach((lease) => {
    if (String(lease?.status || "").toLowerCase() !== "active") return;
    const unit = String(lease?.unit || "").trim();
    if (!unit) return;
    const property = String(lease?.property || "").trim().toLowerCase();
    const start = lease?.startDate ? new Date(lease.startDate).getTime() : 0;
    const key = `${property}::${unit}`.toLowerCase();
    const fallbackKey = `::${unit}`.toLowerCase();
    const existing = map.get(key);
    if (!existing || start >= (existing.startDate ? new Date(existing.startDate).getTime() : 0)) {
      map.set(key, lease);
    }
    const existingFallback = map.get(fallbackKey);
    if (!existingFallback || start >= (existingFallback.startDate ? new Date(existingFallback.startDate).getTime() : 0)) {
      map.set(fallbackKey, lease);
    }
  });
  return map;
}

export async function GET() {
  try {
    const data = await datasetsRepo.getDataset<StoredInvoice[]>(INVOICES_KEY, []);
    if (Array.isArray(data) && data.length) {
      return NextResponse.json({ ok: true, data });
    }

    try {
      const dbData = await listStoredInvoicesFromDb();
      if (dbData.length) {
        return NextResponse.json({ ok: true, data: dbData });
      }
    } catch (err) {
      console.warn("⚠️ failed to load bills from invoices table; falling back to dataset", err);
    }

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
      unit_ids?: string[];
      month?: string;
      year?: string;
      period?: string;
      electricityPeriod?: string;
      electricity_period?: string;
      meterSnapshot?: unknown;
      meter_snapshot?: unknown;
      lineItems?: {
        description?: string;
        qty?: number;
        unit_cents?: number;
        total_cents?: number;
        meta?: Record<string, unknown>;
      }[];
    };

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const debugEnabled = url.searchParams.get("debug") === "1";
    const payload = (await req.json().catch(() => ({}))) as BillsPayload;
    const unitIds =
      Array.isArray(payload?.unit_ids) && payload.unit_ids.length
        ? payload.unit_ids.filter(Boolean)
        : Array.isArray(payload?.unitIds)
          ? payload.unitIds.filter(Boolean)
          : [];

    const parsedPeriod = parsePeriod(payload?.period);
    const parsedElectricityPeriod = parsePeriod(payload?.electricityPeriod ?? payload?.electricity_period ?? payload?.period);
    const monthValue = payload?.month || "";
    const monthIndex = parsedPeriod ? parsedPeriod.reference.getUTCMonth() : toMonthIndex(monthValue);
    const year = parsedPeriod ? parsedPeriod.reference.getUTCFullYear() : Number(payload?.year);
    if (!unitIds.length) {
      return NextResponse.json({ ok: false, error: "Select at least one unit." }, { status: 400 });
    }
    if (unitIds.length !== 1) {
      return NextResponse.json({ ok: false, error: "Select a single unit to generate an invoice." }, { status: 400 });
    }

    if (monthIndex === null || !Number.isFinite(year)) {
      return NextResponse.json({ ok: false, error: "Invalid month or year." }, { status: 400 });
    }

    const reference = parsedPeriod?.reference ?? new Date(Date.UTC(year, monthIndex, 1));
    const periodKey = parsedPeriod?.periodKey ?? `${reference.getUTCFullYear()}-${String(reference.getUTCMonth() + 1).padStart(2, "0")}`;
    const electricityReference = parsedElectricityPeriod?.reference ?? reference;
    const electricityPeriodKey =
      parsedElectricityPeriod?.periodKey ??
      `${electricityReference.getUTCFullYear()}-${String(electricityReference.getUTCMonth() + 1).padStart(2, "0")}`;
    const { start, end } = monthRange(reference);
    const { start: electricityStart } = monthRange(electricityReference);
    const electricityStartKey = electricityStart.toISOString().slice(0, 10);
    const electricityEndExclusive = new Date(Date.UTC(electricityReference.getUTCFullYear(), electricityReference.getUTCMonth() + 1, 1));
    const electricityEndKey = electricityEndExclusive.toISOString().slice(0, 10);

    const [units, tenants, charges, leasesData] = await Promise.all([
      unitsRepo.listUnits(),
      tenantsRepo.listTenants(),
      datasetsRepo.getDataset<ChargeRow[]>("tenant_charges", []),
      datasetsRepo.getDataset<LeaseAgreement[]>("lease_agreements", []),
    ]);

    const tenantIndex = buildTenantIndex(tenants);

    const chargeIndex = new Map<
      string,
      Array<{ date: string; amount: number; description?: string; category?: string; meta?: Record<string, unknown> }>
    >();
    charges.forEach((row) => {
      const tenantId = String((row as any)?.tenant_id ?? "").trim();
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

    let lease: ResolvedLease | null = null;
    try {
      const leaseRes = await query(
        `SELECT id, tenant_id, rent, start_date, end_date, status
         FROM public.leases
         WHERE unit_id = $1 AND status = 'active'
         ORDER BY start_date DESC
         LIMIT 1`,
        [unit.id],
      );
      const dbLease = (leaseRes.rows[0] as LeaseRow | undefined) ?? null;
      if (dbLease) {
        lease = {
          ...dbLease,
          source: "db",
        };
      }
    } catch (err) {
      console.warn("⚠️ failed to load lease from db", err);
    }

    if (!lease) {
      const leaseIndex = buildLeaseIndex(Array.isArray(leasesData) ? leasesData : []);
      const propertyKey = String(unit.property_id || "").toLowerCase();
      const datasetLease =
        leaseIndex.get(`${propertyKey}::${unit.unit}`.toLowerCase()) ||
        leaseIndex.get(`::${unit.unit}`.toLowerCase()) ||
        null;

      if (datasetLease && coerceLeaseStatus(datasetLease.status) === "active") {
        const tenant =
          tenantIndex.get(`${propertyKey}::${unit.unit}`.toLowerCase()) ||
          tenantIndex.get(`::${unit.unit}`.toLowerCase()) ||
          tenants.find((row) => {
            const tenantUnit = String(row.unit || "").trim().toLowerCase();
            const tenantProperty = String(row.property_id || row.building || "").trim().toLowerCase();
            return tenantUnit === String(datasetLease.unit || "").trim().toLowerCase() &&
              (!propertyKey || !tenantProperty || tenantProperty === propertyKey);
          }) ||
          null;

        if (tenant) {
          lease = {
            id: String(datasetLease.id),
            tenant_id: String(tenant.id),
            rent: toNumberOrNull(datasetLease.rent),
            start_date: String(datasetLease.startDate || ""),
            end_date: datasetLease.endDate ? String(datasetLease.endDate) : null,
            status: String(datasetLease.status || "Active"),
            source: "dataset",
          };
        }
      }
    }

    if (!lease) {
      const response: Record<string, unknown> = {
        ok: false,
        error: "Unit is not ready: no active lease.",
        unit: { id: unit.id, unit: unit.unit },
        reason: "no active lease",
      };
      if (debugEnabled) {
        console.info("Bills debug", response);
        return NextResponse.json({ ...response, debug: { lease: null, lease_sources: ["db", "dataset"] } }, { status: 400 });
      }
      return NextResponse.json(response, { status: 400 });
    }

    const tenantId = String(lease.tenant_id ?? "").trim();
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Missing tenant_id on active lease." }, { status: 400 });
    }

    const tenant =
      tenants.find((row) => String(row.id) === tenantId) ||
      ({
        id: tenantId,
        name:
          lease.source === "dataset"
            ? (
                (Array.isArray(leasesData) ? leasesData : []).find((entry) => String(entry.id) === lease?.id)?.tenantName ||
                "Tenant"
              )
            : "Tenant",
        property_id: unit.property_id ?? null,
        building: null,
        unit: unit.unit,
        monthly_rent: null,
        due_day: null,
        reference: null,
      } satisfies TenantRecord);

    const rentValue = toNumberOrNull(lease.rent) ?? toNumberOrNull((tenant as any)?.monthly_rent) ?? 0;
    const rentCents = Math.round(rentValue * 100);
    const rentLabel = `Monthly Rent (${reference.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })})`;

    const { rows } = createStatement({
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
      includeRentCharges: false,
    });

    const rentLineItem: ElectricityLineItem = {
      description: rentLabel,
      qty: 1,
      unit_cents: rentCents,
      total_cents: rentCents,
      meta: { kind: "RENT" },
    };

    const { lineItems } = buildInvoiceLineItems(rows, reference);
    const extraLineItems = lineItems.map((item) => {
      const unitCents = toCents(item.rate);
      const qty = Number(item.qty || 0);
      return {
        description: item.description,
        qty,
        unit_cents: unitCents,
        total_cents: Math.round(qty * unitCents),
        meta: item.meta && typeof item.meta === "object" ? item.meta : null,
      };
    });

    const assignedServiceLineItems = await buildAssignedServiceLineItems({
      unitId: unit.id,
      propertyId: unit.property_id,
      reference,
    });

    // --- ELECTRICITY AUTO CALCULATION ---
    const periodStartKey = electricityStartKey;
    const periodEndKey = electricityEndKey;
    const lineItemsForInvoice = dedupeGeneratedLineItems([rentLineItem, ...assignedServiceLineItems, ...extraLineItems]);

    const electricityResult = await buildElectricityLineItem({
      unitId: unit.id,
      periodStart: periodStartKey,
      periodEnd: periodEndKey,
    });
    const electricity = electricityResult.lineItem;
    const electricityDebugPayload = {
      unitNumber: electricityResult.debug.unitNumber,
      rate: electricityResult.debug.rate,
      prev: electricityResult.debug.prev,
      cur: electricityResult.debug.cur,
      usage: electricityResult.debug.usage,
    };
    if (electricity) {
      lineItemsForInvoice.push(electricity);
    }
    const finalLineItemsForInvoice = dedupeGeneratedLineItems(lineItemsForInvoice);

    let meterSnapshot: MeterSnapshot | null = null;

    if (electricity) {
      const rate = electricity.unit_cents / 100;
      const meta = electricity.meta && typeof electricity.meta === "object" ? electricity.meta : null;
      const prevValue = electricityResult.snapshot?.prevReading ?? toNumberOrNull((meta as any)?.prev);
      const curValue = electricityResult.snapshot?.currReading ?? toNumberOrNull((meta as any)?.cur);
      const usageValue = electricityResult.snapshot?.usage ?? toNumberOrNull((meta as any)?.usage) ?? 0;
      const usage = Number.isFinite(Number(usageValue)) ? Number(usageValue) : 0;
      meterSnapshot = {
        service: "ELECTRICITY",
        unit: electricityResult.debug.unitNumber || unit.unit || "",
        prev_reading: prevValue ?? null,
        prev_date: electricityResult.snapshot?.prevDate ?? String((meta as any)?.prev_date ?? ""),
        cur_reading: curValue ?? null,
        cur_date: electricityResult.snapshot?.currDate ?? String((meta as any)?.curr_date ?? ""),
        usage,
        rate,
        amount: Number((usage * rate).toFixed(2)),
        unit_label: "kWh",
      };
    }
    const requestedMeterSnapshot = normalizeMeterSnapshotInput(payload?.meterSnapshot ?? payload?.meter_snapshot ?? null);
    if (requestedMeterSnapshot) {
      meterSnapshot = requestedMeterSnapshot;
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
      electricityPeriod: electricityPeriodKey,
      lineItems: finalLineItemsForInvoice,
      meterSnapshot,
    };

    if (dryRun) {
      const response: Record<string, unknown> = { ok: true, mode: "preview", draft };
      if (debugEnabled) {
        response.debug = {
          lease: {
            id: lease.id,
            tenant_id: tenantId,
            rent: rentValue,
            source: lease.source,
          },
          meter: electricityDebugPayload,
          invoice: {
            tenant_id: tenantId,
            unit_id: unit.id,
            period: periodKey,
            electricity_period: electricityPeriodKey,
            total_cents: finalLineItemsForInvoice.reduce((sum, row) => sum + Number(row.total_cents || 0), 0),
            line_items: finalLineItemsForInvoice,
            meter_snapshot: meterSnapshot,
          },
        };
        response.lineItems = finalLineItemsForInvoice;
        console.info("Bills debug", response.debug);
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
        const meta = item?.meta && typeof item.meta === "object" ? item.meta : null;
        return {
          description,
          qty,
          unit_cents: unitCents,
          total_cents: totalCents,
          meta,
        };
      })
      .filter((item) => item.description);

    const totalCents = normalizedLineItems.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
    const lineItemsJson = normalizedLineItems.map((item, index) => ({
      id: `line-${index + 1}`,
      description: item.description,
      qty: Number(item.qty || 0),
      rate: Number(((item.unit_cents || 0) / 100).toFixed(2)),
      amount: Number(((item.total_cents || 0) / 100).toFixed(2)),
      meta: item.meta ?? undefined,
    }));
    const id = stableUuid(`inv-${unit.id}-${periodKey}`);
    let savedInvoiceId = id;
    const invoicePayload = {
      id,
      tenant_id: tenantId,
      unit_id: unit.id,
      invoice_number: null as string | null,
      invoice_date: invoiceDate.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      status: "draft",
      currency: "USD",
      subtotal_cents: totalCents,
      tax_cents: 0,
      total_cents: totalCents,
      notes: null,
      meta: meterSnapshot ? { meter_snapshot: meterSnapshot } : null,
      period: periodKey,
      line_items: lineItemsJson,
      meter_snapshot: meterSnapshot,
      total_amount: Number((totalCents / 100).toFixed(2)),
    };
    const invoiceMetaJson = invoicePayload.meta ? JSON.stringify(invoicePayload.meta) : null;
    const lineItemsJsonb = JSON.stringify(invoicePayload.line_items);
    const meterSnapshotJson = invoicePayload.meter_snapshot ? JSON.stringify(invoicePayload.meter_snapshot) : null;

    try {
      await query("BEGIN");
      const existingInvoiceRes = await query<{ id: string; invoice_number: string | null }>(
        `SELECT id, invoice_number
         FROM public.invoices
         WHERE unit_id = $1 AND period = $2
         LIMIT 1`,
        [unit.id, periodKey],
      );
      const existingInvoiceNumber = existingInvoiceRes.rows[0]?.invoice_number ?? null;
      invoicePayload.invoice_number =
        (isFormattedInvoiceNumber(existingInvoiceNumber) ? existingInvoiceNumber : null) ||
        (await allocateInvoiceNumber({
          tenantId,
          unitLabel: unit.unit,
          propertyId: unit.property_id,
          period: periodKey,
        }));
      const invoiceRes = await query(
        `INSERT INTO public.invoices (id, tenant_id, unit_id, invoice_number, invoice_date, due_date, status, currency, subtotal_cents, tax_cents, total_cents, notes, meta, period, line_items, meter_snapshot, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17)
         ON CONFLICT (unit_id, period) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           invoice_number = CASE
             WHEN public.invoices.invoice_number ~ '^Inv-[0-9]+$' THEN public.invoices.invoice_number
             ELSE EXCLUDED.invoice_number
           END,
           invoice_date = EXCLUDED.invoice_date,
           due_date = EXCLUDED.due_date,
           status = EXCLUDED.status,
           currency = EXCLUDED.currency,
           subtotal_cents = EXCLUDED.subtotal_cents,
           tax_cents = EXCLUDED.tax_cents,
           total_cents = EXCLUDED.total_cents,
           notes = EXCLUDED.notes,
           meta = EXCLUDED.meta,
           line_items = EXCLUDED.line_items,
           meter_snapshot = EXCLUDED.meter_snapshot,
           total_amount = EXCLUDED.total_amount
         RETURNING id, invoice_number`,
        [
          invoicePayload.id,
          invoicePayload.tenant_id,
          invoicePayload.unit_id,
          invoicePayload.invoice_number,
          invoicePayload.invoice_date,
          invoicePayload.due_date,
          invoicePayload.status,
          invoicePayload.currency,
          invoicePayload.subtotal_cents,
          invoicePayload.tax_cents,
          invoicePayload.total_cents,
          invoicePayload.notes,
          invoiceMetaJson,
          invoicePayload.period,
          lineItemsJsonb,
          meterSnapshotJson,
          invoicePayload.total_amount,
        ],
      );
      const invoiceId = String(invoiceRes.rows[0]?.id ?? id);
      savedInvoiceId = invoiceId;
      await query(`DELETE FROM public.invoice_lines WHERE invoice_id = $1`, [invoiceId]);
      if (normalizedLineItems.length) {
        const values: any[] = [];
        const placeholders = normalizedLineItems
          .map((row, idx) => {
            const offset = idx * 7;
            values.push(
              invoiceId,
              idx,
              row.description,
              row.qty,
              row.unit_cents,
              row.total_cents,
              row.meta ? JSON.stringify(row.meta) : null,
            );
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}::jsonb)`;
          })
          .join(",");
        await query(
          `INSERT INTO public.invoice_lines (invoice_id, line_index, description, quantity, unit_price_cents, total_cents, meta)
           VALUES ${placeholders}`,
          values,
        );
      }
      await query("COMMIT");
      if (debugEnabled) {
        console.info("Bills debug", {
          lease: { id: lease.id, tenant_id: tenantId, rent: rentValue, source: lease.source },
          meter: electricityDebugPayload,
          invoice: invoicePayload,
        });
      }
    } catch (err) {
      try {
        await query("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
      throw err;
    }

    const rentCentsTotal = normalizedLineItems
      .filter((item) => (item.meta as any)?.kind === "RENT")
      .reduce((sum, item) => sum + item.total_cents, 0);
    const cleaningCentsTotal = normalizedLineItems
      .filter((item) => {
        const meta = item.meta as Record<string, unknown> | null | undefined;
        const serviceCode = String(meta?.service_code || "").trim().toUpperCase();
        const serviceName = String(meta?.service_name || "").trim().toLowerCase();
        const description = String(item.description || "").toLowerCase();
        return serviceCode.includes("CLEAN") || serviceName.includes("clean") || description.includes("clean");
      })
      .reduce((sum, item) => sum + item.total_cents, 0);
    const electricityCentsTotal = normalizedLineItems
      .filter((item) => {
        const meta = item.meta as Record<string, unknown> | null | undefined;
        const kind = String(meta?.kind || "").trim().toUpperCase();
        const serviceCode = String(meta?.service_code || "").trim().toUpperCase();
        const serviceName = String(meta?.service_name || "").trim().toLowerCase();
        const description = String(item.description || "").toLowerCase();
        return (
          kind === "METER_ELECTRICITY" ||
          serviceCode === "ELECTRICITY" ||
          serviceName.includes("electric") ||
          description.includes("electric")
        );
      })
      .reduce((sum, item) => sum + item.total_cents, 0);

    const created: StoredInvoice = {
      id: savedInvoiceId,
      tenantId,
      tenantName: tenant.name,
      unitId: unit.id,
      unitLabel: unit.unit ? `Unit ${unit.unit}` : `Unit ${unit.id}`,
      invoiceDate: invoiceDate.toISOString().slice(0, 10),
      total: Number((totalCents / 100).toFixed(2)),
      rentAmount: Number((rentCentsTotal / 100).toFixed(2)),
      cleaningAmount: Number((cleaningCentsTotal / 100).toFixed(2)),
      electricityAmount: Number((electricityCentsTotal / 100).toFixed(2)),
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

    const response: Record<string, unknown> = { ok: true, invoiceId: savedInvoiceId, data: updated, created: [created] };
    if (debugEnabled) {
      response.debug = {
        lease: { id: lease.id, tenant_id: tenantId, rent: rentValue, source: lease.source },
        meter: electricityDebugPayload,
        invoice: invoicePayload,
      };
      response.lineItems = finalLineItemsForInvoice;
    }
    return NextResponse.json(response);
  } catch (err) {
    const code = (err as any)?.code;
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ failed to generate bills", { message, code });
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
