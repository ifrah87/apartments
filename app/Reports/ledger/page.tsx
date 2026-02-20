import Link from "next/link";
import { Suspense } from "react";
import SectionCard from "@/components/ui/SectionCard";
import { buildRentLedger } from "@/lib/reports/rentLedger";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";

type SearchParams = Record<string, string | string[] | undefined>;

type PropertyOption = { property_id: string; name?: string };

function formatDate(date: string | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(date),
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

async function getProperties(): Promise<PropertyOption[]> {
  const baseUrl = await getRequestBaseUrl();
  const res = await fetch(`${baseUrl}/api/properties`, { cache: "no-store" });
  if (!res.ok) return [];
  const payload = await res.json();
  if (payload?.ok === false) return [];
  return (payload?.ok ? payload.data : payload) || [];
}

export const runtime = "nodejs";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const start = (typeof sp.start === "string" ? sp.start : "") || defaultStart;
  const end = (typeof sp.end === "string" ? sp.end : "") || defaultEnd;
  const property = (typeof sp.property === "string" ? sp.property : "") || "";

  const [entries, properties] = await Promise.all([
    buildRentLedger({ start, end, propertyId: property || undefined }),
    getProperties(),
  ]);

  let runningBalance = 0;
  const rows = entries
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((entry) => {
      runningBalance += entry.amount;
      return { ...entry, balance: runningBalance };
    });

  const credits = entries.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const debits = entries.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/reports" className="text-indigo-600 hover:underline">
              Reports
            </Link>{" "}
            / Rent Ledger
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Rent Ledger</h1>
          <p className="text-sm text-slate-500">
            Statement period {formatDate(start)} – {formatDate(end)}
          </p>
        </div>
      </div>

      <SectionCard className="p-4">
        <form className="flex flex-wrap gap-3 text-sm" action="/reports/ledger">
          <div>
            <label className="text-xs uppercase text-slate-500">Properties</label>
            <select
              name="property"
              defaultValue={property}
              className="mt-1 w-48 rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.property_id} value={p.property_id}>
                  {p.name ?? p.property_id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Start</label>
            <input
              type="date"
              name="start"
              defaultValue={start}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">End</label>
            <input
              type="date"
              name="end"
              defaultValue={end}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              Update
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Credits" value={formatMoney(credits)} />
        <SummaryCard label="Debits" value={formatMoney(debits)} />
        <SummaryCard label="Net" value={formatMoney(credits + debits)} />
        <SummaryCard label="Entries" value={rows.length.toString()} />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Ledger Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2 text-right">Charge</th>
                <th className="px-4 py-2 text-right">Payment</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.date}-${row.description}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.date)}</td>
                  <td className="px-4 py-2 text-slate-900">{row.description || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{row.property_id || "—"}</td>
                  <td className="px-4 py-2 text-right text-rose-600">
                    {row.amount < 0 ? formatMoney(Math.abs(row.amount)) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-600">
                    {row.amount >= 0 ? formatMoney(row.amount) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">{formatMoney(row.balance)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No ledger entries for this period.
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
