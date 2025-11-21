import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { buildRentRollReport } from "@/lib/reports/rentInsights";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function defaultMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

type SearchParams = {
  property?: string;
  month?: string;
  unitType?: string;
  occupancy?: "all" | "occupied" | "vacant";
};

export const runtime = "nodejs";

export default async function RentRollPage({ searchParams }: { searchParams: SearchParams }) {
  const properties = await fetchPropertyOptions();
  const monthParam = searchParams.month || defaultMonth();
  const report = await buildRentRollReport(
    {
      propertyId: searchParams.property,
      month: monthParam,
      unitType: searchParams.unitType,
      occupancy: searchParams.occupancy,
    },
    properties,
  );

  const totals = report.rows.reduce(
    (acc, row) => {
      acc.rentDue += row.rentDue;
      acc.rentReceived += row.rentReceived;
      acc.balance += row.balance;
      acc.deposit += row.depositHeld;
      return acc;
    },
    { rentDue: 0, rentReceived: 0, balance: 0, deposit: 0 },
  );

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Rent Roll
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Rent Roll</h1>
        <p className="text-sm text-slate-500">
          Live rent status across every occupied unit, including arrears, deposits, and last payment method.
        </p>
      </header>

      <SectionCard className="p-4">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            Month
            <input
              type="month"
              name="month"
              defaultValue={monthParam}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unit type
            <select
              name="unitType"
              defaultValue={searchParams.unitType || ""}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              {report.unitTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Occupancy
            <select
              name="occupancy"
              defaultValue={searchParams.occupancy || "all"}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All units</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:col-span-2 lg:col-span-1"
          >
            Update
          </button>
        </form>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Total units" value={report.totals.totalUnits.toString()} />
        <SummaryCard label="Occupied" value={report.totals.occupiedUnits.toString()} />
        <SummaryCard label="Rent due" value={formatMoney(totals.rentDue)} />
        <SummaryCard label="Rent received" value={formatMoney(totals.rentReceived)} emphasize />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Unit breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Lease start</th>
                <th className="px-4 py-2">Lease end</th>
                <th className="px-4 py-2 text-right">Monthly rent</th>
                <th className="px-4 py-2 text-right">Rent due</th>
                <th className="px-4 py-2 text-right">Rent received</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2 text-right">Deposit held</th>
                <th className="px-4 py-2">Arrears status</th>
                <th className="px-4 py-2">Payment method</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.propertyId}-${row.unit}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-semibold">{row.unit}</div>
                    <div className="text-xs text-slate-500">{row.propertyName}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.tenant || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.leaseStart)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.leaseEnd)}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{formatMoney(row.monthlyRent)}</td>
                  <td className="px-4 py-2 text-right text-slate-900">{formatMoney(row.rentDue)}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">{formatMoney(row.rentReceived)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${row.balance > 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {formatMoney(row.balance)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">{formatMoney(row.depositHeld)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={row.arrearsStatus} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.paymentMethod}</td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    No units match the selected filters.
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
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${emphasize ? "ring-1 ring-indigo-100" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasize ? "text-indigo-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isArrears = status.toLowerCase().includes("days") || status.toLowerCase().includes("pending");
  const isCredit = status.toLowerCase().includes("credit");
  const color = isCredit
    ? "bg-emerald-50 text-emerald-700"
    : isArrears
      ? "bg-rose-50 text-rose-700"
      : status === "Vacant"
        ? "bg-slate-100 text-slate-600"
        : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{status}</span>;
}
