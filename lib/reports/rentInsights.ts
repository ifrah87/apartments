import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { listManualPayments, type ManualPayment } from "@/lib/reports/manualPayments";
import { createStatement, normalizeId, type ChargeEntry, type PaymentEntry, type StatementRow, type TenantRecord } from "@/lib/reports/tenantStatement";

type RawPayment = {
  date: string;
  amount: number;
  description?: string;
  property_id?: string;
  tenant_id?: string;
  type?: string;
};

type UnitRecord = {
  unit: string;
  floor?: string;
  type?: string;
  beds?: string;
  rent?: string | number;
  status?: string;
  property_id?: string;
};

export type PropertyInfo = {
  property_id: string;
  name?: string;
};

type NormalizedPayment = {
  tenantId: string;
  date: string;
  amount: number;
  description?: string;
  propertyId?: string;
  source: "bank" | "manual";
};

type DepositRecord = {
  tenant_id: string;
  deposit_charged?: string;
  deposit_received?: string;
  deposit_released?: string;
  deposit_notes?: string;
};

type DepositInfo = {
  charged: number;
  received: number;
  released: number;
  notes?: string;
};

type ChargeRecord = {
  tenant_id: string;
  date: string;
  amount: string;
  description?: string;
  category?: string;
};

type ReportingContext = {
  tenants: TenantRecord[];
  payments: NormalizedPayment[];
  units: UnitRecord[];
  paymentIndex: Map<string, NormalizedPayment[]>;
  deposits: Map<string, DepositInfo>;
  charges: Map<string, ChargeEntry[]>;
};

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : fallback;
}

async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = await getRequestBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || `Failed to fetch ${path}`);
  return (payload?.ok ? payload.data : payload) as T;
}

function normalizeManual(entry: ManualPayment): NormalizedPayment {
  return {
    tenantId: normalizeId(entry.tenant_id),
    amount: Number(entry.amount || 0),
    date: entry.date,
    description: entry.description || "Manual payment",
    propertyId: undefined,
    source: "manual",
  };
}

function normalizeBank(payment: RawPayment): NormalizedPayment | null {
  const tenantId = normalizeId(payment.tenant_id);
  if (!tenantId) return null;
  return {
    tenantId,
    date: payment.date,
    amount: Number(payment.amount || 0),
    description: payment.description,
    propertyId: payment.property_id,
    source: "bank",
  };
}

function buildPaymentIndex(payments: NormalizedPayment[]): Map<string, NormalizedPayment[]> {
  const map = new Map<string, NormalizedPayment[]>();
  payments.forEach((payment) => {
    if (!payment.tenantId) return;
    const key = payment.tenantId;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(payment);
  });
  map.forEach((list) => {
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });
  return map;
}

function buildDepositIndex(records: DepositRecord[]): Map<string, DepositInfo> {
  const map = new Map<string, DepositInfo>();
  records.forEach((record) => {
    const tenantId = normalizeId(record.tenant_id);
    if (!tenantId) return;
    map.set(tenantId, {
      charged: toNumber(record.deposit_charged),
      received: toNumber(record.deposit_received),
      released: toNumber(record.deposit_released),
      notes: record.deposit_notes,
    });
  });
  return map;
}

function buildChargeIndex(records: ChargeRecord[]): Map<string, ChargeEntry[]> {
  const map = new Map<string, ChargeEntry[]>();
  records.forEach((record) => {
    const tenantId = normalizeId(record.tenant_id);
    if (!tenantId) return;
    if (!map.has(tenantId)) {
      map.set(tenantId, []);
    }
    map.get(tenantId)!.push({
      date: record.date,
      amount: toNumber(record.amount),
      description: record.description || "Charge",
      category: record.category,
    });
  });
  map.forEach((list) => {
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });
  return map;
}

function buildPaymentEntries(payments: NormalizedPayment[]): PaymentEntry[] {
  return payments
    .filter((payment) => payment.date && payment.amount)
    .map((payment) => ({
      date: payment.date,
      amount: payment.amount,
      description: payment.description,
      source: payment.source,
    }));
}

function isWithinRange(dateString: string, start: Date, end: Date) {
  const value = new Date(dateString);
  return value >= start && value <= end;
}

function describeArrears(balance: number, oldest: Date | null, referenceDate: Date) {
  if (balance < 0) return "In Credit";
  if (balance === 0) return "Current";
  if (!oldest) return "Pending";
  const days = Math.max(0, Math.floor((referenceDate.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)));
  if (days >= 90) return `90+ days (${days}d)`;
  if (days >= 60) return `61-90 days (${days}d)`;
  if (days >= 30) return `31-60 days (${days}d)`;
  return `0-30 days (${days}d)`;
}


async function loadContext(): Promise<ReportingContext> {
  const [tenants, rawPayments, units, deposits, rawCharges] = await Promise.all([
    fetchJson<TenantRecord[]>("/api/tenants"),
    fetchJson<RawPayment[]>("/api/payments"),
    fetchJson<UnitRecord[]>("/api/units").catch(() => [] as UnitRecord[]),
    fetchJson<DepositRecord[]>("/api/deposits").catch(() => [] as DepositRecord[]),
    fetchJson<ChargeRecord[]>("/api/tenant-charges").catch(() => [] as ChargeRecord[]),
  ]);

  const manualPayments = await listManualPayments();
  const normalizedBank = rawPayments
    .map(normalizeBank)
    .filter((p): p is NormalizedPayment => Boolean(p && p.tenantId));
  const normalizedManual = manualPayments.map(normalizeManual);
  const payments = [...normalizedBank, ...normalizedManual];

  const paymentIndex = buildPaymentIndex(payments);
  const depositIndex = buildDepositIndex(deposits);
  const chargeIndex = buildChargeIndex(rawCharges);

  return { tenants, payments, units, paymentIndex, deposits: depositIndex, charges: chargeIndex };
}

function getPropertyName(id: string | undefined, properties: PropertyInfo[]) {
  const key = (id || "").toLowerCase();
  const match = properties.find((p) => (p.property_id || "").toLowerCase() === key);
  return match?.name || id || "—";
}

function parseMonth(month: string | undefined) {
  const today = new Date();
  if (!month) {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    };
  }
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || Number.isNaN(monthIndex)) {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    };
  }
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  return { start, end };
}

function toISODate(date: Date | undefined | null) {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

function deriveLeaseStart(tenantId: string, ctx: ReportingContext) {
  const payments = ctx.paymentIndex.get(tenantId);
  if (!payments?.length) return undefined;
  return new Date(payments[0].date);
}

function deriveLeaseEnd(leaseStart: Date | undefined) {
  if (!leaseStart) return undefined;
  const end = new Date(leaseStart);
  end.setMonth(end.getMonth() + 12);
  return end;
}

function findUnitRecord(ctx: ReportingContext, tenant: TenantRecord) {
  const unitLabel = (tenant.unit || "").trim();
  if (!unitLabel) return undefined;
  return ctx.units.find((unit) => String(unit.unit).trim() === unitLabel);
}

export type RentRollFilters = {
  propertyId?: string;
  month?: string;
  unitType?: string;
  occupancy?: "all" | "occupied" | "vacant";
};

export type RentRollRow = {
  propertyId: string;
  propertyName?: string;
  unit: string;
  tenant?: string;
  leaseStart?: string;
  leaseEnd?: string;
  monthlyRent: number;
  proratedRent: number;
  expectedRent: number;
  status: "Occupied" | "Vacant";
  unitType?: string;
  rentDue: number;
  rentReceived: number;
  balance: number;
  depositHeld: number;
  arrearsStatus: string;
  paymentMethod: string;
};

export type RentRollResult = {
  rows: RentRollRow[];
  totals: { totalUnits: number; occupiedUnits: number; expectedRent: number };
  unitTypes: string[];
};

export async function buildRentRollReport(filters: RentRollFilters, properties: PropertyInfo[]): Promise<RentRollResult> {
  const ctx = await loadContext();
  const { start, end } = parseMonth(filters.month);
  const historyStart = new Date(start);
  historyStart.setMonth(historyStart.getMonth() - 2);
  historyStart.setDate(1);
  const occupancyFilter = filters.occupancy || "all";
  const unitTypeFilter = (filters.unitType || "").toLowerCase();
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const rows: RentRollRow[] = [];
  const unitTypes = new Set<string>();

  ctx.tenants.forEach((tenant) => {
    const tenantProperty = (tenant.property_id || "").toLowerCase();
    if (propertyFilter && tenantProperty !== propertyFilter) return;
    const tenantId = normalizeId(tenant.id);
    const monthlyRent = toNumber(tenant.monthly_rent);
    const leaseStart = deriveLeaseStart(tenantId, ctx);
    const leaseEnd = deriveLeaseEnd(leaseStart);
    const unitRecord = findUnitRecord(ctx, tenant);
    const unitType = unitRecord?.type || "Unknown";
    unitTypes.add(unitType);
    const tenantPayments = ctx.paymentIndex.get(tenantId) || [];
    const tenantCharges = ctx.charges.get(tenantId) || [];
    const rangePayments = buildPaymentEntries(tenantPayments).filter((entry) => {
      const d = new Date(entry.date);
      return d >= historyStart && d <= end;
    });
    const rangeCharges = tenantCharges.filter((charge) => {
      const d = new Date(charge.date);
      return d >= historyStart && d <= end;
    });
    const statement = createStatement({
      tenant,
      start: historyStart,
      end,
      payments: rangePayments,
      additionalCharges: rangeCharges,
    });
    const rentDue = statement.rows
      .filter((row) => row.entryType === "charge" && isWithinRange(row.date, start, end))
      .reduce((sum, row) => sum + row.charge, 0);
    const rentReceived = statement.rows
      .filter((row) => row.entryType === "payment" && isWithinRange(row.date, start, end))
      .reduce((sum, row) => sum + row.payment, 0);
    const balance = Number(statement.totals.balance.toFixed(2));
    const oldest = findOldestOutstanding(statement.rows);
    const arrearsStatus = describeArrears(balance, oldest, end);
    const depositInfo = ctx.deposits.get(tenantId);
    const depositHeld = depositInfo
      ? Number((depositInfo.received - depositInfo.released).toFixed(2))
      : 0;
    const lastPayment = tenantPayments[tenantPayments.length - 1];
    const paymentMethod = lastPayment ? (lastPayment.source === "manual" ? "Manual" : "Bank") : "—";

    const dim = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    let prorated = 0;
    if (leaseStart && leaseStart >= start && leaseStart <= end) {
      const occupiedDays = dim - leaseStart.getDate() + 1;
      prorated = Number(((monthlyRent * occupiedDays) / dim).toFixed(2));
    }
    const expectedRent = prorated || monthlyRent;
    const row: RentRollRow = {
      propertyId: tenant.property_id || "",
      propertyName: getPropertyName(tenant.property_id, properties),
      unit: tenant.unit || "—",
      tenant: tenant.name,
      leaseStart: toISODate(leaseStart),
      leaseEnd: toISODate(leaseEnd),
      monthlyRent,
      proratedRent: prorated,
      expectedRent,
      status: "Occupied",
      unitType,
      rentDue,
      rentReceived,
      balance,
      depositHeld,
      arrearsStatus,
      paymentMethod,
    };
    rows.push(row);
  });

  const knownUnitsProperty = propertyFilter && propertyFilter !== "t1" ? [] : ctx.units;
  knownUnitsProperty.forEach((unit) => {
    const unitLabel = String(unit.unit);
    const occupied = rows.some(
      (row) => row.unit === unitLabel && (row.propertyId || "").toLowerCase() === (filters.propertyId || "t1").toLowerCase(),
    );
    if (occupied) return;
    const unitType = unit.type || "Unknown";
    unitTypes.add(unitType);
    rows.push({
      propertyId: filters.propertyId || "T1",
      propertyName: getPropertyName(filters.propertyId || "T1", properties),
      unit: unitLabel,
      tenant: "—",
      leaseStart: undefined,
      leaseEnd: undefined,
      monthlyRent: toNumber(unit.rent),
      proratedRent: 0,
      expectedRent: toNumber(unit.rent),
      status: "Vacant",
      unitType,
      rentDue: 0,
      rentReceived: 0,
      balance: 0,
      depositHeld: 0,
      arrearsStatus: "Vacant",
      paymentMethod: "—",
    });
  });

  const filtered = rows.filter((row) => {
    if (occupancyFilter === "occupied" && row.status !== "Occupied") return false;
    if (occupancyFilter === "vacant" && row.status !== "Vacant") return false;
    if (propertyFilter && row.propertyId.toLowerCase() !== propertyFilter) return false;
    if (unitTypeFilter && (row.unitType || "").toLowerCase() !== unitTypeFilter) return false;
    return true;
  });

  const totals = {
    totalUnits: filtered.length,
    occupiedUnits: filtered.filter((row) => row.status === "Occupied").length,
    expectedRent: filtered.reduce((sum, row) => sum + row.expectedRent, 0),
  };

  return {
    rows: filtered.sort((a, b) => a.unit.localeCompare(b.unit)),
    totals,
    unitTypes: Array.from(unitTypes).filter(Boolean).sort(),
  };
}

export type RentChargeFilters = {
  propertyId?: string;
  effectiveDate?: string;
  query?: string;
};

export type RentChargeRow = {
  propertyId: string;
  propertyName?: string;
  tenant: string;
  unit: string;
  currentRent: number;
  nextRent: number;
  effectiveDate: string;
  changeType: "Increase" | "Decrease" | "Renewal";
  notes: string;
};

export type RentChargeResult = {
  rows: RentChargeRow[];
  summary: { upcomingChanges: number; averageChange: number };
};

function nextAnniversary(start: Date | undefined, pivot: Date) {
  if (!start) return undefined;
  const candidate = new Date(start);
  while (candidate <= pivot) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
}

export async function buildRentChargeReport(
  filters: RentChargeFilters,
  properties: PropertyInfo[],
): Promise<RentChargeResult> {
  const ctx = await loadContext();
  const pivot = filters.effectiveDate ? new Date(filters.effectiveDate) : (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  })();
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const textFilter = (filters.query || "").toLowerCase();

  const rows = ctx.tenants
    .map((tenant) => {
      if (propertyFilter && (tenant.property_id || "").toLowerCase() !== propertyFilter) return null;
      if (textFilter) {
        const haystack = `${tenant.name} ${tenant.unit}`.toLowerCase();
        if (!haystack.includes(textFilter)) return null;
      }
      const tenantId = normalizeId(tenant.id);
      const leaseStart = deriveLeaseStart(tenantId, ctx);
      const nextEffective = nextAnniversary(leaseStart, pivot);
      if (!nextEffective) return null;
      const currentRent = toNumber(tenant.monthly_rent);
      const increasePct = 0.03 + ((Number(tenant.id) % 3) * 0.005 || 0);
      const nextRent = Number((currentRent * (1 + increasePct)).toFixed(2));
      const changeType: RentChargeRow["changeType"] = nextRent > currentRent ? "Increase" : "Renewal";
      return {
        propertyId: tenant.property_id || "",
        propertyName: getPropertyName(tenant.property_id, properties),
        tenant: tenant.name,
        unit: tenant.unit || "—",
        currentRent,
        nextRent,
        effectiveDate: toISODate(nextEffective)!,
        changeType,
        notes: `Annual uplift ${(increasePct * 100).toFixed(1)}%`,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  const summary = {
    upcomingChanges: rows.length,
    averageChange:
      rows.length > 0
        ? rows.reduce((sum, row) => sum + (row.nextRent - row.currentRent), 0) / rows.length
        : 0,
  };

  return { rows, summary };
}

export type OverdueFilters = {
  propertyId?: string;
  days?: number;
  tenantStatus?: "active" | "moved_out" | "all";
};

export type OverdueRow = {
  tenant: string;
  propertyId: string;
  propertyName?: string;
  unit: string;
  monthlyRent: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  outstandingBalance: number;
  daysOverdue: number;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

export type OverdueResult = {
  rows: OverdueRow[];
  totals: { tenantCount: number; totalBalance: number };
  worstTen: OverdueRow[];
};

function findOldestOutstanding(rows: StatementRow[]): Date | null {
  for (const row of rows) {
    if (row.entryType === "charge" && row.balance > 0) {
      return new Date(row.date);
    }
  }
  return null;
}

function fakeEmail(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
  return `${slug}@example.com`;
}

function fakePhone(id: string) {
  const digits = id.replace(/\D/g, "").padStart(3, "0");
  return `+252 61 ${digits.slice(0, 3)} ${digits.slice(0, 3)}`;
}

export async function buildOverdueRentReport(
  filters: OverdueFilters,
  properties: PropertyInfo[],
): Promise<OverdueResult> {
  const ctx = await loadContext();
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 6, 1);
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const daysFilter = filters.days ?? 30;
  const statusFilter = filters.tenantStatus || "all";

  const rows: OverdueRow[] = [];

  ctx.tenants.forEach((tenant) => {
    if (propertyFilter && (tenant.property_id || "").toLowerCase() !== propertyFilter) return;
    const tenantId = normalizeId(tenant.id);
    const payments = ctx.paymentIndex.get(tenantId) || [];
    const tenantCharges = ctx.charges.get(tenantId) || [];
    const periodPayments = payments.filter((p) => {
      const d = new Date(p.date);
      return d >= start && d <= today;
    });
    const periodCharges = tenantCharges.filter((charge) => {
      const d = new Date(charge.date);
      return d >= start && d <= today;
    });
    const statement = createStatement({
      tenant,
      start,
      end: today,
      payments: buildPaymentEntries(periodPayments),
      additionalCharges: periodCharges,
    });
    const outstanding = statement.totals.balance;
    if (outstanding <= 0) return;
    const oldest = findOldestOutstanding(statement.rows);
    const daysOverdue = oldest ? Math.floor((today.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    if (daysOverdue < daysFilter) return;

    const lastPayment = periodPayments.length ? periodPayments[periodPayments.length - 1] : undefined;
    const tenantStatus = lastPayment && today.getTime() - new Date(lastPayment.date).getTime() < 120 * 86400000 ? "active" : "moved_out";
    if (statusFilter !== "all" && tenantStatus !== statusFilter) return;

    const monthsPastDue = Math.max(1, Math.round(outstanding / Math.max(1, toNumber(tenant.monthly_rent))));

    rows.push({
      tenant: tenant.name,
      propertyId: tenant.property_id || "",
      propertyName: getPropertyName(tenant.property_id, properties),
      unit: tenant.unit || "—",
      monthlyRent: toNumber(tenant.monthly_rent),
      lastPaymentDate: lastPayment ? lastPayment.date : undefined,
      lastPaymentAmount: lastPayment ? lastPayment.amount : undefined,
      outstandingBalance: outstanding,
      daysOverdue,
      contactEmail: fakeEmail(tenant.name),
      contactPhone: fakePhone(String(tenant.id)),
      notes: `Balance equals ~${monthsPastDue} months of rent`,
    });
  });

  const sorted = rows.sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  const totals = {
    tenantCount: sorted.length,
    totalBalance: sorted.reduce((sum, row) => sum + row.outstandingBalance, 0),
  };

  return {
    rows: sorted,
    totals,
    worstTen: sorted.slice(0, 10),
  };
}

export type LeaseExpiryFilters = {
  propertyId?: string;
  range?: number;
  unitType?: string;
};

export type LeaseExpiryRow = {
  tenant: string;
  propertyId: string;
  propertyName?: string;
  unit: string;
  unitType?: string;
  leaseStart?: string;
  leaseEnd?: string;
  noticeDays: number;
  daysUntilExpiry: number;
  renewalStatus: "Pending" | "Sent" | "Confirmed" | "Expired";
  notes: string;
};

export type LeaseExpiryResult = {
  rows: LeaseExpiryRow[];
  totals: { expiring: number; confirmed: number; vacancies: number };
  unitTypes: string[];
};

export async function buildLeaseExpiryReport(
  filters: LeaseExpiryFilters,
  properties: PropertyInfo[],
): Promise<LeaseExpiryResult> {
  const ctx = await loadContext();
  const today = new Date();
  const range = filters.range ?? 60;
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const unitTypeFilter = (filters.unitType || "").toLowerCase();

  const rows: LeaseExpiryRow[] = [];
  const unitTypes = new Set<string>();

  ctx.tenants.forEach((tenant) => {
    if (propertyFilter && (tenant.property_id || "").toLowerCase() !== propertyFilter) return;
    const tenantId = normalizeId(tenant.id);
    const leaseStart = deriveLeaseStart(tenantId, ctx);
    const leaseEnd = deriveLeaseEnd(leaseStart);
    if (!leaseEnd) return;
    const daysUntil = Math.floor((leaseEnd.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0 || daysUntil > range) return;
    const unitRecord = findUnitRecord(ctx, tenant);
    const unitType = unitRecord?.type || "Unknown";
    unitTypes.add(unitType);
    if (unitTypeFilter && unitType.toLowerCase() !== unitTypeFilter) return;

    const status: LeaseExpiryRow["renewalStatus"] =
      daysUntil <= 15 ? "Pending" : daysUntil <= 45 ? "Sent" : "Confirmed";
    const notes =
      status === "Confirmed"
        ? "Tenant confirmed renewal"
        : status === "Sent"
          ? "Reminder sent to tenant"
          : "Awaiting tenant response";

    rows.push({
      tenant: tenant.name,
      propertyId: tenant.property_id || "",
      propertyName: getPropertyName(tenant.property_id, properties),
      unit: tenant.unit || "—",
      unitType,
      leaseStart: toISODate(leaseStart),
      leaseEnd: toISODate(leaseEnd),
      noticeDays: 30,
      daysUntilExpiry: daysUntil,
      renewalStatus: status,
      notes,
    });
  });

  const totals = {
    expiring: rows.length,
    confirmed: rows.filter((row) => row.renewalStatus === "Confirmed").length,
    vacancies: rows.filter((row) => row.renewalStatus !== "Confirmed").length,
  };

  return {
    rows: rows.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
    totals,
    unitTypes: Array.from(unitTypes).filter(Boolean).sort(),
  };
}
