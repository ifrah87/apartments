import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildMaintenanceReport } from "@/lib/reports/maintenanceReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  property?: string;
  status?: string;
};

export const runtime = "nodejs";

export default async function MaintenanceReportPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const report = await buildMaintenanceReport({ propertyId: searchParams.property, status: searchParams.status }, properties);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Maintenance
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Maintenance</h1>
        <p className="text-sm text-slate-500">Prioritize open tickets, see vendor costs, and monitor in-progress jobs.</p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 md:grid-cols-3">
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
              defaultValue={searchParams.status || ""}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Update
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Open" value={report.summary.open.toString()} />
        <SummaryCard label="In progress" value={report.summary.inProgress.toString()} />
        <SummaryCard label="Completed" value={report.summary.completed.toString()} />
        <SummaryCard label="High priority" value={report.summary.highPriority.toString()} emphasize />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Tickets</h2>
          <p className="text-sm text-slate-500">Total cost recorded: {currency.format(report.summary.totalCost)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Ticket</th>
                <th className="px-4 py-2">Property / Unit</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Opened</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.ticketId} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-semibold text-slate-900">{row.ticketId}</td>
                  <td className="px-4 py-2 text-slate-700">
                    <div>{row.propertyName}</div>
                    <div className="text-xs text-slate-500">Unit {row.unit || "—"}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.category || "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.priority === "High" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.status === "Completed" ? "bg-emerald-50 text-emerald-700" : row.status === "In progress" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.openedAt ? new Date(row.openedAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{row.vendor || "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{currency.format(row.cost)}</td>
                  <td className="px-4 py-2 text-slate-600">{row.description || "—"}</td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No tickets match the selected filters.
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
