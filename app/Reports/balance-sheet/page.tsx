import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildBalanceSheet } from "@/lib/reports/accountingReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  property?: string;
  end?: string;
};

export const runtime = "nodejs";

function defaultDate() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

export default async function BalanceSheetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const properties = await fetchPropertyOptions();
  const end = sp.end || defaultDate();
  const report = await buildBalanceSheet({ propertyId: sp.property, end });

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Balance Sheet
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Balance Sheet</h1>
        <p className="text-sm text-slate-500">Snapshot as of {end}</p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 md:grid-cols-3">
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
            As of date
            <input type="date" name="end" defaultValue={end} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Update
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        {[report.assets, report.liabilities, report.equity].map((section) => (
          <SectionCard key={section.label} className="p-0">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">{section.label}</h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.accountId} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-2 text-slate-600">{row.accountName}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{currency.format(row.balance)}</td>
                  </tr>
                ))}
                {!section.rows.length && (
                  <tr>
                    <td className="px-4 py-4 text-center text-slate-500" colSpan={2}>
                      No activity.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-sm font-semibold">
                  <td className="px-4 py-2 text-slate-900">Total</td>
                  <td className="px-4 py-2 text-right text-slate-900">{currency.format(section.total)}</td>
                </tr>
              </tfoot>
            </table>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
