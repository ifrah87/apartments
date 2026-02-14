import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";

type SearchParams = {
  property?: string;
  tenant?: string;
  unit?: string;
  start?: string;
  end?: string;
};

type Tenant = {
  id: string;
  name: string;
  building?: string;
  property_id?: string;
  unit?: string;
};

type StatementRow = {
  date: string;
  description: string;
  charge: number;
  payment: number;
  balance: number;
  entryType: "charge" | "payment";
  source?: string;
};

type StatementResponse = {
  tenant: {
    id: string;
    name: string;
    property?: string;
    unit?: string;
    monthlyRent: number;
    dueDay: number;
  };
  period: { start: string; end: string };
  totals: { charges: number; payments: number; balance: number };
  rows: StatementRow[];
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function defaultDates() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function fetchTenants(): Promise<Tenant[]> {
  try {
    const baseUrl = await getRequestBaseUrl();
    const res = await fetch(`${baseUrl}/api/tenants`, { cache: "no-store" });
    if (!res.ok) return [];
    const payload = await res.json();
    if (payload?.ok === false) return [];
    return (payload?.ok ? payload.data : payload) as Tenant[];
  } catch (err) {
    console.error("Failed to load tenants", err);
    return [];
  }
}

async function fetchStatement(tenantId: string, start: string, end: string): Promise<StatementResponse | null> {
  if (!tenantId) return null;
  const baseUrl = await getRequestBaseUrl();
  const res = await fetch(`${baseUrl}/api/tenants/${tenantId}/statement?start=${start}&end=${end}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const payload = await res.json();
  if (payload?.ok === false) return null;
  return (payload?.ok ? payload.data : payload) as StatementResponse;
}

export const runtime = "nodejs";

export default async function TenantLedgerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const tenants = await fetchTenants();
  const properties = await fetchPropertyOptions();
  const defaults = defaultDates();
  const propertyFilter = sp.property || "";
  const unitFilter = sp.unit || "";
  const filteredTenants = tenants.filter((tenant) => {
    if (propertyFilter && tenant.property_id !== propertyFilter && tenant.building !== propertyFilter) return false;
    if (unitFilter && (tenant.unit || "").toLowerCase() !== unitFilter.toLowerCase()) return false;
    return true;
  });
  const tenantId = sp.tenant || filteredTenants[0]?.id || "";
  const start = sp.start || defaults.start;
  const end = sp.end || defaults.end;
  const statement = tenantId ? await fetchStatement(tenantId, start, end) : null;
  const exportParams = new URLSearchParams({ start, end, format: "csv" });
  const exportHref = tenantId ? `/api/tenants/${tenantId}/statement?${exportParams.toString()}` : null;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Tenant Ledger
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Tenant Ledger</h1>
        <p className="text-sm text-slate-500">Complete transaction history per tenant for reconciliation and audits.</p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 lg:grid-cols-6">
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property</span>
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</label>
            <input
              type="text"
              name="unit"
              defaultValue={unitFilter}
              placeholder="Unit #"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant</label>
            <select
              name="tenant"
              defaultValue={tenantId}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {filteredTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} · {tenant.unit || "Unit ?"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start</label>
            <input
              type="date"
              name="start"
              defaultValue={start}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">End</label>
            <input
              type="date"
              name="end"
              defaultValue={end}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Update
            </button>
          </div>
        </form>
      </SectionCard>

      {statement ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Total charges" value={formatMoney(statement.totals.charges)} />
            <SummaryCard label="Total payments" value={formatMoney(statement.totals.payments)} />
            <SummaryCard label="Balance" value={formatMoney(statement.totals.balance)} emphasize />
          </div>

          <SectionCard className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {statement.tenant.name} · Unit {statement.tenant.unit || "—"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {formatDate(statement.period.start)} – {formatDate(statement.period.end)}
                  </p>
                </div>
                {exportHref && (
                  <a
                    href={exportHref}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                  >
                    Download CSV
                  </a>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right">Charge</th>
                    <th className="px-4 py-2 text-right">Payment</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                    <th className="px-4 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.map((row) => (
                    <tr key={`${row.date}-${row.description}-${row.balance}`} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-600">{formatDate(row.date)}</td>
                      <td className="px-4 py-2 text-slate-700 capitalize">{row.entryType}</td>
                      <td className="px-4 py-2 text-slate-900">{row.description}</td>
                      <td className="px-4 py-2 text-right text-slate-900">
                        {row.charge ? formatMoney(row.charge) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-emerald-600">
                        {row.payment ? formatMoney(row.payment) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-900">
                        {formatMoney(row.balance)}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{row.source ? row.source : row.entryType === "charge" ? "Schedule" : "Bank"}</td>
                    </tr>
                  ))}
                  {!statement.rows.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No ledger activity for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : (
        <SectionCard className="p-6 text-center text-sm text-slate-500">Select a tenant to view ledger activity.</SectionCard>
      )}
    </div>
  );
}

function SummaryCard({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-indigo-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
