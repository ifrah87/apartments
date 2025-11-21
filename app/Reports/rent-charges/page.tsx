import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildRentChargeReport } from "@/lib/reports/rentInsights";

type SearchParams = {
  property?: string;
  effective?: string;
  query?: string;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

function defaultEffectiveDate() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export const runtime = "nodejs";

export default async function RentChangesPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const effective = searchParams.effective || defaultEffectiveDate();
  const report = await buildRentChargeReport(
    {
      propertyId: searchParams.property,
      effectiveDate: effective,
      query: searchParams.query,
    },
    properties,
  );

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Rent Charges
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Rent Charges</h1>
        <p className="text-sm text-slate-500">
          Track scheduled rent increases, renewals, and adjustments so billing stays aligned with leases.
        </p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            Effective on or after
            <input
              type="date"
              name="effective"
              defaultValue={effective}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tenant / unit
            <input
              type="text"
              name="query"
              defaultValue={searchParams.query || ""}
              placeholder="Search by name or unit"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:col-span-2 lg:col-span-1"
          >
            Update
          </button>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Upcoming changes" value={report.summary.upcomingChanges.toString()} />
        <SummaryCard
          label="Average change"
          value={formatMoney(report.summary.averageChange)}
        />
        <SummaryCard label="Next effective date" value={formatDate(effective)} emphasize />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Scheduled adjustments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2 text-right">Current rent</th>
                <th className="px-4 py-2 text-right">Next rent</th>
                <th className="px-4 py-2">Effective date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.propertyId}-${row.unit}-${row.effectiveDate}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">{row.unit}</div>
                    <div className="text-xs text-slate-500">{row.propertyName}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.tenant}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{formatMoney(row.currentRent)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-indigo-700">{formatMoney(row.nextRent)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.effectiveDate)}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {row.changeType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.notes}</td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No scheduled changes for the selected filters.
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-indigo-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
