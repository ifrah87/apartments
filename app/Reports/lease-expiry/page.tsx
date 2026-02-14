import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildLeaseExpiryReport } from "@/lib/reports/rentInsights";

type SearchParams = {
  property?: string;
  range?: string;
  unitType?: string;
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export const runtime = "nodejs";

export default async function LeaseExpiryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const properties = await fetchPropertyOptions();
  const range = Number(sp.range || 60);
  const report = await buildLeaseExpiryReport(
    {
      propertyId: sp.property,
      range,
      unitType: sp.unitType,
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
          / Lease Expiry
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Lease Expiry</h1>
        <p className="text-sm text-slate-500">Know which leases need renewals or move-out planning in the coming weeks.</p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            Expiring within
            <select
              name="range"
              defaultValue={String(range)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {[30, 60, 90].map((option) => (
                <option key={option} value={option}>
                  Next {option} days
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unit size
            <select
              name="unitType"
              defaultValue={sp.unitType || ""}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All sizes</option>
              {report.unitTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
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
        <SummaryCard label="Leases expiring" value={report.totals.expiring.toString()} />
        <SummaryCard label="Renewals confirmed" value={report.totals.confirmed.toString()} />
        <SummaryCard label="Potential vacancies" value={report.totals.vacancies.toString()} emphasize />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming expirations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Lease start</th>
                <th className="px-4 py-2">Lease end</th>
                <th className="px-4 py-2">Notice required</th>
                <th className="px-4 py-2">Days until expiry</th>
                <th className="px-4 py-2">Renewal status</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.propertyId}-${row.unit}-${row.tenant}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">{row.tenant}</div>
                    <div className="text-xs text-slate-500">{row.propertyName}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    <div>{row.unit}</div>
                    <div className="text-xs text-slate-500">{row.unitType}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.leaseStart)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.leaseEnd)}</td>
                  <td className="px-4 py-2 text-slate-600">{row.noticeDays} days</td>
                  <td className="px-4 py-2 text-slate-900">{row.daysUntilExpiry}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        row.renewalStatus === "Confirmed"
                          ? "bg-emerald-50 text-emerald-700"
                          : row.renewalStatus === "Sent"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {row.renewalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.notes}</td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No leases expiring in the selected window.
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
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
