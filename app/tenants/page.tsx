"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, FileText, ReceiptText, Search } from "lucide-react";
import {
  COMPANY_ADDRESS,
  COMPANY_EMAIL,
  COMPANY_LOGO_DATA_URI,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_TAGLINE,
} from "@/lib/constants/branding";

type TenantRecord = {
  id: string;
  name: string;
  building?: string;
  property_id?: string;
  unit?: string;
  monthly_rent?: string;
  due_day?: string;
  reference?: string;
};

type StatementRow = {
  date: string;
  entryType: string;
  description: string;
  charge?: number;
  payment?: number;
  balance: number;
  source?: string;
};

type StatementResponse = {
  tenant: {
    id: string;
    name: string;
    property: string;
    unit?: string;
    monthlyRent: number;
    dueDay: number;
  };
  period: { start: string; end: string };
  totals: { charges: number; payments: number; balance: number };
  rows: StatementRow[];
};

export default function TenantPortalPage() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => firstDayOfMonthString(-2));
  const [endDate, setEndDate] = useState(() => todayString());

  useEffect(() => {
    fetch(`/api/tenants?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setTenants(data || []);
        if (data?.length) {
          setSelectedTenant(data[0]);
        }
      })
      .catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    if (new Date(startDate) > new Date(endDate)) {
      setStatement(null);
      setStatementError("Start date must be before end date.");
      return;
    }
    const controller = new AbortController();
    setLoadingStatement(true);
    setStatementError(null);
    setStatement(null);
    const params = new URLSearchParams({ start: startDate, end: endDate });
    fetch(`/api/tenants/${selectedTenant.id}/statement?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load statement");
        return res.json();
      })
      .then((data: StatementResponse) => setStatement(data))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setStatementError("Unable to fetch tenant statement. Try another range.");
      })
      .finally(() => setLoadingStatement(false));

    return () => controller.abort();
  }, [selectedTenant, startDate, endDate]);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((tenant) => {
      return (
        tenant.name?.toLowerCase().includes(q) ||
        tenant.unit?.toLowerCase().includes(q) ||
        tenant.property_id?.toLowerCase().includes(q)
      );
    });
  }, [tenants, search]);

  const handleDownloadLease = () => {
    if (!selectedTenant) return;
    const content = buildLeaseHtml(selectedTenant, statement);
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(selectedTenant.name || "tenant")}-lease.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const statementCsvHref = selectedTenant
    ? `/api/tenants/${selectedTenant.id}/statement?${new URLSearchParams({
        start: startDate,
        end: endDate,
        format: "csv",
      }).toString()}`
    : null;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">Tenant Portal</p>
        <h1 className="text-3xl font-semibold text-slate-900">Leases & Statements</h1>
        <p className="text-sm text-slate-500">
          Central place for residents to download their lease packet and the latest rent statement.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-slate-500">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenant or unit"
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none"
            />
            <span className="text-xs text-slate-400">{filteredTenants.length}/{tenants.length}</span>
          </div>
          <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {filteredTenants.map((tenant) => {
              const active = tenant.id === selectedTenant?.id;
              return (
                <button
                  key={tenant.id}
                  onClick={() => setSelectedTenant(tenant)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50 ${
                    active ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="font-semibold text-slate-900">{tenant.name}</p>
                  <p className="text-xs text-slate-500">
                    {(tenant.building || tenant.property_id || "").toUpperCase()} · Unit {tenant.unit || "—"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(Number(tenant.monthly_rent || 0))} / mo
                  </p>
                </button>
              );
            })}
            {!filteredTenants.length && (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No tenants match that search.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-6">
          {selectedTenant ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Selected tenant</p>
                    <h2 className="text-2xl font-semibold text-slate-900">{selectedTenant.name}</h2>
                    <p className="text-sm text-slate-500">
                      {selectedTenant.building || selectedTenant.property_id} · Unit {selectedTenant.unit || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Monthly rent</p>
                    <p className="text-2xl font-semibold text-slate-900">
                      {formatCurrency(Number(selectedTenant.monthly_rent || 0))}
                    </p>
                    <p className="text-xs text-slate-500">Due day {selectedTenant.due_day || "1"}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Lease Agreement"
                    description="Download an automatically prepared copy of the resident lease packet."
                    icon={<FileText className="h-5 w-5" />}
                    actions={[
                      <button
                        key="lease"
                        onClick={handleDownloadLease}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
                      >
                        <Download className="h-4 w-4" />
                        Download lease
                      </button>,
                    ]}
                  />
                  <InfoCard
                    title="Tenant Statement"
                    description="Latest ledger activity, payments, and charges for transparency."
                    icon={<ReceiptText className="h-5 w-5" />}
                    actions={
                      statementCsvHref
                        ? [
                            <a
                              key="statement"
                              href={statementCsvHref}
                              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700"
                            >
                              <Download className="h-4 w-4" />
                              Export CSV
                            </a>,
                          ]
                        : undefined
                    }
                  >
                    {statement && (
                      <div className="mt-3 flex gap-6 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Charges</p>
                          <p className="text-base font-semibold text-slate-900">{formatCurrency(statement.totals.charges)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Payments</p>
                          <p className="text-base font-semibold text-slate-900">{formatCurrency(statement.totals.payments)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Balance</p>
                          <p className="text-base font-semibold text-rose-600">{formatCurrency(statement.totals.balance)}</p>
                        </div>
                      </div>
                    )}
                  </InfoCard>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Statement activity</p>
                    <p className="text-xs text-slate-500">Select a date window to regenerate the ledger.</p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
                      <span className="text-slate-500">Start</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border-none bg-transparent text-slate-700 outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
                      <span className="text-slate-500">End</span>
                      <input
                        type="date"
                        value={endDate}
                        max={todayString()}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="border-none bg-transparent text-slate-700 outline-none"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-6">
                  {loadingStatement && (
                    <p className="text-sm text-slate-500">Loading statement...</p>
                  )}
                  {statementError && <p className="text-sm text-rose-500">{statementError}</p>}
                  {!loadingStatement && statement && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-2">Date</th>
                            <th className="py-2">Type</th>
                            <th className="py-2">Description</th>
                            <th className="py-2 text-right">Charge</th>
                            <th className="py-2 text-right">Payment</th>
                            <th className="py-2 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statement.rows.map((row) => (
                            <tr key={`${row.date}-${row.description}-${row.balance}`} className="border-t border-slate-100">
                              <td className="py-2 text-slate-700">{row.date}</td>
                              <td className="py-2 text-slate-500">{row.entryType}</td>
                              <td className="py-2 text-slate-700">{row.description}</td>
                              <td className="py-2 text-right text-slate-700">{row.charge ? formatCurrency(row.charge) : "—"}</td>
                              <td className="py-2 text-right text-slate-700">{row.payment ? formatCurrency(row.payment) : "—"}</td>
                              <td className="py-2 text-right font-semibold text-slate-900">{formatCurrency(row.balance)}</td>
                            </tr>
                          ))}
                          {!statement.rows.length && (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                                No activity for this period.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!loadingStatement && !statement && !statementError && (
                    <p className="text-sm text-slate-500">Select a tenant to view statement details.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              Select a tenant from the list to load the portal view.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function firstDayOfMonthString(monthOffset: number) {
  const today = new Date();
  today.setMonth(today.getMonth() + monthOffset, 1);
  return today.toISOString().slice(0, 10);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function buildLeaseHtml(tenant: TenantRecord, statement?: StatementResponse | null) {
  const leaseNumber = tenant.reference || tenant.id;
  const today = todayString();
  const rent = formatCurrency(Number(tenant.monthly_rent || 0));
  const statementSummary = statement
    ? `<tr><td>Total Charges</td><td>${formatCurrency(statement.totals.charges)}</td></tr>
       <tr><td>Total Payments</td><td>${formatCurrency(statement.totals.payments)}</td></tr>
       <tr><td>Balance</td><td>${formatCurrency(statement.totals.balance)}</td></tr>`
    : `<tr><td>Monthly Rent</td><td>${rent}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <title>Lease Agreement · ${tenant.name}</title>
    <style>
      body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background: #f5f6fa; color: #162032; }
      .sheet { max-width: 900px; margin: 32px auto; background: #fff; padding: 48px; border-radius: 28px; box-shadow: 0 25px 60px rgba(15,22,38,0.12); }
      header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid #f3f4f7; padding-bottom: 24px; margin-bottom: 32px; }
      header img { width: 120px; height: auto; }
      header .brand h1 { margin: 0; font-size: 28px; letter-spacing: 0.08em; text-transform: uppercase; }
      header .brand p { margin: 4px 0 0; color: #64748b; font-size: 14px; }
      h2 { font-size: 20px; margin-top: 32px; border-bottom: 1px solid #edeff5; padding-bottom: 8px; color: #121a2d; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      td { padding: 10px 0; border-bottom: 1px solid #f1f3f9; font-size: 14px; }
      td:first-child { color: #6b7280; width: 35%; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; }
      section p { margin: 12px 0; line-height: 1.6; }
      .signature { margin-top: 48px; display: flex; justify-content: space-between; gap: 40px; }
      .signature div { flex: 1; }
      .signature span { display: block; margin-top: 60px; border-top: 1px solid #d5dae7; padding-top: 8px; font-size: 12px; letter-spacing: 0.1em; color: #94a3b8; text-transform: uppercase; }
      footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <header>
        <img src="${COMPANY_LOGO_DATA_URI}" alt="${COMPANY_NAME}" />
        <div class="brand">
          <h1>${COMPANY_NAME}</h1>
          <p>${COMPANY_TAGLINE}</p>
          <p>${COMPANY_ADDRESS} · ${COMPANY_PHONE}</p>
        </div>
      </header>

      <section>
        <p><strong>Lease Number:</strong> ${leaseNumber}</p>
        <p><strong>Issue Date:</strong> ${today}</p>
      </section>

      <h2>Resident Information</h2>
      <table>
        <tr><td>Tenant</td><td>${tenant.name}</td></tr>
        <tr><td>Unit</td><td>${tenant.unit || "N/A"}</td></tr>
        <tr><td>Property</td><td>${tenant.building || tenant.property_id || ""}</td></tr>
        <tr><td>Monthly Rent</td><td>${rent}</td></tr>
        <tr><td>Due Day</td><td>${tenant.due_day || "1"}</td></tr>
      </table>

      <h2>Financial Summary</h2>
      <table>
        ${statementSummary}
      </table>

      <h2>Key Terms</h2>
      <section>
        <p>1. <strong>Payments.</strong> Rent is due on day ${tenant.due_day || "1"} of each month. Payments received five (5) days after the due date may accrue late fees of 5% of the monthly rent.</p>
        <p>2. <strong>Utilities.</strong> Tenant is responsible for all utilities not expressly included within the building HOA. Meters must be kept in good standing.</p>
        <p>3. <strong>Maintenance.</strong> Routine maintenance is provided by ${COMPANY_NAME}. Any damage beyond normal wear will be billed to the resident ledger.</p>
        <p>4. <strong>Lease Term.</strong> This agreement renews monthly unless a thirty-day written notice is provided by either party.</p>
      </section>

      <div class="signature">
        <div>
          <p>Tenant Signature</p>
          <span>${tenant.name}</span>
        </div>
        <div>
          <p>Landlord / Agent</p>
          <span>${COMPANY_NAME}</span>
        </div>
      </div>

      <footer>
        ${COMPANY_NAME} · ${COMPANY_ADDRESS} · ${COMPANY_EMAIL} · ${COMPANY_PHONE}
      </footer>
    </div>
  </body>
</html>`;
}

function sanitizeFileName(input: string) {
  return input.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
}

function InfoCard({
  title,
  description,
  icon,
  actions,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  actions?: ReactNode[];
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        {actions && <div className="flex flex-col gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
