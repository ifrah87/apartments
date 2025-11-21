import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildGeneralLedger } from "@/lib/reports/accountingReports";
import { listChartOfAccounts } from "@/lib/reports/accountingReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  property?: string;
  start?: string;
  end?: string;
  account?: string;
};

export const runtime = "nodejs";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function GeneralLedgerPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const accounts = listChartOfAccounts();
  const defaults = defaultRange();
  const start = searchParams.start || defaults.start;
  const end = searchParams.end || defaults.end;
  const ledger = await buildGeneralLedger({ propertyId: searchParams.property, start, end, accountId: searchParams.account });

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / General Ledger
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">General Ledger</h1>
        <p className="text-sm text-slate-500">
          {start} to {end}
        </p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 md:grid-cols-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Property
            <select name="property" defaultValue={searchParams.property || ""} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.name ?? property.property_id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Account
            <select name="account" defaultValue={searchParams.account || ""} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.id} · {account.name}
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

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Ledger entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Entry</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Debit</th>
                <th className="px-4 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={`${row.entryId}-${row.accountId}-${row.date}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-slate-900">{row.entryId}</td>
                  <td className="px-4 py-2 text-slate-700">{row.accountName}</td>
                  <td className="px-4 py-2 text-slate-600">{row.description || "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{currency.format(row.debit)}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{currency.format(row.credit)}</td>
                </tr>
              ))}
              {!ledger.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No ledger activity for this selection.
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
