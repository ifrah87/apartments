import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { loadBankImportSummary } from "@/lib/reports/bankReports";
import ReportOpenTracker from "@/components/reports/ReportOpenTracker";
import ReportControlsBar from "@/components/reports/ReportControlsBar";

const number = new Intl.NumberFormat("en-US");

export const runtime = "nodejs";

type SearchParams = {
  from?: string;
  to?: string;
  start?: string;
  end?: string;
  propertyId?: string;
  property?: string;
};

export default async function BankImportSummaryPage({ searchParams }: { searchParams: SearchParams }) {
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const start = searchParams.from || searchParams.start || defaultStart;
  const end = searchParams.to || searchParams.end || defaultEnd;
  const propertyId = searchParams.propertyId || searchParams.property || "all";
  const report = await loadBankImportSummary();

  return (
    <div className="space-y-6 p-6">
      <ReportOpenTracker id="banking:bankImports" title="Bank Imports" href="/reports/bank-imports" />
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}/ Bank Imports
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Bank Imports</h1>
        <p className="text-sm text-slate-500">Review the results of each bank statement import and outstanding matches.</p>
      </header>

      <ReportControlsBar action="/reports/bank-imports" start={start} end={end} property={propertyId} properties={[]} />

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Total lines" value={number.format(report.totals.totalLines)} />
        <SummaryCard label="Matched" value={number.format(report.totals.matched)} />
        <SummaryCard label="Unmatched" value={number.format(report.totals.unmatched)} emphasize />
        <SummaryCard label="Reconciled" value={number.format(report.totals.reconciled)} />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Imports</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Import date</th>
              <th className="px-4 py-2 text-right">Total lines</th>
              <th className="px-4 py-2 text-right">Matched</th>
              <th className="px-4 py-2 text-right">Unmatched</th>
              <th className="px-4 py-2 text-right">Reconciled</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.date} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-900">{new Date(row.date).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">{number.format(row.totalLines)}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{number.format(row.matched)}</td>
                <td className="px-4 py-2 text-right text-rose-600">{number.format(row.unmatched)}</td>
                <td className="px-4 py-2 text-right">{number.format(row.reconciled)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

function SummaryCard({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <SectionCard className={`p-4 ${emphasize ? "ring-1 ring-rose-100" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
    </SectionCard>
  );
}
