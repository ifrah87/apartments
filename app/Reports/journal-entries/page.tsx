import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { listJournalEntries } from "@/lib/reports/accountingReports";

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

export default async function JournalEntriesPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const defaults = defaultRange();
  const start = searchParams.start || defaults.start;
  const end = searchParams.end || defaults.end;
  const entries = await listJournalEntries({ propertyId: searchParams.property, start, end });

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Journal Entries
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Journal Entries</h1>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 md:grid-cols-4">
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

      <div className="space-y-4">
        {entries.map((entry) => (
          <SectionCard key={entry.entryId} className="p-0">
            <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{entry.entryId}</h2>
                <p className="text-sm text-slate-500">
                  {new Date(entry.date).toLocaleDateString()} · {entry.propertyId}
                </p>
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{entry.lines.length} lines</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Debit</th>
                  <th className="px-4 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={`${entry.entryId}-${line.accountId}`} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-900">{line.accountName}</td>
                    <td className="px-4 py-2 text-slate-600">{line.description || "—"}</td>
                    <td className="px-4 py-2 text-right text-slate-900">{line.debit ? line.debit.toFixed(2) : ""}</td>
                    <td className="px-4 py-2 text-right text-slate-900">{line.credit ? line.credit.toFixed(2) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        ))}
        {!entries.length && <SectionCard className="p-6 text-center text-sm text-slate-500">No journal entries for this filter.</SectionCard>}
      </div>
    </div>
  );
}
