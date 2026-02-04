import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import StatCard from "@/components/ui/StatCard";
import CashflowWidget, { type CashflowPoint } from "@/components/CashflowWidget";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { calculateRentSummary } from "@/lib/reports/rentReports";
import { calculateOccupancySummary } from "@/lib/reports/occupancyReports";
import { calculateBankSummary, fetchLedger, type Txn } from "@/lib/reports/ledger";

export const runtime = "nodejs";

export default async function DashboardPage() {
  const [rent, occupancy, bank, ledgerEntries] = await Promise.all([
    calculateRentSummary(),
    calculateOccupancySummary(),
    calculateBankSummary({}),
    fetchLedger(),
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

  const lastUpdated = bank.lastUpdatedISO ? new Date(bank.lastUpdatedISO) : null;
  const lastUpdatedText = lastUpdated
    ? `${lastUpdated.toLocaleDateString("en", { month: "short", day: "numeric" })} · ${lastUpdated.toLocaleTimeString(
        "en",
        { hour: "numeric", minute: "2-digit" },
      )}`
    : "Never";

  const stats = [
    {
      label: "Bank balance",
      value: formatCurrency(bank.bankBalance),
      subtitle: `${bank.unreconciledCount} unreconciled · ${lastUpdatedText}`,
      accent: "cyan" as const,
      href: "/reports/bank-summary",
    },
    {
      label: "Rent collected (MTD)",
      value: formatCurrency(rent.rentCollectedMTD),
      subtitle: "Monthly rental income",
      accent: "green" as const,
      href: ledgerLink,
    },
    {
      label: "Upcoming payments",
      value: formatCurrency(rent.upcomingTotal),
      subtitle: `${rent.upcomingPayments} due in 7d`,
      accent: "orange" as const,
      href: ledgerLink,
    },
    {
      label: "Overdue rent",
      value: formatCurrency(rent.overdueTotal),
      subtitle: `${rent.overdueTenants} tenants overdue`,
      accent: "red" as const,
      href: ledgerLink,
    },
    {
      label: "Occupancy rate",
      value: `${occupancy.occupancyRate}%`,
      subtitle: `${occupancy.occupiedUnits}/${occupancy.totalUnits} occupied`,
      accent: "purple" as const,
      href: "/reports/occupancy",
    },
    {
      label: "Vacant units",
      value: occupancy.vacantUnits,
      subtitle: `${occupancy.averageDaysVacant} avg days vacant`,
      accent: "cyan" as const,
      href: "/reports/occupancy",
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
            className="rounded-full border border-white/10 bg-surface/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-200 hover:border-white/20"
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

      <CashflowWidget points={cashflowSeries} link="/reports/bank-summary" />

      <SectionCard className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Recent activity</h2>
            <p className="text-xs text-slate-400">Latest ledger entries across all properties.</p>
          </div>
          <Link href={ledgerLink} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
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
                  <td className="text-slate-400">{row.property_id || row.unit || "—"}</td>
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

function buildMonthlyCashflow(transactions: Txn[]): CashflowPoint[] {
  const now = new Date();
  const buckets: CashflowPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: date.toISOString(),
      label: date.toLocaleString("en", { month: "short" }),
      inflow: 0,
      outflow: 0,
      monthIndex: date.getMonth(),
    });
  }

  transactions.forEach((txn) => {
    const date = new Date(txn.date);
    const label = date.toLocaleString("en", { month: "short" });
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
  const formatted = abs.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return safe < 0 ? `-${formatted}` : formatted;
}

function formatDate(value: string) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
