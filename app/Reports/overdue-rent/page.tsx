import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildOverdueRentReport } from "@/lib/reports/rentInsights";

type SearchParams = {
  property?: string;
  days?: string;
  status?: "active" | "moved_out" | "all";
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export const runtime = "nodejs";

export default async function OverdueRentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const properties = await fetchPropertyOptions();
  const days = Number(sp.days || 30);
  const report = await buildOverdueRentReport(
    {
      propertyId: sp.property,
      days,
      tenantStatus: sp.status,
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
          / Overdue Rent
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Overdue Rent</h1>
        <p className="text-sm text-slate-500">Collections view highlighting tenants in arrears and outstanding balances.</p>
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
            Days overdue
            <select
              name="days"
              defaultValue={String(days)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {[30, 60, 90].map((option) => (
                <option key={option} value={option}>
                  {option}+ days
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tenant status
            <select
              name="status"
              defaultValue={sp.status || "all"}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="moved_out">Moved out</option>
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
        <SummaryCard label="Total overdue" value={formatMoney(report.totals.totalBalance)} emphasize />
        <SummaryCard label="Tenants owing" value={report.totals.tenantCount.toString()} />
        <SummaryCard
          label="Worst balance"
          value={report.worstTen.length ? formatMoney(report.worstTen[0].outstandingBalance) : "—"}
        />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Delinquent tenants</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2 text-right">Monthly rent</th>
                <th className="px-4 py-2">Last payment</th>
                <th className="px-4 py-2 text-right">Outstanding balance</th>
                <th className="px-4 py-2">Days overdue</th>
                <th className="px-4 py-2">Contact</th>
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
                  <td className="px-4 py-2 text-slate-700">{row.unit}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{formatMoney(row.monthlyRent)}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {row.lastPaymentDate ? `${formatDate(row.lastPaymentDate)} · ${formatMoney(row.lastPaymentAmount || 0)}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-rose-600">
                    {formatMoney(row.outstandingBalance)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.daysOverdue} days</td>
                  <td className="px-4 py-2 text-slate-600">
                    <div>{row.contactPhone}</div>
                    <div className="text-xs text-slate-400">{row.contactEmail}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.notes}</td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No overdue tenants matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h2 className="text-lg font-semibold text-slate-900">Worst 10 offenders</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {report.worstTen.map((row, index) => (
            <li key={`${row.tenant}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {index + 1}. {row.tenant} · Unit {row.unit}
                </p>
                <p className="text-xs text-slate-500">{row.propertyName}</p>
              </div>
              <div className="text-sm font-semibold text-rose-600">{formatMoney(row.outstandingBalance)}</div>
            </li>
          ))}
          {!report.worstTen.length && <li className="text-slate-500">No arrears beyond the current threshold.</li>}
        </ol>
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
