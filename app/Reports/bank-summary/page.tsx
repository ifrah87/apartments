import Link from "next/link";
import { fetchLedger, isUnreconciled } from "@/lib/reports/ledger";
import UnreconciledTable from "@/components/UnreconciledTable";
import { getTransactionCategories } from "@/lib/reports/categoryStore";
import BankStatementExporter from "@/components/BankStatementExporter";

type SearchParams = { start?: string; end?: string };

export const runtime = "nodejs";

export default async function BankSummaryPage({ searchParams }: { searchParams: SearchParams }) {
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const start = searchParams.start || defaultStart;
  const end = searchParams.end || defaultEnd;

  const [ledger, categories] = await Promise.all([fetchLedger(), getTransactionCategories()]);
  const augmented = ledger
    .map((txn) => ({ ...txn, dateObj: new Date(txn.date) }))
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const openingBalance = augmented
    .filter((txn) => txn.dateObj < new Date(start))
    .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);

  let running = openingBalance;
  const statementLines = augmented
    .filter((txn) => txn.dateObj >= new Date(start) && txn.dateObj <= new Date(end))
    .map((txn) => {
      running += Number(txn.amount) || 0;
      return { ...txn, runningBalance: running };
    });
  const usedCategoryIds = new Set(Object.keys(categories || {}));
  const unreconciledRows = statementLines
    .filter(isUnreconciled)
    .filter((line) => !usedCategoryIds.has(String(line.id ?? `${line.date}-${line.description}`)));
  const showUnreconciledOnly = searchParams.view === "unreconciled";
  const visibleLines = showUnreconciledOnly ? unreconciledRows : statementLines;

  const cashIn = statementLines.filter((l) => l.amount >= 0).reduce((sum, l) => sum + l.amount, 0);
  const cashOut = statementLines.filter((l) => l.amount < 0).reduce((sum, l) => sum + Math.abs(l.amount), 0);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Bank Statement
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Bank Statement</h1>
        <p className="text-sm text-slate-500">
          For the period {formatDisplayDate(start)} – {formatDisplayDate(end)}
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Start date</label>
          <input type="date" name="start" defaultValue={start} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">End date</label>
          <input type="date" name="end" defaultValue={end} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Bank account</label>
          <select className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option>Business Bank Account</option>
          </select>
        </div>
        <button type="submit" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          Update
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Opening balance" value={`$${formatNumber(openingBalance)}`} />
        <SummaryCard label="Cash in" value={`$${formatNumber(cashIn)}`} />
        <SummaryCard label="Cash out" value={`$${formatNumber(cashOut)}`} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Statement lines</h2>
              {showUnreconciledOnly ? (
                <p className="text-sm text-rose-600">{unreconciledRows.length} unreconciled items shown</p>
              ) : (
                <p className="text-sm text-slate-500">{unreconciledRows.length} unreconciled items</p>
              )}
            </div>
            <Link
              href={
                showUnreconciledOnly
                  ? `/reports/bank-summary?start=${start}&end=${end}`
                  : `/reports/bank-summary?start=${start}&end=${end}&view=unreconciled`
              }
              className="text-sm font-semibold text-indigo-600 hover:underline"
            >
              {showUnreconciledOnly ? "Show all entries" : "Show unreconciled only"}
            </Link>
            </div>
          </div>
          <BankStatementExporter
            fileName={`bank-statement-${start}-to-${end}`}
            rows={visibleLines.map((line) => ({
              id: String(line.id ?? `${line.date}-${line.description}`),
              date: line.date,
              description: line.description || "",
              reference: line.reference || "",
              property: line.property_id || "",
              debit: line.amount < 0 ? Math.abs(line.amount) : 0,
              credit: line.amount >= 0 ? line.amount : 0,
              balance: line.runningBalance,
            }))}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-2">Date</th>
                <th className="px-6 py-2">Description</th>
                <th className="px-6 py-2">Reference</th>
                <th className="px-6 py-2">Property</th>
                <th className="px-6 py-2 text-right">Debit</th>
                <th className="px-6 py-2 text-right">Credit</th>
                <th className="px-6 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100 bg-slate-50">
                <td className="px-6 py-3 text-slate-600">{formatDisplayDate(start)}</td>
                <td className="px-6 py-3 font-semibold text-slate-900">Opening Balance</td>
                <td className="px-6 py-3 text-slate-500">—</td>
                <td className="px-6 py-3 text-slate-500">—</td>
                <td className="px-6 py-3 text-right text-slate-500">—</td>
                <td className="px-6 py-3 text-right text-slate-500">—</td>
                <td className="px-6 py-3 text-right font-semibold text-slate-900">${formatNumber(openingBalance)}</td>
              </tr>
              {visibleLines.map((line) => (
                <tr key={`${line.date}-${line.description}`} className="border-t border-slate-100">
                  <td className="px-6 py-2 text-slate-600">{formatDisplayDate(line.date)}</td>
                  <td className="px-6 py-2 text-slate-900">{line.description || "—"}</td>
                  <td className="px-6 py-2 text-slate-500">{line.reference || "—"}</td>
                  <td className="px-6 py-2 text-slate-500">{line.property_id || "—"}</td>
                  <td className="px-6 py-2 text-right font-medium text-rose-600">
                    {line.amount < 0 ? `$${formatNumber(Math.abs(line.amount))}` : "—"}
                  </td>
                  <td className="px-6 py-2 text-right font-medium text-emerald-600">
                    {line.amount >= 0 ? `$${formatNumber(line.amount)}` : "—"}
                  </td>
                  <td className="px-6 py-2 text-right font-semibold text-slate-900">${formatNumber(line.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unreconciledRows.length > 0 && (
        <UnreconciledTable
          rows={unreconciledRows.map((line) => ({
            id: String(line.id ?? `${line.date}-${line.description}`),
            date: line.date,
            description: line.description || "",
            amount: line.amount,
            property: line.property_id || "",
            reference: line.reference || "",
          }))}
          initialCategories={categories}
        />
      )}
    </div>
  );
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatDisplayDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
