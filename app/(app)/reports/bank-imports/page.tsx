"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";

type CoaEntry = { code: string; name: string; category: string; sub_type: string };

type Txn = {
  id: string;
  date: string;
  payee: string;
  raw_particulars: string;
  amount: number;
  deposit: number;
  withdrawal: number;
  balance: number | null;
  reference: string | null;
  transaction_number: string | null;
  source_bank: string | null;
  account_id: string | null;
  category: string;
  status: string;
  tenant_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  account_code: string | null;
  alloc_notes: string | null;
};

type AllocForm = {
  tenant_id: string;
  account_code: string;
  notes: string;
};

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function BankImportsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [coa, setCoa] = useState<CoaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"UNREVIEWED" | "REVIEWED" | "all">("UNREVIEWED");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<AllocForm>({ tenant_id: "", account_code: "4010", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fetchTxns(status: string) {
    setLoading(true);
    setError(null);
    fetch(`/api/transactions?status=${status}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.ok) setTxns(payload.data ?? []);
        else setError(payload?.error ?? "Failed to load transactions");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/chart-of-accounts")
      .then((r) => r.json())
      .then((p) => { if (p?.ok) setCoa(p.data ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchTxns(statusFilter); }, [statusFilter]);

  function openRow(txn: Txn) {
    setExpandedId(expandedId === txn.id ? null : txn.id);
    setForm({
      tenant_id: txn.tenant_id ?? txn.payee ?? "",
      account_code: txn.account_code ?? "rent",
      notes: txn.alloc_notes ?? "",
    });
  }

  async function allocate(txn: Txn) {
    setSaving(true);
    try {
      const res = await fetch("/api/transactions/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: txn.id,
          tenant_id: form.tenant_id.trim() || null,
          account_code: form.account_code || null,
          notes: form.notes.trim() || null,
          status: "REVIEWED",
        }),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error ?? "Failed to allocate");
      // Optimistically update the row in state
      setTxns((prev) =>
        prev.map((t) =>
          t.id === txn.id
            ? { ...t, status: "REVIEWED", tenant_id: form.tenant_id || null, account_code: form.account_code || null, alloc_notes: form.notes || null }
            : t
        )
      );
      setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate");
    } finally {
      setSaving(false);
    }
  }

  const unreviewed = txns.filter((t) => t.status === "UNREVIEWED").length;
  const reviewed   = txns.filter((t) => t.status === "REVIEWED").length;
  const total      = txns.length;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">Reports</Link> / Bank Imports
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Bank Imports</h1>
        <p className="text-sm text-slate-500">
          Review and reconcile imported bank transactions. Import CSV with:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700">
            npx tsx scripts/import-bank.ts ./march-2026.csv
          </code>
        </p>
      </header>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total imported" value={total} />
        <SummaryCard label="Unreconciled" value={unreviewed} danger={unreviewed > 0} />
        <SummaryCard label="Reconcile" value={reviewed} />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(["UNREVIEWED", "REVIEWED", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === s
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "all" ? "All" : s === "UNREVIEWED" ? "Unreconciled" : "Reconcile"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <SectionCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Payee</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && !txns.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  No transactions found. Run the import script to populate.
                </td>
              </tr>
            )}
            {txns.map((txn) => (
              <>
                <tr
                  key={txn.id}
                  className={`border-t border-slate-100 ${expandedId === txn.id ? "bg-indigo-50/40" : "hover:bg-slate-50"}`}
                >
                  <td className="px-4 py-3 text-slate-600">{fmtDate(txn.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{txn.payee || "—"}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-500">
                    <span className="line-clamp-1">{extractDesc(txn.raw_particulars)}</span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${txn.amount >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {txn.amount >= 0 ? "+" : ""}{fmt.format(txn.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{txn.account_code ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={txn.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openRow(txn)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {expandedId === txn.id ? "Close" : txn.status === "REVIEWED" ? "Edit" : "Reconcile"}
                    </button>
                  </td>
                </tr>

                {/* Inline allocation form */}
                {expandedId === txn.id && (
                  <tr key={`${txn.id}-form`} className="border-t-0">
                    <td colSpan={7} className="border-b border-slate-100 bg-indigo-50/60 px-4 pb-4 pt-2">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-500">Tenant / Payer</label>
                          <input
                            type="text"
                            value={form.tenant_id}
                            onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}
                            placeholder={txn.payee || "Tenant name or ID"}
                            className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-500">Account code</label>
                          <select
                            value={form.account_code}
                            onChange={(e) => setForm((f) => ({ ...f, account_code: e.target.value }))}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                          >
                            {coa.length === 0 && <option value="">Loading…</option>}
                            {["INCOME", "ASSET", "LIABILITY", "EQUITY", "EXPENSE"].map((cat) => {
                              const entries = coa.filter((c) => c.category === cat);
                              if (!entries.length) return null;
                              return (
                                <optgroup key={cat} label={cat}>
                                  {entries.map((c) => (
                                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-semibold text-slate-500">Notes (optional)</label>
                          <input
                            type="text"
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="e.g. March rent — Unit 12"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => allocate(txn)}
                          disabled={saving}
                          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {saving ? "Saving…" : "Mark reviewed"}
                        </button>
                        <div className="text-xs text-slate-400">
                          <div>Ref: {txn.reference ?? "—"}</div>
                          <div>TXN: {txn.transaction_number ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

function extractDesc(particulars: string): string {
  return particulars.match(/#EX:\d+#([^#]+)#/)?.[1]?.trim() ?? particulars;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "REVIEWED")
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Reconcile</span>;
  if (status === "RECONCILED")
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Reconcile</span>;
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Unreconciled</span>;
}

function SummaryCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <SectionCard className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${danger ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
    </SectionCard>
  );
}
