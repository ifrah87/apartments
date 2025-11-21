import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchOwnerSummary } from "@/lib/reports/ownerReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  month?: string;
};

export const runtime = "nodejs";

function defaultMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export default async function OwnerSummaryPage({ searchParams }: { searchParams: SearchParams }) {
  const month = searchParams.month || defaultMonth();
  const rows = await fetchOwnerSummary(month);

  const totals = rows.reduce(
    (acc, row) => {
      acc.rentCollected += row.rentCollected;
      acc.operatingExpenses += row.operatingExpenses;
      acc.netIncome += row.netIncome;
      acc.arrearsTotal += row.arrearsTotal;
      return acc;
    },
    { rentCollected: 0, operatingExpenses: 0, netIncome: 0, arrearsTotal: 0 },
  );

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Monthly Owner Summary
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Monthly Owner Summary</h1>
        <p className="text-sm text-slate-500">Consolidated snapshot for owners, including rent, expenses, and arrears.</p>
      </header>

      <SectionCard className="p-4">
        <form className="flex flex-wrap gap-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Month
            <input type="month" name="month" defaultValue={month} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <button type="submit" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            Update
          </button>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Rent collected" value={currency.format(totals.rentCollected)} />
        <SummaryCard label="Operating expenses" value={currency.format(totals.operatingExpenses)} />
        <SummaryCard label="Net income" value={currency.format(totals.netIncome)} emphasize />
        <SummaryCard label="Arrears" value={currency.format(totals.arrearsTotal)} />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Property detail</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2 text-right">Rent collected</th>
                <th className="px-4 py-2 text-right">Expenses</th>
                <th className="px-4 py-2 text-right">Net income</th>
                <th className="px-4 py-2 text-right">Occupancy</th>
                <th className="px-4 py-2 text-right">Arrears</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.propertyId} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">{row.propertyId}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{currency.format(row.rentCollected)}</td>
                  <td className="px-4 py-2 text-right text-rose-600">{currency.format(row.operatingExpenses)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-900">{currency.format(row.netIncome)}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{row.occupancyRate}%</td>
                  <td className="px-4 py-2 text-right text-rose-600">{currency.format(row.arrearsTotal)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No data for this month.
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
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${emphasize ? "ring-1 ring-indigo-100" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-indigo-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
