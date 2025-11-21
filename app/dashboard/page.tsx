// app/dashboard/page.tsx
import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import StatCard from "@/components/ui/StatCard";
import CashflowWidget, { CashflowPoint } from "@/components/CashflowWidget";
import { calculateRentSummary } from "@/lib/reports/rentReports";
import { calculateOccupancySummary } from "@/lib/reports/occupancyReports";
import { calculateBankSummary, fetchLedger } from "@/lib/reports/ledger";


export const runtime = "nodejs";

export default async function DashboardPage() {
  const [rent, occupancy, bank, ledgerEntries] = await Promise.all([
    calculateRentSummary(),
    calculateOccupancySummary(),
    calculateBankSummary({}),
    fetchLedger(),
  ]);
  const cashflowSeries = buildMonthlyCashflow(ledgerEntries);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const qs = new URLSearchParams({ start, end, unreconciled: "1" }).toString();

  const ledgerLink = `/reports/ledger?${qs}`;

  const topStats = [
    {
      label: "Rent Collected (MTD)",
      value: `$${Math.round(rent.rentCollectedMTD).toLocaleString()}`,
      href: ledgerLink,
    },
    {
      label: "Upcoming Payments",
      value: `$${Math.round(rent.upcomingTotal).toLocaleString()}`,
      subtitle: `${rent.upcomingPayments} payments due in 7d`,
      href: ledgerLink,
    },
    {
      label: "Overdue Rent",
      value: `$${Math.round(rent.overdueTotal).toLocaleString()}`,
      subtitle: `${rent.overdueTenants} tenants overdue`,
      href: ledgerLink,
    },
  ];

  const lastUpdated = bank.lastUpdatedISO ? new Date(bank.lastUpdatedISO) : null;
  const lastUpdatedText = lastUpdated
    ? `${lastUpdated.toLocaleDateString("en", { month: "short", day: "numeric" })} at ${lastUpdated.toLocaleTimeString(
        "en",
        { hour: "numeric", minute: "2-digit" },
      )}`
    : "Never";

  return (
    <div className="w-full space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SectionCard className="p-4">
          <div className="flex items-center justify-between text-slate-700">
            <span>Bank balance</span>
            <Link href="/reports/bank-summary" className="text-xs text-indigo-600 hover:underline">
              View report
            </Link>
          </div>
          <div className="mt-4 text-3xl font-semibold text-slate-900">${Math.round(bank.bankBalance).toLocaleString()}</div>
          <Link
            href="/reports/bank-summary?view=unreconciled"
            className="mt-3 inline-flex text-sm font-semibold text-rose-600 hover:underline"
          >
            {bank.unreconciledCount} unreconciled {bank.unreconciledCount === 1 ? "item" : "items"}
          </Link>
          <div className="text-xs text-slate-400">Last synced: {lastUpdatedText}</div>
        </SectionCard>
        {topStats.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            subtitle={card.subtitle}
            href={card.href}
          />
        ))}
      </div>

      <SectionCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Cash In & Out</p>
            <h2 className="text-lg font-semibold text-slate-900">Monthly cashflow</h2>
          </div>
        </div>
        <div className="mt-6">
          <CashflowWidget points={cashflowSeries} link="/reports/bank-summary" />
        </div>
      </SectionCard>

    </div>
  );
}

type InternalCashflowPoint = CashflowPoint;

function buildMonthlyCashflow(transactions: Awaited<ReturnType<typeof fetchLedger>>): CashflowPoint[] {
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
