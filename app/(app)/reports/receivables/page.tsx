import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";

type SearchParams = {
  q?: string;
  status?: "all" | "unpaid" | "partial";
};

type ReceivableRow = {
  id: string;
  unitId: string;
  unitLabel: string;
  tenantId: string;
  tenantName: string;
  period: string;
  invoiceDate?: string;
  dueDate?: string;
  total: number;
  amountPaid: number;
  outstanding: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
}

function statusPill(status: ReceivableRow["status"]) {
  if (status === "Partially Paid") return "bg-amber-100 text-amber-800";
  if (status === "Paid") return "bg-emerald-100 text-emerald-800";
  return "bg-rose-100 text-rose-700";
}

function ageLabel(referenceDate?: string) {
  if (!referenceDate) return "No due date";
  const due = new Date(referenceDate);
  if (Number.isNaN(due.getTime())) return referenceDate;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.floor((startOfToday.getTime() - startOfDue.getTime()) / 86400000);
  if (days > 0) return `${days}d overdue`;
  if (days === 0) return "Due today";
  return `Due in ${Math.abs(days)}d`;
}

async function fetchReceivables(): Promise<ReceivableRow[]> {
  const baseUrl = await getRequestBaseUrl();
  const res = await fetch(`${baseUrl}/api/bills`, { cache: "no-store" });
  if (!res.ok) return [];
  const payload = await res.json();
  const rows = (payload?.ok ? payload.data : payload) as ReceivableRow[] | undefined;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => Number(row?.outstanding || 0) > 0)
    .sort((a, b) => {
      const aTime = new Date(a.dueDate || a.invoiceDate || "").getTime();
      const bTime = new Date(b.dueDate || b.invoiceDate || "").getTime();
      const safeATime = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
      const safeBTime = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
      if (safeATime !== safeBTime) return safeATime - safeBTime;
      return b.outstanding - a.outstanding;
    });
}

export const runtime = "nodejs";

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const rows = await fetchReceivables();
  const query = String(sp.q || "").trim().toLowerCase();
  const statusFilter = sp.status || "all";

  const filteredRows = rows.filter((row) => {
    if (statusFilter === "partial" && row.status !== "Partially Paid") return false;
    if (statusFilter === "unpaid" && row.status !== "Unpaid") return false;
    if (!query) return true;
    const haystack = `${row.tenantName} ${row.unitLabel} ${row.period}`.toLowerCase();
    return haystack.includes(query);
  });

  const totals = filteredRows.reduce(
    (acc, row) => {
      acc.openInvoices += 1;
      acc.amountPaid += row.amountPaid || 0;
      acc.outstanding += row.outstanding || 0;
      if (row.status === "Partially Paid") acc.partialCount += 1;
      return acc;
    },
    { openInvoices: 0, partialCount: 0, amountPaid: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Receivables
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Receivables</h1>
        <p className="text-sm text-slate-500">
          Open invoices, partial payments, and the balance still left to collect.
        </p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
            Search
            <input
              type="text"
              name="q"
              defaultValue={sp.q || ""}
              placeholder="Tenant, unit, or period"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              name="status"
              defaultValue={statusFilter}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All open invoices</option>
              <option value="partial">Partially paid</option>
              <option value="unpaid">Fully unpaid</option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Update
          </button>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Open invoices" value={String(totals.openInvoices)} />
        <SummaryCard label="Partially paid" value={String(totals.partialCount)} />
        <SummaryCard label="Paid so far" value={formatMoney(totals.amountPaid)} />
        <SummaryCard label="Left to collect" value={formatMoney(totals.outstanding)} emphasize />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Open invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Tenant / Unit</th>
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2">Invoice date</th>
                <th className="px-4 py-2">Due date</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Left to pay</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Age</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">{row.tenantName}</div>
                    <div className="text-xs text-slate-500">{row.unitLabel}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.period || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.invoiceDate)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{formatMoney(row.total)}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">{formatMoney(row.amountPaid)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-rose-600">{formatMoney(row.outstanding)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{ageLabel(row.dueDate || row.invoiceDate)}</td>
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No open receivables match the current filters.
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
