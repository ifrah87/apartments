import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildUtilityChargesReport } from "@/lib/reports/utilityReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

type SearchParams = {
  property?: string;
  start?: string;
  end?: string;
};

export const runtime = "nodejs";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function UtilityChargesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const properties = await fetchPropertyOptions();
  const defaults = defaultRange();
  const start = sp.start || defaults.start;
  const end = sp.end || defaults.end;
  const report = await buildUtilityChargesReport({ propertyId: sp.property, start, end }, properties);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Utility Charges
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Utility Charges</h1>
        <p className="text-sm text-slate-500">
          Compare billed utilities against collections, and highlight communal costs that still need recovery.
        </p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Property
            <select
              name="property"
              defaultValue={sp.property || ""}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.name ?? property.property_id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Start
            <input
              type="date"
              name="start"
              defaultValue={start}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            End
            <input
              type="date"
              name="end"
              defaultValue={end}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Update
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Charged" value={formatMoney(report.totals.charged)} />
        <SummaryCard label="Collected" value={formatMoney(report.totals.paid)} />
        <SummaryCard label="Outstanding" value={formatMoney(report.totals.balance)} emphasize />
        <SummaryCard label="Communal outstanding" value={formatMoney(report.communalTotals.balance)} />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Utility charges by tenant</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Tenant / Property</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Charged</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.tenantName}-${row.date}-${row.description}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">{row.tenantName}</div>
                    <div className="text-xs text-slate-500">{row.propertyName || "—"}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.description}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.amount)}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{formatMoney(row.paidAmount)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${row.balance > 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {formatMoney(row.balance)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.communal ? "Communal" : "Tenant"}</td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No utility charges recorded for the selected range.
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
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${emphasize ? "ring-1 ring-rose-100" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
