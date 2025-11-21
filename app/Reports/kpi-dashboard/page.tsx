import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchKPIDashboard } from "@/lib/reports/ownerReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const runtime = "nodejs";

export default async function KPIDashboardPage() {
  const rows = await fetchKPIDashboard();
  const latest = rows[rows.length - 1];

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / KPI Dashboard
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">KPI Dashboard</h1>
        <p className="text-sm text-slate-500">Marketing-ready metrics such as occupancy, arrears, and unit profitability.</p>
      </header>

      {latest && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Occupancy" value={`${latest.occupancyRate}%`} />
          <SummaryCard label="Arrears" value={currency.format(latest.arrearsTotal)} />
          <SummaryCard label="Rent collected" value={currency.format(latest.rentCollected)} emphasize />
        </div>
      )}

      <SectionCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Recent KPIs</h2>
          <a href="/api/kpi-dashboard" className="text-sm text-indigo-600 hover:underline">
            Download CSV
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Occupancy</th>
                <th className="px-4 py-2">Arrears</th>
                <th className="px-4 py-2">Rent collected</th>
                <th className="px-4 py-2">Avg days vacant</th>
                <th className="px-4 py-2">Expense ratio</th>
                <th className="px-4 py-2">Unit profitability</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-slate-600">{row.occupancyRate}%</td>
                  <td className="px-4 py-2 text-rose-600">{currency.format(row.arrearsTotal)}</td>
                  <td className="px-4 py-2 text-emerald-600">{currency.format(row.rentCollected)}</td>
                  <td className="px-4 py-2 text-slate-600">{row.avgDaysVacant} days</td>
                  <td className="px-4 py-2 text-slate-600">{Math.round(row.expenseRatio * 100)}%</td>
                  <td className="px-4 py-2 text-slate-900">{currency.format(row.unitProfitability)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No KPI data available.
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

function SummaryCard({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <SectionCard className={`p-4 ${emphasize ? "ring-1 ring-indigo-100" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-indigo-600" : "text-slate-900"}`}>{value}</p>
    </SectionCard>
  );
}
