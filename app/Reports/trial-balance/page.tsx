import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildTrialBalance } from "@/lib/reports/accountingReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  property?: string;
  start?: string;
  end?: string;
};

export const runtime = "nodejs";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const properties = await fetchPropertyOptions();
  const defaults = defaultRange();
  const start = sp.start || defaults.start;
  const end = sp.end || defaults.end;
  const rows = await buildTrialBalance({ propertyId: sp.property, start, end });

  const debitTotal = rows.reduce((sum, row) => sum + row.debit, 0);
  const creditTotal = rows.reduce((sum, row) => sum + row.credit, 0);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Trial Balance
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Trial Balance</h1>
        <p className="text-sm text-slate-500">
          {start} to {end}
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
          <h2 className="text-lg font-semibold text-slate-900">Account balances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2 text-right">Debits</th>
                <th className="px-4 py-2 text-right">Credits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.accountId} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">{row.accountName}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{currency.format(row.debit)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{currency.format(row.credit)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    No entries for this period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 text-sm font-semibold">
                <td className="px-4 py-2 text-slate-900">Totals</td>
                <td className="px-4 py-2 text-right text-slate-900">{currency.format(debitTotal)}</td>
                <td className="px-4 py-2 text-right text-slate-900">{currency.format(creditTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
