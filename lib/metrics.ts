// lib/metrics.ts
import { readCsv, coerceDate, coerceNumber } from "./loadCsv";

/** Format a Date into YYYY-MM for month grouping */
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export type CashflowPoint = { month: string; inflows: number; outflows: number; net: number };
export type Kpis = {
  bankBalance: number;
  rentReceived: number;   // this month (approx = inflows)
  rentOverdue: number;    // expected - received
  cashflowMoM: number;    // % change in net vs last month
};
export type AtRiskTenant = { reference: string; overdue: number };

export type DashboardData = {
  kpis: Kpis;
  series: CashflowPoint[];
  atRiskTenants: AtRiskTenant[];
};

/**
 * Compute dashboard data from CSVs in /data.
 * Filenames expected:
 *  - bank_all_buildings.csv   (has columns like: date, amount, type/description/category)
 *  - tenants_all_buildings.csv (has columns like: name/reference, monthly_rent)
 */
export default function computeDashboard(): DashboardData {
  // 1) Load CSVs
  const bank = readCsv("bank_all_buildings.csv");
  const tenants = readCsv("tenants_all_buildings.csv");

  // 2) Normalise bank rows -> { date, amount, isInflow }
  const bankRows = bank
    .map((r) => {
      const date = coerceDate(r, ["date", "Date", "transaction_date", "posted_date"]);
      const amount = coerceNumber(r, ["amount", "Amount", "value"]) ?? 0;

      // Heuristic: treat credits / rent / inflow / received / positive amounts as inflows
      const typeStr = (r.type || r.category || r.description || r.transaction_type || "")
        .toString()
        .toLowerCase();

      const isInflow =
        typeStr.includes("rent") ||
        typeStr.includes("credit") ||
        typeStr.includes("inflow") ||
        typeStr.includes("received") ||
        amount > 0;

      return { date, amount, isInflow };
    })
    .filter((r) => r.date) as { date: Date; amount: number; isInflow: boolean }[];

  // 3) Bank balance (sum of signed amounts)
  const bankBalance = bankRows.reduce((s, r) => s + r.amount, 0);

  // 4) Group by month
  const byMonth = new Map<string, { inflows: number; outflows: number; net: number }>();
  for (const r of bankRows) {
    const key = monthKey(r.date);
    const rec = byMonth.get(key) ?? { inflows: 0, outflows: 0, net: 0 };
    if (r.isInflow) rec.inflows += r.amount;
    else rec.outflows += Math.abs(r.amount);
    rec.net = rec.inflows - rec.outflows;
    byMonth.set(key, rec);
  }

  // 5) KPIs that depend on byMonth (DECLARE AFTER byMonth IS BUILT)
  const now = new Date();
  const thisM = monthKey(now);
  const lastM = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const rentReceived = byMonth.get(thisM)?.inflows ?? 0; // approximation using inflows
  const netThis = byMonth.get(thisM)?.net ?? 0;
  const netLast = byMonth.get(lastM)?.net ?? 0;
  const cashflowMoM = netLast !== 0 ? ((netThis - netLast) / Math.abs(netLast)) * 100 : 0;

  // Expected rent from tenants CSV
  const expected = tenants
    .map((t) => coerceNumber(t, ["monthly_rent", "rent", "MonthlyRent"]) ?? 0)
    .reduce((a, b) => a + b, 0);

  const rentOverdue = Math.max(expected - rentReceived, 0);

  // 6) At-risk tenants (simple first pass)
  // If there’s overdue rent, list tenants who have a positive monthly_rent.
  // (Later we’ll replace with real per-tenant reconciliation.)
  const atRiskTenants: AtRiskTenant[] =
    rentOverdue <= 0
      ? []
      : tenants
          .map((t) => {
            const monthly = coerceNumber(t, ["monthly_rent", "rent", "MonthlyRent"]) ?? 0;
            const reference =
              (t.reference || t.Reference || t.name || t.Name || "Unknown").toString();
            return { reference, overdue: monthly };
          })
          .filter((t) => t.overdue > 0)
          .slice(0, 8); // cap list for now

  // 7) Build chart series
  const series: CashflowPoint[] = Array.from(byMonth.keys())
    .sort()
    .map((k) => {
      const r = byMonth.get(k)!;
      return { month: k, inflows: r.inflows, outflows: r.outflows, net: r.net };
    });

 return {
  kpis: { bankBalance, rentReceived, rentOverdue, cashflowMoM },
  series,
  atRiskTenants,   // ✅ make sure this is returned
};
