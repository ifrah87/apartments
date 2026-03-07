"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { FileDown, Eye, Search } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  unit?: string;
  building?: string;
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

type StatementData = {
  tenant: { id: string; name: string; unit?: string; monthlyRent: number };
  period: { start: string; end: string };
  totals: { charges: number; payments: number; balance: number };
  rows: StatementRow[];
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function fmt(value: number) {
  return currency.format(value || 0);
}

function fmtDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function defaultDates() {
  const end = new Date();
  return {
    start: "",
    end: end.toISOString().slice(0, 10),
  };
}

export default function StatementOfAccountPage() {
  const defaults = useMemo(() => defaultDates(), []);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/tenants", { cache: "no-store" })
      .then((r) => r.json())
      .then((p) => {
        const data: Tenant[] = p?.ok ? p.data : Array.isArray(p) ? p : [];
        setTenants(data);
        if (data.length && !selectedId) setSelectedId(data[0].id);
      })
      .catch(() => {});
  }, []);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.unit || "").toLowerCase().includes(q),
    );
  }, [tenants, search]);

  const selectedTenant = tenants.find((t) => t.id === selectedId);

  async function loadStatement() {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    setStatement(null);
    try {
      const params = new URLSearchParams();
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      const res = await fetch(`/api/tenants/${selectedId}/statement?${params.toString()}`, { cache: "no-store" });
      const p = await res.json();
      if (!p?.ok) {
        setError(p?.error || "Failed to load statement.");
        return;
      }
      setStatement(p.data);
    } catch {
      setError("Failed to load statement.");
    } finally {
      setLoading(false);
    }
  }

  function openPdf() {
    if (!selectedTenant) return;
    const url = `/api/invoices/statement?tenantName=${encodeURIComponent(selectedTenant.name)}&mode=pdf`;
    window.open(url, "_blank");
  }

  function downloadPdf() {
    if (!selectedTenant) return;
    const url = `/api/invoices/statement?tenantName=${encodeURIComponent(selectedTenant.name)}&mode=download`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${selectedTenant.name.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadCsv() {
    if (!selectedId) return;
    const params = new URLSearchParams({ format: "csv" });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const url = `/api/tenants/${selectedId}/statement?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${selectedTenant?.name.replace(/\s+/g, "_") || selectedId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statement of Account"
        subtitle="View a complete charge and payment ledger for any tenant."
        actions={
          selectedTenant ? (
            <div className="flex items-center gap-2">
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
              >
                <FileDown className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={openPdf}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
              >
                <Eye className="h-4 w-4" />
                View PDF
              </button>
              <button
                onClick={downloadPdf}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong"
              >
                <FileDown className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          ) : null
        }
      />

      {/* Filters */}
      <SectionCard className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Tenant search */}
          <div className="min-w-[220px] flex-1 space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Tenant
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-panel-2/60 px-3 py-2 text-sm">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenant or unit..."
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
            {search && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-panel shadow-xl">
                {filteredTenants.slice(0, 12).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedId(t.id);
                      setSearch("");
                    }}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                  >
                    <span className="font-medium">{t.name}</span>
                    {t.unit && <span className="text-xs text-slate-500">Unit {t.unit}</span>}
                  </button>
                ))}
                {!filteredTenants.length && (
                  <p className="px-4 py-3 text-sm text-slate-500">No tenants found.</p>
                )}
              </div>
            )}
            {!search && selectedTenant && (
              <p className="text-xs text-slate-400">
                Selected:{" "}
                <span className="font-semibold text-slate-200">{selectedTenant.name}</span>
                {selectedTenant.unit ? ` · Unit ${selectedTenant.unit}` : ""}
              </p>
            )}
          </div>

          {/* Date range */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              From
            </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-xl border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              To
            </label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-xl border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <button
            onClick={loadStatement}
            disabled={!selectedId || loading}
            className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.15)] hover:bg-accent-strong disabled:opacity-40"
          >
            {loading ? "Loading…" : "Load Statement"}
          </button>
        </div>
      </SectionCard>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Summary tiles */}
      {statement && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard className="border-l-2 border-l-rose-400/70 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Total Charged
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">
                {fmt(statement.totals.charges)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {statement.period.start} – {statement.period.end}
              </p>
            </SectionCard>
            <SectionCard className="border-l-2 border-l-emerald-400/70 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Total Paid
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">
                {fmt(statement.totals.payments)}
              </p>
            </SectionCard>
            <SectionCard
              className={`border-l-2 p-5 ${
                statement.totals.balance > 0
                  ? "border-l-red-400/70"
                  : "border-l-emerald-400/70"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Balance Outstanding
              </p>
              <p
                className={`mt-2 text-2xl font-semibold ${
                  statement.totals.balance > 0
                    ? "text-red-400"
                    : statement.totals.balance < 0
                      ? "text-emerald-300"
                      : "text-slate-100"
                }`}
              >
                {fmt(statement.totals.balance)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {statement.totals.balance > 0
                  ? "Amount owed"
                  : statement.totals.balance < 0
                    ? "Credit balance"
                    : "Settled"}
              </p>
            </SectionCard>
          </div>

          {/* Ledger table */}
          <SectionCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  {statement.tenant.name}
                  {statement.tenant.unit ? ` · Unit ${statement.tenant.unit}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {fmtDate(statement.period.start)} – {fmtDate(statement.period.end)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Charge</th>
                    <th className="px-4 py-3 text-right">Payment</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-white/[0.06] hover:bg-white/5"
                    >
                      <td className="px-4 py-2.5 text-slate-400">{fmtDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-slate-200">{row.description}</td>
                      <td className="px-4 py-2.5 text-right">
                        {row.charge ? (
                          <span className="font-medium text-slate-100">{fmt(row.charge)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {row.payment ? (
                          <span className="font-medium text-emerald-400">{fmt(row.payment)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`font-semibold ${
                            row.balance > 0
                              ? "text-red-400"
                              : row.balance < 0
                                ? "text-emerald-400"
                                : "text-slate-400"
                          }`}
                        >
                          {fmt(row.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-slate-500">
                        {row.source || (row.entryType === "charge" ? "invoice" : "bank")}
                      </td>
                    </tr>
                  ))}
                  {!statement.rows.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        No activity found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {!statement && !loading && !error && (
        <SectionCard className="p-10 text-center text-sm text-slate-500">
          Select a tenant and click <span className="font-semibold text-slate-300">Load Statement</span> to view their account history.
        </SectionCard>
      )}
    </div>
  );
}
