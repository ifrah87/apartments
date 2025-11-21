import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildReconciliationReport } from "@/lib/reports/bankReconciliation";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  property?: string;
};

export const runtime = "nodejs";

export default async function BankReconciliationPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const report = await buildReconciliationReport({ propertyId: searchParams.property });

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Bank Reconciliation
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Bank Reconciliation</h1>
        <p className="text-sm text-slate-500">Compare book vs bank balances and list reconciling items.</p>
      </header>

      <SectionCard className="p-4">
        <form className="flex flex-wrap gap-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Property
            <select name="property" defaultValue={searchParams.property || ""} className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.name ?? property.property_id}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            Update
          </button>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Bank balance" value={currency.format(report.bankBalance)} />
        <SummaryCard label="Book balance" value={currency.format(report.bookBalance)} />
        <SummaryCard label="Difference" value={currency.format(report.difference)} emphasize />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReconciliationTable title="Outstanding payments" rows={report.outstandingPayments} empty="No outstanding payments." />
        <ReconciliationTable title="Deposits in transit" rows={report.inTransitDeposits} empty="No deposits in transit." />
      </div>
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

function ReconciliationTable({ title, rows, empty }: { title: string; rows: { date: string; description: string; amount: string }[]; empty: string }) {
  return (
    <SectionCard className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.date}-${row.description}`} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-slate-900">{row.description}</td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">{row.amount}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </SectionCard>
  );
}
