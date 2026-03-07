import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import StatCard from "@/components/ui/StatCard";
import CashflowWidget, { type CashflowPoint } from "@/components/CashflowWidget";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { displayPropertyLabel } from "@/lib/propertyLabel";
import { calculateRentSummary } from "@/lib/reports/rentReports";
import { calculateOccupancySummary } from "@/lib/reports/occupancyReports";
import { calculateBankSummary, fetchLedger, type Txn } from "@/lib/reports/ledger";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type SearchParams = {
  propertyId?: string;
};

async function fetchLeaseSummary() {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*)                  AS active_count,
        COALESCE(SUM(l.rent), 0) AS total_rent,
        COALESCE(SUM(
          CASE u.unit_type
            WHEN '3bed'  THEN 750
            WHEN '2bed'  THEN 650
            ELSE 0
          END
        ), 0)                     AS full_occupancy_rent
      FROM public.leases l
      JOIN public.units u ON u.id = l.unit_id
      WHERE l.status = 'active'
    `);
    const row = rows[0] ?? {};
    return {
      activeCount:       Number(row.active_count ?? 0),
      totalRent:         Number(row.total_rent ?? 0),
      fullOccupancyRent: Number(row.full_occupancy_rent ?? 0),
    };
  } catch {
    return { activeCount: 0, totalRent: 0, fullOccupancyRent: 37350 };
  }
}

async function fetchArrears() {
  try {
    const { rows } = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN age_days <= 30  THEN outstanding ELSE 0 END), 0) AS current_30,
        COALESCE(SUM(CASE WHEN age_days > 30 AND age_days <= 60 THEN outstanding ELSE 0 END), 0) AS days_30_60,
        COALESCE(SUM(CASE WHEN age_days > 60  THEN outstanding ELSE 0 END), 0) AS days_60_plus
      FROM (
        SELECT
          GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0)) AS outstanding,
          EXTRACT(EPOCH FROM (NOW() - COALESCE(due_date, invoice_date))) / 86400 AS age_days
        FROM public.invoices
        WHERE GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0)) > 0
      ) sub
    `);
    const row = rows[0] ?? {};
    return {
      current:    Number(Number(row.current_30   ?? 0).toFixed(2)),
      days30to60: Number(Number(row.days_30_60   ?? 0).toFixed(2)),
      days60plus: Number(Number(row.days_60_plus ?? 0).toFixed(2)),
    };
  } catch {
    return { current: 0, days30to60: 0, days60plus: 0 };
  }
}

async function fetchProperties() {
  const baseUrl = await getRequestBaseUrl();
  const res = await fetch(`${baseUrl}/api/properties`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return [];
  const payload = await res.json().catch(() => null);
  const data = (payload?.ok ? payload.data : payload) as Array<{ id: string; name: string; code?: string | null }>;
  return Array.isArray(data) ? data : [];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const propertyId = sp?.propertyId ?? "";
  const properties = await fetchProperties();
  const selectedProperty = propertyId ? properties.find((p) => p.id === propertyId) : null;
  const propertyFilter = selectedProperty?.id || (propertyId || undefined);

  const [rent, occupancy, bank, ledgerEntries, leaseSummary, arrears] = await Promise.all([
    calculateRentSummary(propertyFilter),
    calculateOccupancySummary(propertyFilter),
    calculateBankSummary({ propertyId: propertyFilter }),
    fetchLedger({ propertyId: propertyFilter }),
    fetchLeaseSummary(),
    fetchArrears(),
  ]);

  const cashflowSeries = buildMonthlyCashflow(ledgerEntries);
  const recentTxns = [...ledgerEntries]
    .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
    .slice(0, 6);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const qs = new URLSearchParams({ start, end, unreconciled: "1" }).toString();
  const ledgerLink = `/reports/ledger?${qs}`;
  const occupancyParams = new URLSearchParams();
  if (propertyFilter) occupancyParams.set("property", propertyFilter);
  const occupancyReportLink = occupancyParams.size
    ? `/reports/occupancy?${occupancyParams.toString()}`
    : "/reports/occupancy";
  const vacantUnitsReportLink = (() => {
    const params = new URLSearchParams(occupancyParams);
    params.set("status", "vacant");
    return `/reports/occupancy?${params.toString()}`;
  })();

  const lastUpdated = bank.lastUpdatedISO ? new Date(bank.lastUpdatedISO) : null;
  const lastUpdatedText = lastUpdated
    ? `${lastUpdated.toLocaleDateString("en-GB", { month: "short", day: "numeric" })} · ${lastUpdated.toLocaleTimeString(
        "en",
        { hour: "numeric", minute: "2-digit" },
      )}`
    : "Never";

  const stats = [
    {
      label: "Bank balance",
      value: formatCurrency(bank.bankBalance),
      subtitle: bank.unreconciledCount > 0
        ? `⚠ ${bank.unreconciledCount} items need Reconcile`
        : `All Reconcile · ${lastUpdatedText}`,
      accent: "cyan" as const,
      href: "/reports/bank-reconciliation",
    },
    {
      label: "Rent collected (MTD)",
      value: formatCurrency(rent.rentCollectedMTD),
      subtitle: "Collected against this month's bills",
      accent: "cyan" as const,
      href: "/bills",
    },
    {
      label: "Upcoming payments",
      value: formatCurrency(rent.upcomingTotal),
      subtitle: `${rent.upcomingPayments} due in 7d`,
      accent: "cyan" as const,
      href: ledgerLink,
    },
    {
      label: "Overdue rent",
      value: formatCurrency(rent.overdueTotal),
      subtitle: `${rent.overdueTenants} tenants overdue`,
      accent: "cyan" as const,
      href: ledgerLink,
    },
    {
      label: "Occupancy rate",
      value: `${occupancy.occupancyRate}%`,
      subtitle: `${occupancy.occupiedUnits}/${occupancy.totalUnits} occupied`,
      accent: "cyan" as const,
      href: occupancyReportLink,
    },
    {
      label: "Vacant units",
      value: occupancy.vacantUnits,
      subtitle: `${occupancy.averageDaysVacant} avg days vacant`,
      accent: "cyan" as const,
      href: vacantUnitsReportLink,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time performance across rent, occupancy, and cashflow."
        actions={
          <Link
            href="/reports"
            className="rounded-full border border-accent/30 bg-panel/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent hover:border-accent/50"
          >
            View reports
          </Link>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            subtitle={card.subtitle}
            accent={card.accent}
            href={card.href}
          />
        ))}
      </div>

      <RevenueTargetWidget
        activeLeases={leaseSummary.activeCount}
        actualRent={leaseSummary.totalRent}
        targetRent={leaseSummary.fullOccupancyRent || 37350}
      />

      <ArrearsWidget
        current={arrears.current}
        days30to60={arrears.days30to60}
        days60plus={arrears.days60plus}
      />

      <CashflowWidget points={cashflowSeries} link="/reports/bank-summary" />

      <SectionCard className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Recent activity</h2>
            <p className="text-xs text-slate-400">Latest ledger entries across all properties.</p>
          </div>
          <Link href={ledgerLink} className="text-xs font-semibold text-accent hover:text-accent/80">
            Open ledger
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Property</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Type</th>
              </tr>
            </thead>
            <tbody>
              {recentTxns.map((row) => (
                <tr key={`${row.date}-${row.description}`}>
                  <td>{formatDate(row.date)}</td>
                  <td className="text-slate-200">{row.description}</td>
                  <td className="text-slate-400">{displayPropertyLabel(row.property_id, row.unit || "—")}</td>
                  <td
                    className={`text-right font-semibold ${
                      row.amount >= 0 ? "text-emerald-200" : "text-rose-200"
                    }`}
                  >
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="text-right">
                    <Badge variant={row.amount >= 0 ? "success" : "danger"}>
                      {row.amount >= 0 ? "Income" : "Expense"}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!recentTxns.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    No ledger entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function RevenueTargetWidget({
  activeLeases,
  actualRent,
  targetRent,
}: {
  activeLeases: number;
  actualRent: number;
  targetRent: number;
}) {
  const pct = targetRent > 0 ? Math.min(100, Math.round((actualRent / targetRent) * 100)) : 0;
  const gap = targetRent - actualRent;
  const barColor = pct >= 95 ? "bg-emerald-400" : pct >= 70 ? "bg-yellow-400" : "bg-rose-400";

  return (
    <SectionCard className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Monthly Revenue Target</p>
          <p className="mt-1 text-sm text-slate-400">
            {activeLeases} active {activeLeases === 1 ? "lease" : "leases"} · full occupancy target
          </p>
        </div>
        <Link href="/bills" className="text-xs font-semibold text-accent hover:text-accent/80">
          View bills
        </Link>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">Actual (active leases)</p>
          <p className="text-2xl font-semibold text-slate-100">{formatCurrency(actualRent)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Target (100% occupancy)</p>
          <p className="text-2xl font-semibold text-slate-400">{formatCurrency(targetRent)}</p>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{pct}% of target</span>
        {gap > 0 ? (
          <span className="text-rose-400">{formatCurrency(gap)} gap</span>
        ) : (
          <span className="text-emerald-400">Target met</span>
        )}
      </div>
    </SectionCard>
  );
}

function ArrearsWidget({
  current,
  days30to60,
  days60plus,
}: {
  current: number;
  days30to60: number;
  days60plus: number;
}) {
  const total = current + days30to60 + days60plus;
  return (
    <SectionCard className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Arrears Aging</p>
          <p className="mt-1 text-sm text-slate-400">Outstanding unpaid invoices by age</p>
        </div>
        <Link href="/Reports/overdue-rent" className="text-xs font-semibold text-accent hover:text-accent/80">
          Full report
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-panel-2/60 px-4 py-3">
          <p className="text-xs text-slate-500">0 – 30 days</p>
          <p className="mt-1 text-lg font-semibold text-yellow-300">{formatCurrency(current)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-panel-2/60 px-4 py-3">
          <p className="text-xs text-slate-500">31 – 60 days</p>
          <p className="mt-1 text-lg font-semibold text-orange-300">{formatCurrency(days30to60)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-panel-2/60 px-4 py-3">
          <p className="text-xs text-slate-500">60+ days</p>
          <p className="mt-1 text-lg font-semibold text-rose-400">{formatCurrency(days60plus)}</p>
        </div>
      </div>

      {total > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Total outstanding: <span className="font-semibold text-rose-300">{formatCurrency(total)}</span>
        </p>
      )}
      {total === 0 && (
        <p className="mt-3 text-xs text-emerald-400">No outstanding arrears.</p>
      )}
    </SectionCard>
  );
}

function buildMonthlyCashflow(transactions: Txn[]): CashflowPoint[] {
  const now = new Date();
  const buckets: CashflowPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: date.toISOString(),
      label: date.toLocaleString("en-GB", { month: "short" }),
      inflow: 0,
      outflow: 0,
      monthIndex: date.getMonth(),
    });
  }

  transactions.forEach((txn) => {
    const date = new Date(txn.date);
    const label = date.toLocaleString("en-GB", { month: "short" });
    const bucket = buckets.find((b) => b.label === label);
    if (!bucket) return;
    if (txn.amount >= 0) {
      bucket.inflow += txn.amount;
    } else {
      bucket.outflow += txn.amount;
    }
  });

  return buckets;
}

function formatCurrency(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const formatted = abs.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  return safe < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatDate(value: string) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function toDate(value: string) {
  return new Date(toISOMaybe(value));
}

function toISOMaybe(value: string) {
  const parts = value.split(/[-/]/);
  if (parts.length !== 3) return value;
  if (parts[0].length === 4) return value;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
