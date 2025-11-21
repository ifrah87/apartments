import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildOccupancyReport } from "@/lib/reports/occupancyReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  property?: string;
  status?: "all" | "occupied" | "vacant";
  beds?: string;
};

export const runtime = "nodejs";

export default async function OccupancyReportPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const report = await buildOccupancyReport(
    {
      propertyId: searchParams.property,
      status: searchParams.status,
      beds: searchParams.beds,
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
          / Vacancy & Occupancy
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Vacancy & Occupancy</h1>
        <p className="text-sm text-slate-500">Track occupancy rate, rent at risk, and units that have been vacant the longest.</p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 md:grid-cols-5">
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
            Status
            <select
              name="status"
              defaultValue={searchParams.status || "all"}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Beds
            <select
              name="beds"
              defaultValue={searchParams.beds || ""}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {["0", "1", "2", "3"].map((bed) => (
                <option key={bed} value={bed}>
                  {bed} beds
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Update
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-5">
        <SummaryCard label="Total units" value={report.summary.totalUnits.toString()} />
        <SummaryCard label="Occupied" value={report.summary.occupiedUnits.toString()} />
        <SummaryCard label="Vacant" value={report.summary.vacantUnits.toString()} />
        <SummaryCard label="Occupancy" value={`${report.summary.occupancyRate}%`} />
        <SummaryCard label="Rent on books" value={currency.format(report.summary.expectedRent)} emphasize />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Unit detail</h2>
            <p className="text-sm text-slate-500">
              Average days vacant: <span className="font-semibold text-slate-900">{report.summary.averageDaysVacant} days</span>
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Rent</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Days vacant</th>
                <th className="px-4 py-2">Last move-in</th>
                <th className="px-4 py-2">Last move-out</th>
                <th className="px-4 py-2">Notes</th>
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
                  <td className="px-4 py-2 text-slate-600">{row.unitType || "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{currency.format(row.monthlyRent)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.status === "Occupied" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">{row.daysVacant}</td>
                  <td className="px-4 py-2 text-slate-600">{row.lastMoveIn ? new Date(row.lastMoveIn).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{row.lastMoveOut ? new Date(row.lastMoveOut).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{row.notes || "—"}</td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No units match the selected filters.
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
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${emphasize ? "ring-1 ring-emerald-100" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
