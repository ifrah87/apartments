import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import ReportControlsBar from "@/components/reports/ReportControlsBar";
import ReportOpenTracker from "@/components/reports/ReportOpenTracker";

type TenantRecord = {
  id: string;
  name: string;
  property_id?: string;
  building?: string;
  unit?: string;
  phone?: string;
  monthly_rent?: string | number;
  due_day?: string | number;
  due_date?: string;
  next_due_date?: string;
};

type PaymentRecord = {
  date: string;
  tenant_id?: string | number;
  type?: string;
};

type UpcomingRow = {
  tenant: string;
  propertyId: string;
  propertyName?: string;
  unit: string;
  dueDate: string;
  amount: number;
  daysUntil: number;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const runtime = "nodejs";

type SearchParams = {
  from?: string;
  to?: string;
  start?: string;
  end?: string;
  propertyId?: string;
  property?: string;
};

export default async function UpcomingPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const start = sp.from || sp.start || defaultStart;
  const end = sp.to || sp.end || defaultEnd;
  const propertyId = sp.propertyId || sp.property || "all";
  const [tenants, payments, properties] = await Promise.all([
    fetchJson<TenantRecord[]>("/api/tenants"),
    fetchJson<PaymentRecord[]>("/api/payments"),
    fetchPropertyOptions(),
  ]);

  const referenceDate = deriveReferenceDate(payments);
  const paidIndex = buildPaidIndex(payments);
  const rows = buildUpcomingRows(tenants, properties, referenceDate, paidIndex);
  const filteredRows = rows.filter((row) => {
    if (propertyId !== "all" && row.propertyId !== propertyId) return false;
    if (start && row.dueDate < start) return false;
    if (end && row.dueDate > end) return false;
    return true;
  });
  const totalAmount = filteredRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-6 p-6">
      <ReportOpenTracker id="payments:upcoming" title="Upcoming Payments" href="/reports/upcoming-payments" />
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Upcoming Payments
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Upcoming Payments</h1>
        <p className="text-sm text-slate-500">
          Tenants with rent due in the next 7 days from the most recent payment date.
        </p>
      </header>

      <ReportControlsBar
        action="/reports/upcoming-payments"
        start={start}
        end={end}
        property={propertyId}
        properties={properties.map((property) => ({ id: property.property_id, name: property.name }))}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Upcoming total" value={currency.format(totalAmount)} emphasize />
        <SummaryCard label="Payments due" value={filteredRows.length.toString()} />
        <SummaryCard label="Reference date" value={referenceDate.toLocaleDateString("en-US")} />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Due soon</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Due date</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Days until due</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={`${row.propertyId}-${row.unit}-${row.tenant}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">{row.tenant}</div>
                    <div className="text-xs text-slate-500">{row.propertyName || row.propertyId}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.unit}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{currency.format(row.amount)}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{row.daysUntil}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No upcoming payments in the next 7 days.
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
    <SectionCard className={`p-4 ${emphasize ? "ring-1 ring-emerald-100" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-emerald-600" : "text-slate-900"}`}>
        {value}
      </p>
    </SectionCard>
  );
}

async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = await getRequestBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || `Failed to fetch ${path}`);
  return (payload?.ok ? payload.data : payload) as T;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function deriveReferenceDate(payments: PaymentRecord[]): Date {
  const dates = payments
    .map((p) => safeDate(p.date))
    .filter((d): d is Date => Boolean(d));
  if (!dates.length) return new Date();
  return dates.reduce((latest, current) => (current > latest ? current : latest));
}

function safeDate(value?: string | number | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveDueDate(tenant: TenantRecord, referenceDate: Date): Date | null {
  const explicitDate = safeDate(tenant.due_date || tenant.next_due_date);
  if (explicitDate) return explicitDate;
  const dueDayRaw = tenant.due_day;
  const dueDay = Number(dueDayRaw);
  if (!Number.isFinite(dueDay)) return null;
  const due = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), dueDay);
  if (due < referenceDate) {
    due.setMonth(due.getMonth() + 1);
  }
  return due;
}

function buildUpcomingRows(
  tenants: TenantRecord[],
  properties: { property_id: string; name?: string }[],
  referenceDate: Date,
  paidIndex: Map<string, Set<string>>,
) {
  const rows: UpcomingRow[] = [];
  tenants.forEach((tenant) => {
    const due = resolveDueDate(tenant, referenceDate);
    if (!due) return;
    const diffDays = Math.floor((due.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 7) return;
    const tenantId = normalizeId(tenant.id);
    const monthKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
    if (paidIndex.get(monthKey)?.has(tenantId)) return;
    const propertyId = tenant.property_id || tenant.building || "";
    const propertyName = properties.find((p) => (p.property_id || "").toLowerCase() === propertyId.toLowerCase())?.name;
    rows.push({
      tenant: tenant.name,
      propertyId,
      propertyName,
      unit: tenant.unit || "—",
      dueDate: due.toISOString().slice(0, 10),
      amount: Number(tenant.monthly_rent || 0),
      daysUntil: diffDays,
    });
  });

  return rows.sort((a, b) => a.daysUntil - b.daysUntil);
}

function normalizeId(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\.0$/, "");
}

function buildPaidIndex(payments: PaymentRecord[]) {
  const index = new Map<string, Set<string>>();
  payments.forEach((payment) => {
    if (payment.type && payment.type !== "rent_inflow") return;
    const tenantId = normalizeId(payment.tenant_id);
    if (!tenantId) return;
    const paidDate = safeDate(payment.date);
    if (!paidDate) return;
    const monthKey = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, "0")}`;
    if (!index.has(monthKey)) {
      index.set(monthKey, new Set());
    }
    index.get(monthKey)!.add(tenantId);
  });
  return index;
}
