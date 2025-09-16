// app/dashboard/page.tsx

// ✅ Use RELATIVE paths and a NAMED import to avoid alias/interop issues
import computeDashboard from "@/lib/metrics";
import KpiCard from "@/components/Kpicard";
import CashflowChart from "@/components/Cashflowchart";

// helpers
const money = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)}%`;

export default function DashboardPage() {
  // Wrap in try/catch so any server-side error shows on the page
  try {
    const { kpis, series, atRiskTenants } = computeDashboard();

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Bank balance" value={money(kpis.bankBalance)} />
          <KpiCard title="Rent received (this month)" value={money(kpis.rentReceived)} />
          <KpiCard title="Rent overdue (this month)" value={money(kpis.rentOverdue)} />
          <KpiCard title="Cashflow MoM" value={pct(kpis.cashflowMoM)} />
          <KpiCard title="At-risk tenants" value={atRiskTenants.length.toString()} />
        </div>

        <CashflowChart data={series} />
      </div>
    );
  } catch (err: any) {
    return (
      <div className="m-6 rounded-xl border border-amber-500 bg-amber-50 p-4 text-amber-900">
        <div className="font-semibold mb-2">Couldn’t load dashboard data.</div>
        <pre className="whitespace-pre-wrap text-sm">{String(err?.message ?? err)}</pre>
        <p className="mt-2 text-sm">
          Check that your CSV filenames in <code>lib/metrics.ts</code> match files in <code>/data</code>.
        </p>
      </div>
    );
  }
}
