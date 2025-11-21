import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildUnitFinancialReport } from "@/lib/reports/unitFinancialReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  property?: string;
  start?: string;
  end?: string;
};

export const runtime = "nodejs";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), 0, 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function UnitFinancialReportPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const defaults = defaultRange();
  const start = searchParams.start || defaults.start;
  const end = searchParams.end || defaults.end;
  const report = await buildUnitFinancialReport({ propertyId: searchParams.property, start, end }, properties);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Unit Financial Summary
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Unit Financial Summary</h1>
        <p className="text-sm text-slate-500">Measure rent collected vs. unit-level expenses to understand profitability per door.</p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Property
            <select
              name="property"
              defaultValue={searchParams.property || ""}
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
            <input type="date" name="start" defaultValue={start} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            End
            <input type="date" name="end" defaultValue={end} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Update
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Rent collected" value={currency.format(report.totals.rentCollected)} />
        <SummaryCard label="Expenses" value={currency.format(report.totals.expenses)} />
        <SummaryCard label="Net" value={currency.format(report.totals.net)} emphasize />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Per-unit performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Rent collected</th>
                <th className="px-4 py-2 text-right">Expenses</th>
                <th className="px-4 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.propertyId}-${row.unit}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">Unit {row.unit}</div>
                    <div className="text-xs text-slate-500">{row.propertyName}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.tenant || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{row.status}</td>
                  <td className="px-4 py-2 text-slate-600">{row.unitType || "—"}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{currency.format(row.rentCollected)}</td>
                  <td className="px-4 py-2 text-right text-rose-600">{currency.format(row.expenses)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${row.net >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                    {currency.format(row.net)}
                  </td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No units match the selected range.
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
