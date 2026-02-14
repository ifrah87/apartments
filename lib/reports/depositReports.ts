import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { normalizeId, type TenantRecord } from "@/lib/reports/tenantStatement";

type RawDepositSummary = {
  tenant_id: string;
  deposit_charged?: string;
  deposit_received?: string;
  deposit_released?: string;
  deposit_notes?: string;
};

type RawDepositTxn = {
  tenant_id: string;
  date: string;
  type: string;
  amount: string;
  note?: string;
};

type PropertyInfo = { property_id: string; name?: string };

export type DepositFilters = {
  propertyId?: string;
};

export type DepositReportRow = {
  tenantId: string;
  tenantName: string;
  propertyId?: string;
  propertyName?: string;
  unit?: string;
  charged: number;
  received: number;
  released: number;
  held: number;
  notes?: string;
  lastActivity?: string;
  lastActivityType?: string;
};

export type DepositTransactionRow = {
  tenantId: string;
  tenantName: string;
  propertyId?: string;
  propertyName?: string;
  unit?: string;
  date: string;
  type: string;
  amount: number;
  note?: string;
};

export type DepositReportResult = {
  rows: DepositReportRow[];
  totals: { charged: number; received: number; released: number; held: number };
  transactions: DepositTransactionRow[];
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

function propertyName(propertyId: string | undefined, properties: PropertyInfo[]) {
  if (!propertyId) return undefined;
  const match = properties.find((p) => (p.property_id || "").toLowerCase() === propertyId.toLowerCase());
  return match?.name || propertyId;
}

function lastActivity(transactions: RawDepositTxn[], tenantId: string) {
  const relevant = transactions
    .filter((txn) => normalizeId(txn.tenant_id) === tenantId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (!relevant.length) return undefined;
  return { date: relevant[0].date, type: relevant[0].type };
}

export async function buildDepositReport(filters: DepositFilters, properties: PropertyInfo[]): Promise<DepositReportResult> {
  const [tenants, summaries, transactions] = await Promise.all([
    fetchJson<TenantRecord[]>("/api/tenants"),
    fetchJson<RawDepositSummary[]>("/api/deposits").catch(() => []),
    fetchJson<RawDepositTxn[]>("/api/deposit-transactions").catch(() => []),
  ]);
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const summaryMap = new Map<string, RawDepositSummary>();
  summaries.forEach((entry) => {
    const id = normalizeId(entry.tenant_id);
    if (!id) return;
    summaryMap.set(id, entry);
  });

  const rows: DepositReportRow[] = tenants
    .map((tenant) => {
      const tenantId = normalizeId(tenant.id);
      const summary = summaryMap.get(tenantId);
      if (!summary) return null;
      if (propertyFilter && (tenant.property_id || "").toLowerCase() !== propertyFilter && (tenant.building || "").toLowerCase() !== propertyFilter) {
        return null;
      }
      const charged = toNumber(summary.deposit_charged);
      const received = toNumber(summary.deposit_received);
      const released = toNumber(summary.deposit_released);
      const held = Number((received - Math.abs(released)).toFixed(2));
      const activity = lastActivity(transactions, tenantId);
      return {
        tenantId,
        tenantName: tenant.name,
        propertyId: tenant.property_id || tenant.building,
        propertyName: propertyName(tenant.property_id || tenant.building, properties),
        unit: tenant.unit,
        charged,
        received,
        released: Math.abs(released),
        held,
        notes: summary.deposit_notes,
        lastActivity: activity?.date,
        lastActivityType: activity?.type,
      };
    })
    .filter((row): row is DepositReportRow => Boolean(row))
    .sort((a, b) => (a.propertyName || "").localeCompare(b.propertyName || "") || (a.unit || "").localeCompare(b.unit || ""));

  const totals = rows.reduce(
    (acc, row) => {
      acc.charged += row.charged;
      acc.received += row.received;
      acc.released += row.released;
      acc.held += row.held;
      return acc;
    },
    { charged: 0, received: 0, released: 0, held: 0 },
  );

  const tenantIndex = new Map<string, { tenant: TenantRecord; propertyName?: string }>();
  rows.forEach((row) => {
    const tenant = tenants.find((t) => normalizeId(t.id) === row.tenantId);
    if (tenant) tenantIndex.set(row.tenantId, { tenant, propertyName: row.propertyName });
  });

  const filteredTransactions: DepositTransactionRow[] = transactions
    .map((txn) => {
      const tenantId = normalizeId(txn.tenant_id);
      const tenantInfo = tenantIndex.get(tenantId);
      if (!tenantInfo) return null;
      const propertyId = tenantInfo.tenant.property_id || tenantInfo.tenant.building;
      if (propertyFilter && (propertyId || "").toLowerCase() !== propertyFilter) return null;
      return {
        tenantId,
        tenantName: tenantInfo.tenant.name,
        propertyId,
        propertyName: tenantInfo.propertyName,
        unit: tenantInfo.tenant.unit,
        date: txn.date,
        type: txn.type,
        amount: toNumber(txn.amount),
        note: txn.note,
      };
    })
    .filter((row): row is DepositTransactionRow => Boolean(row))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    rows,
    totals: {
      charged: Number(totals.charged.toFixed(2)),
      received: Number(totals.received.toFixed(2)),
      released: Number(totals.released.toFixed(2)),
      held: Number(totals.held.toFixed(2)),
    },
    transactions: filteredTransactions,
  };
}
