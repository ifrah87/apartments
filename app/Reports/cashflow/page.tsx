import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildCashflowStatement } from "@/lib/reports/accountingReports";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SearchParams = {
  property?: string;
  start?: string;
  end?: string;
};

export const runtime = "nodejs";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function CashflowPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const defaults = defaultRange();
  const start = searchParams.start || defaults.start;
  const end = searchParams.end || defaults.end;
  const report = await buildCashflowStatement({ propertyId: searchParams.property, start, end });

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Cashflow
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Cashflow Statement</h1>
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

      <SectionCard>
        <div className="space-y-4">
          {report.sections.map((section) => (
            <div key={section.label} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
              <div>
                <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                <p className="text-xs text-slate-500">Cash impact</p>
              </div>
              <p className={`text-lg font-semibold ${section.change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {currency.format(section.change)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard>
          <p className="text-xs uppercase tracking-wide text-slate-500">Net change</p>
          <p className={`mt-2 text-3xl font-semibold ${report.netChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {currency.format(report.netChange)}
          </p>
        </SectionCard>
        <SectionCard>
          <p className="text-xs uppercase tracking-wide text-slate-500">Ending cash</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{currency.format(report.endingCash)}</p>
        </SectionCard>
      </div>
    </div>
  );
}
