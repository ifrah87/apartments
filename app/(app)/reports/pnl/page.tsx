import Link from "next/link";
import { calculateProfitAndLoss } from "@/lib/reports/pnl";
import PnLExporter from "@/components/PnLExporter";

type SearchParams = {
  start?: string;
  end?: string;
  property?: string;
  period?: "month" | "quarter" | "year";
};

function defaultRange(period: "month" | "quarter" | "year") {
  const today = new Date();
  if (period === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (period === "quarter") {
    const quarter = Math.floor(today.getMonth() / 3);
    const start = new Date(today.getFullYear(), quarter * 3, 1);
    const end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

export default async function ProfitAndLossPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const period = sp.period || "month";
  const defaults = defaultRange(period);
  const start = sp.start || defaults.start;
  const end = sp.end || defaults.end;
  const propertyFilter = sp.property || "all";

  const pnl = await calculateProfitAndLoss({ start, end });
  const propertyOptions = pnl.properties.map((property) => ({
    id: property.propertyId,
    name: property.propertyName,
  }));

  const activeProperty =
    propertyFilter === "all"
      ? pnl.consolidated
      : pnl.properties.find((property) => property.propertyId === propertyFilter) || pnl.consolidated;

  const accountsByType = {
    income: activeProperty.accounts.filter((account) => account.type === "income"),
    expense: activeProperty.accounts.filter((account) => account.type === "expense"),
  };

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Profit &amp; Loss
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Profit &amp; Loss</h1>
        <p className="text-sm text-slate-500">
          {activeProperty.propertyName} · {start} to {end}
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Start date</label>
          <input type="date" name="start" defaultValue={start} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">End date</label>
          <input type="date" name="end" defaultValue={end} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Quick period</label>
          <select name="period" defaultValue={period} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="month">Current month</option>
            <option value="quarter">Current quarter</option>
            <option value="year">Year to date</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Property</label>
          <select name="property" defaultValue={propertyFilter} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All properties (consolidated)</option>
            {propertyOptions.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          Update
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total income" value={formatCurrency(activeProperty.incomeTotal)} />
        <SummaryCard label="Total expenses" value={formatCurrency(activeProperty.expenseTotal)} />
        <SummaryCard label="Net operating income" value={formatCurrency(activeProperty.net)} emphasize />
      </div>

      <div className="flex justify-end">
        <PnLExporter property={activeProperty} fileName={`pnl-${activeProperty.propertyId}-${start}-${end}`} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Income</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-2">Account</th>
              <th className="px-6 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {accountsByType.income.map((account) => (
              <tr key={account.accountId} className="border-t border-slate-100">
                <td className="px-6 py-2 text-slate-900">{account.accountName}</td>
                <td className="px-6 py-2 text-right font-semibold text-emerald-600">{formatCurrency(account.amount)}</td>
              </tr>
            ))}
            {!accountsByType.income.length && (
              <tr>
                <td className="px-6 py-4 text-sm text-slate-500" colSpan={2}>
                  No income recorded for this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-6 py-2 font-semibold text-slate-900">Total income</td>
              <td className="px-6 py-2 text-right font-semibold text-slate-900">{formatCurrency(activeProperty.incomeTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Expenses</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-2">Account</th>
              <th className="px-6 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {accountsByType.expense.map((account) => (
              <tr key={account.accountId} className="border-t border-slate-100">
                <td className="px-6 py-2 text-slate-900">{account.accountName}</td>
                <td className="px-6 py-2 text-right font-semibold text-rose-600">{formatCurrency(account.amount)}</td>
              </tr>
            ))}
            {!accountsByType.expense.length && (
              <tr>
                <td className="px-6 py-4 text-sm text-slate-500" colSpan={2}>
                  No expenses recorded for this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-6 py-2 font-semibold text-slate-900">Total expenses</td>
              <td className="px-6 py-2 text-right font-semibold text-slate-900">{formatCurrency(activeProperty.expenseTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-900 px-6 py-5 text-white shadow-sm">
        <div className="text-xs uppercase tracking-wide text-white/70">Net operating income</div>
        <div className="text-3xl font-semibold">{formatCurrency(activeProperty.net)}</div>
        <p className="mt-1 text-sm text-white/70">
          Income minus expenses for the selected property and time range.
        </p>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-indigo-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
