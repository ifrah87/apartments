import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { listManualPayments } from "@/lib/reports/manualPayments";
import { normalizeId, type TenantRecord } from "@/lib/reports/tenantStatement";

type PropertyInfo = { property_id: string; name?: string };

type UnitInventory = {
  property_id: string;
  unit: string;
  unit_type?: string;
  beds?: string;
  floor?: string;
  rent?: string;
  status?: string;
};

type RawPayment = {
  date: string;
  amount: number;
  description?: string;
  tenant_id?: string;
  property_id?: string;
};

type RawExpense = {
  property_id: string;
  unit: string;
  date: string;
  amount: string;
  category?: string;
  description?: string;
};

type NormalizedPayment = {
  tenantId: string;
  amount: number;
  date: string;
  source: "bank" | "manual";
};

export type UnitFinancialFilters = {
  propertyId?: string;
  start?: string;
  end?: string;
};

export type UnitFinancialRow = {
  propertyId: string;
  propertyName?: string;
  unit: string;
  tenant?: string;
  unitType?: string;
  rentCollected: number;
  expenses: number;
  net: number;
  status?: string;
};

export type UnitFinancialReportResult = {
  rows: UnitFinancialRow[];
  totals: { rentCollected: number; expenses: number; net: number };
};

async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = await getRequestBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || `Failed to fetch ${path}`);
  return (payload?.ok ? payload.data : payload) as T;
}

function toNumber(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function withinRange(date: Date, start?: Date, end?: Date) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function normalizeBankPayment(payment: RawPayment): NormalizedPayment | null {
  const tenantId = normalizeId(payment.tenant_id);
  if (!tenantId) return null;
  return {
    tenantId,
    amount: Number(payment.amount || 0),
    date: payment.date,
    source: "bank",
  };
}

function groupPayments(payments: NormalizedPayment[], start?: Date, end?: Date) {
  const map = new Map<string, number>();
  payments.forEach((payment) => {
    const date = new Date(payment.date);
    if (Number.isNaN(date.getTime()) || !withinRange(date, start, end)) return;
    const current = map.get(payment.tenantId) || 0;
    map.set(payment.tenantId, Number((current + payment.amount).toFixed(2)));
  });
  return map;
}

function unitKey(propertyId: string | undefined, unit: string | undefined) {
  return `${(propertyId || "").toLowerCase()}::${(unit || "").toLowerCase()}`;
}

function getPropertyName(id: string | undefined, properties: PropertyInfo[]) {
  if (!id) return undefined;
  const match = properties.find((p) => (p.property_id || "").toLowerCase() === id.toLowerCase());
  return match?.name || id;
}

export async function buildUnitFinancialReport(
  filters: UnitFinancialFilters,
  properties: PropertyInfo[],
): Promise<UnitFinancialReportResult> {
  const [units, tenants, rawPayments, expenses] = await Promise.all([
    fetchJson<UnitInventory[]>("/api/unit-inventory").catch(() => [] as UnitInventory[]),
    fetchJson<TenantRecord[]>("/api/tenants"),
    fetchJson<RawPayment[]>("/api/payments"),
    fetchJson<RawExpense[]>("/api/unit-expenses").catch(() => [] as RawExpense[]),
  ]);

  const manualPayments = await listManualPayments();
  const normalizedBank = rawPayments
    .map(normalizeBankPayment)
    .filter((payment): payment is NormalizedPayment => Boolean(payment));
  const normalizedManual: NormalizedPayment[] = manualPayments.map((entry) => ({
    tenantId: normalizeId(entry.tenant_id),
    amount: Number(entry.amount || 0),
    date: entry.date,
    source: "manual",
  }));
  const paymentIndex = groupPayments([...normalizedBank, ...normalizedManual], filters.start ? new Date(filters.start) : undefined, filters.end ? new Date(filters.end) : undefined);

  const startDate = filters.start ? new Date(filters.start) : undefined;
  const endDate = filters.end ? new Date(filters.end) : undefined;
  const propertyFilter = (filters.propertyId || "").toLowerCase();

  const tenantIndex = new Map<string, TenantRecord>();
  tenants.forEach((tenant) => {
    tenantIndex.set(unitKey(tenant.property_id || tenant.building, tenant.unit), tenant);
  });

  const rows = units
    .map((unit) => {
      const propertyId = unit.property_id || "";
      if (propertyFilter && propertyId.toLowerCase() !== propertyFilter) return null;
      const tenant = tenantIndex.get(unitKey(propertyId, unit.unit));
      const rentCollected = tenant ? paymentIndex.get(normalizeId(tenant.id)) || 0 : 0;
      const expenseTotal = expenses
        .filter((expense) => expense.property_id?.toLowerCase() === propertyId.toLowerCase() && (expense.unit || "").toLowerCase() === (unit.unit || "").toLowerCase())
        .reduce((sum, expense) => {
          const date = new Date(expense.date);
          if (Number.isNaN(date.getTime()) || !withinRange(date, startDate, endDate)) return sum;
          return sum + toNumber(expense.amount);
        }, 0);

      return {
        propertyId,
        propertyName: getPropertyName(propertyId, properties),
        unit: unit.unit,
        tenant: tenant?.name,
        unitType: unit.unit_type,
        rentCollected: Number(rentCollected.toFixed(2)),
        expenses: Number(expenseTotal.toFixed(2)),
        net: Number((rentCollected - expenseTotal).toFixed(2)),
        status: tenant ? "Occupied" : (unit.status || "Vacant"),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => (a.propertyName || "").localeCompare(b.propertyName || "") || (a.unit || "").localeCompare(b.unit || ""));

  const totals = rows.reduce(
    (acc, row) => {
      acc.rentCollected += row.rentCollected;
      acc.expenses += row.expenses;
      acc.net += row.net;
      return acc;
    },
    { rentCollected: 0, expenses: 0, net: 0 },
  );

  return {
    rows,
    totals: {
      rentCollected: Number(totals.rentCollected.toFixed(2)),
      expenses: Number(totals.expenses.toFixed(2)),
      net: Number(totals.net.toFixed(2)),
    },
  };
}
