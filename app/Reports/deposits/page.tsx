import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildDepositReport } from "@/lib/reports/depositReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

type SearchParams = {
  property?: string;
};

export const runtime = "nodejs";

export default async function DepositsReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const properties = await fetchPropertyOptions();
  const report = await buildDepositReport({ propertyId: sp.property }, properties);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Deposits
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Deposits</h1>
        <p className="text-sm text-slate-500">
          Track deposit balances per tenant and audit releases, deductions, and damages.
        </p>
      </header>

      <SectionCard className="p-4">
        <form className="flex flex-wrap gap-4">
          <label className="grow text-xs font-semibold uppercase tracking-wide text-slate-500">
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
          <button
            type="submit"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Apply
          </button>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Charged" value={formatMoney(report.totals.charged)} />
        <SummaryCard label="Received" value={formatMoney(report.totals.received)} />
        <SummaryCard label="Released" value={formatMoney(report.totals.released)} />
        <SummaryCard label="Held" value={formatMoney(report.totals.held)} emphasize />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Tenant deposit balances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2 text-right">Charged</th>
                <th className="px-4 py-2 text-right">Received</th>
                <th className="px-4 py-2 text-right">Released</th>
                <th className="px-4 py-2 text-right">Held</th>
                <th className="px-4 py-2">Last activity</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.tenantId} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">{row.tenantName}</div>
                    <div className="text-xs text-slate-500">{row.propertyName}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.unit || "—"}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.charged)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(row.received)}</td>
                  <td className="px-4 py-2 text-right text-rose-600">{formatMoney(row.released)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatMoney(row.held)}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {row.lastActivity ? (
                      <div>
                        <div className="font-medium capitalize">{row.lastActivityType}</div>
                        <div className="text-xs">{new Date(row.lastActivity).toLocaleDateString()}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.notes || "—"}</td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No tenants match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Deposit activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {report.transactions.map((txn) => (
                <tr key={`${txn.tenantId}-${txn.date}-${txn.type}-${txn.amount}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{new Date(txn.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">{txn.tenantName}</div>
                    <div className="text-xs text-slate-500">{txn.propertyName}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{txn.unit || "—"}</td>
                  <td className="px-4 py-2 capitalize text-slate-700">{txn.type}</td>
                  <td className={`px-4 py-2 text-right ${txn.amount < 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {formatMoney(txn.amount)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{txn.note || "—"}</td>
                </tr>
              ))}
              {!report.transactions.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No activity recorded for the current filters.
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
