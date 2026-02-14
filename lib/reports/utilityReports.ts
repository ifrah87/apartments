import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { normalizeId, type TenantRecord } from "@/lib/reports/tenantStatement";

type RawUtilityCharge = {
  tenant_id?: string;
  date: string;
  amount: string;
  paid_amount?: string;
  description?: string;
  category?: string;
  communal?: string;
  property_id?: string;
};

type UtilityFilters = {
  propertyId?: string;
  start?: string;
  end?: string;
};

export type UtilityChargeRow = {
  date: string;
  tenantName: string;
  propertyId?: string;
  propertyName?: string;
  unit?: string;
  description: string;
  amount: number;
  paidAmount: number;
  balance: number;
  category?: string;
  communal: boolean;
};

export type UtilityReportResult = {
  rows: UtilityChargeRow[];
  totals: { charged: number; paid: number; balance: number };
  communalTotals: { charged: number; balance: number };
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

export async function buildUtilityChargesReport(filters: UtilityFilters, properties: { property_id: string; name?: string }[]): Promise<UtilityReportResult> {
  const [tenants, charges] = await Promise.all([
    fetchJson<TenantRecord[]>("/api/tenants"),
    fetchJson<RawUtilityCharge[]>("/api/tenant-charges").catch(() => [] as RawUtilityCharge[]),
  ]);
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const start = filters.start ? new Date(filters.start) : undefined;
  const end = filters.end ? new Date(filters.end) : undefined;
  const propertyMap = new Map(properties.map((property) => [property.property_id.toLowerCase(), property.name || property.property_id]));

  const rows: UtilityChargeRow[] = charges
    .map((charge) => {
      const category = (charge.category || "").toLowerCase();
      const communal = String(charge.communal || "").toLowerCase() === "true";
      if (!communal && category !== "utilities") return null;
      const chargeDate = new Date(charge.date);
      if (Number.isNaN(chargeDate.getTime())) return null;
      if (!withinRange(chargeDate, start, end)) return null;
      const tenantId = normalizeId(charge.tenant_id);
      let tenant: TenantRecord | undefined;
      if (tenantId) {
        tenant = tenants.find((t) => normalizeId(t.id) === tenantId);
      }
      const propertyId = (tenant?.property_id || charge.property_id || "").trim();
      if (propertyFilter && propertyId.toLowerCase() !== propertyFilter) return null;
      const propertyName = propertyId ? propertyMap.get(propertyId.toLowerCase()) || propertyId : undefined;
      const amount = toNumber(charge.amount);
      const paidAmount = toNumber(charge.paid_amount);
      const balance = Number((amount - paidAmount).toFixed(2));

      return {
        date: charge.date,
        tenantName: tenant?.name || (communal ? "Communal" : "Unknown tenant"),
        propertyId: propertyId || undefined,
        propertyName,
        unit: tenant?.unit,
        description: charge.description || "Utility charge",
        amount,
        paidAmount,
        balance,
        category: charge.category,
        communal,
      };
    })
    .filter((row): row is UtilityChargeRow => Boolean(row))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totals = rows.reduce(
    (acc, row) => {
      acc.charged += row.amount;
      acc.paid += row.paidAmount;
      acc.balance += row.balance;
      if (row.communal) {
        acc.communalCharged += row.amount;
        acc.communalBalance += row.balance;
      }
      return acc;
    },
    { charged: 0, paid: 0, balance: 0, communalCharged: 0, communalBalance: 0 },
  );

  return {
    rows,
    totals: {
      charged: Number(totals.charged.toFixed(2)),
      paid: Number(totals.paid.toFixed(2)),
      balance: Number(totals.balance.toFixed(2)),
    },
    communalTotals: {
      charged: Number(totals.communalCharged.toFixed(2)),
      balance: Number(totals.communalBalance.toFixed(2)),
    },
  };
}
