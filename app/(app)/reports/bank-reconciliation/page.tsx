"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

type BankAccount = {
  id: string; name: string; bank_name: string; account_number: string | null;
  currency: string; color: string; is_default: boolean;
};
type Txn = {
  id: string; date: string; payee: string; raw_particulars: string;
  amount: number; deposit: number; withdrawal: number; balance: number | null;
  reference: string | null; transaction_number: string | null;
  status: string; category: string | null;
  tenant_id: string | null; property_id: string | null; unit_id: string | null;
  account_code: string | null; alloc_notes: string | null;
  bank_account_id: string | null;
};
type CoaEntry = { code: string; name: string; category: string };
type Property = { id: string; name: string };
type Unit = { id: string; unit: string };
type CodingForm = {
  who: string; account_code: string; property_id: string;
  unit_id: string; notes: string; tax_rate: string;
};
type ActiveTab = "reconcile" | "statements" | "transactions" | "summary";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
function extractDesc(p: string) {
  return p?.match(/#EX:\d+#([^#]+)#/)?.[1]?.trim() ?? p ?? "";
}
const TAX_RATES = ["No Tax", "5% VAT", "10% VAT", "15% VAT", "20% VAT", "Exempt"];
const EMPTY_FORM: CodingForm = { who: "", account_code: "4010", property_id: "", unit_id: "", notes: "", tax_rate: "No Tax" };

export default function BankReconciliationPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [txnError, setTxnError] = useState<string | null>(null);
  const [coa, setCoa] = useState<CoaEntry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("reconcile");
  const [subTab, setSubTab] = useState<"tocode" | "coded">("tocode");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [codingForm, setCodingForm] = useState<CodingForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch("/api/bank-accounts").then(r => r.json()).then(p => {
      if (p.ok) {
        setBankAccounts(p.data ?? []);
        const def = (p.data ?? []).find((a: BankAccount) => a.is_default);
        setSelectedAccountId(def?.id ?? p.data?.[0]?.id ?? "");
      }
    }).catch(() => {});
    fetch("/api/chart-of-accounts").then(r => r.json()).then(p => { if (p.ok) setCoa(p.data ?? []); }).catch(() => {});
    fetch("/api/properties").then(r => r.json()).then(p => {
      const arr = p.ok ? p.data : Array.isArray(p) ? p : [];
      setProperties(arr);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!codingForm.property_id) { setUnits([]); return; }
    fetch(`/api/units?property_id=${codingForm.property_id}`).then(r => r.json()).then(p => {
      setUnits(p.ok ? p.data : Array.isArray(p) ? p : []);
    }).catch(() => {});
  }, [codingForm.property_id]);

  const loadTxns = useCallback(() => {
    setLoadingTxns(true); setTxnError(null);
    const params = new URLSearchParams({ status: "all" });
    if (selectedAccountId) params.set("bank_account_id", selectedAccountId);
    fetch(`/api/transactions?${params}`).then(r => r.json()).then(p => {
      if (p.ok) setTxns((p.data ?? []).map((t: Txn) => ({
        ...t,
        amount: Number(t.amount),
        deposit: Number(t.deposit),
        withdrawal: Number(t.withdrawal),
        balance: t.balance != null ? Number(t.balance) : null,
      })));
      else setTxnError(p.error ?? "Failed to load");
    }).catch(() => setTxnError("Network error")).finally(() => setLoadingTxns(false));
  }, [selectedAccountId]);

  useEffect(() => { loadTxns(); }, [loadTxns]);

  function openRow(txn: Txn) {
    if (expandedId === txn.id) { setExpandedId(null); return; }
    setExpandedId(txn.id);
    setCodingForm({
      who: txn.tenant_id ?? txn.payee ?? "",
      account_code: txn.account_code ?? "4010",
      property_id: txn.property_id ?? "",
      unit_id: txn.unit_id ?? "",
      notes: txn.alloc_notes ?? extractDesc(txn.raw_particulars),
      tax_rate: "No Tax",
    });
  }

  async function saveCoding(txn: Txn) {
    setSaving(true);
    try {
      const res = await fetch("/api/transactions/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: txn.id,
          tenant_id: codingForm.who.trim() || null,
          property_id: codingForm.property_id || null,
          unit_id: codingForm.unit_id || null,
          account_code: codingForm.account_code || null,
          notes: codingForm.notes.trim() || null,
          status: "REVIEWED",
        }),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error ?? "Failed");
      setTxns(prev => prev.map(t => t.id !== txn.id ? t : {
        ...t, status: "REVIEWED",
        tenant_id: codingForm.who || null, property_id: codingForm.property_id || null,
        unit_id: codingForm.unit_id || null, account_code: codingForm.account_code || null,
        alloc_notes: codingForm.notes || null,
      }));
      const idx = txns.findIndex(t => t.id === txn.id);
      const next = txns.slice(idx + 1).find(t => t.status === "UNREVIEWED");
      if (next) {
        setExpandedId(next.id);
        setCodingForm({ who: next.tenant_id ?? next.payee ?? "", account_code: next.account_code ?? "4010", property_id: next.property_id ?? "", unit_id: next.unit_id ?? "", notes: next.alloc_notes ?? extractDesc(next.raw_particulars), tax_rate: "No Tax" });
      } else { setExpandedId(null); }
      setToast("Coded successfully");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setTxnError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  }

  async function removeCoding(txn: Txn) {
    setSaving(true);
    try {
      const res = await fetch("/api/transactions/allocate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: txn.id, tenant_id: null, property_id: null, unit_id: null, account_code: null, notes: null, status: "UNREVIEWED" }),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error);
      setTxns(prev => prev.map(t => t.id !== txn.id ? t : { ...t, status: "UNREVIEWED", tenant_id: null, property_id: null, unit_id: null, account_code: null, alloc_notes: null }));
      setExpandedId(null);
    } catch (err) { setTxnError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  const unreviewed = txns.filter(t => t.status === "UNREVIEWED");
  const reviewed   = txns.filter(t => t.status !== "UNREVIEWED");
  const totalIn    = txns.reduce((s, t) => s + (t.deposit > 0 ? t.deposit : 0), 0);
  const totalOut   = txns.reduce((s, t) => s + (t.withdrawal > 0 ? t.withdrawal : 0), 0);
  // txns are newest-first; oldest = last item; opening balance = that row's balance minus its own movement
  const oldestTxn    = txns.length > 0 ? txns[txns.length - 1] : null;
  const openingBal   = oldestTxn?.balance != null ? oldestTxn.balance - oldestTxn.deposit + oldestTxn.withdrawal : null;
  const closingBal   = txns[0]?.balance ?? null;
  const visibleTxns  = subTab === "tocode" ? unreviewed : reviewed;
  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);
  const propName = (id: string) => properties.find(p => p.id === id)?.name ?? id;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              <Link href="/reports" className="hover:text-slate-300">Reports</Link> / Bank Reconciliation
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-100">Bank Reconciliation</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {selectedAccount && (
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedAccount.color }} />
              )}
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:outline-none min-w-[200px]"
              >
                <option value="">All accounts</option>
                {bankAccounts.length === 0 && <option disabled>No accounts — add in Settings</option>}
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name} — {a.bank_name}</option>)}
              </select>
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                try {
                  const res = await fetch("/api/admin/spaces-sync", { method: "POST" });
                  const p = await res.json();
                  if (p.ok) {
                    const inserted = p.data?.results?.reduce((s: number, r: { inserted: number }) => s + (r.inserted ?? 0), 0) ?? 0;
                    setToast(inserted > 0 ? `Imported ${inserted} new transaction(s)` : "No new transactions");
                    loadTxns();
                  } else {
                    setTxnError(p.error ?? "Sync failed");
                  }
                } catch {
                  setTxnError("Sync failed — check connection");
                } finally {
                  setSyncing(false);
                }
              }}
              className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "↓ Import from Spaces"}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
          {openingBal != null && <Stat label="Opening balance" value={fmt.format(openingBal)} />}
          <Stat label="Total in" value={fmt.format(totalIn)} color="text-emerald-400" />
          <Stat label="Total out" value={fmt.format(totalOut)} color="text-rose-400" />
          {closingBal != null && <Stat label="Closing balance" value={fmt.format(closingBal)} color="text-slate-100" />}
          <Stat label="Statement lines" value={String(txns.length)} />
          <Stat label="To code" value={String(unreviewed.length)} color={unreviewed.length > 0 ? "text-amber-400" : "text-slate-400"} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-white/10 px-6">
        {(["reconcile", "statements", "transactions", "summary"] as ActiveTab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`-mb-px border-b-2 px-4 py-3 text-xs font-semibold capitalize transition ${activeTab === tab ? "border-accent text-accent" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            {tab === "reconcile" ? <>Reconcile {unreviewed.length > 0 && <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">{unreviewed.length}</span>}</> : tab === "statements" ? "Bank Statements" : tab === "transactions" ? "Account Transactions" : "Summary"}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {toast && (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
          {toast}<button onClick={() => setToast(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {txnError && (
        <div className="mx-6 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-400">{txnError}</div>
      )}

      {/* ── Reconcile Tab ── */}
      {activeTab === "reconcile" && (
        <div className="px-6 py-4">
          <div className="mb-4 flex items-center gap-2">
            <button type="button" onClick={() => setSubTab("tocode")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${subTab === "tocode" ? "bg-amber-500/20 text-amber-300" : "border border-white/10 text-slate-400 hover:text-slate-200"}`}>
              To code ({unreviewed.length})
            </button>
            <button type="button" onClick={() => setSubTab("coded")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${subTab === "coded" ? "bg-emerald-500/20 text-emerald-300" : "border border-white/10 text-slate-400 hover:text-slate-200"}`}>
              Coded ({reviewed.length})
            </button>
          </div>
          {loadingTxns && <p className="py-8 text-center text-sm text-slate-500">Loading transactions…</p>}
          {!loadingTxns && !visibleTxns.length && (
            <SectionCard className="p-8 text-center text-sm text-slate-500">
              {subTab === "tocode" ? "All transactions are coded. Great work!" : "No coded transactions yet."}
            </SectionCard>
          )}
          <div className="space-y-2">
            {visibleTxns.map(txn => {
              const isExpanded = expandedId === txn.id;
              const desc = extractDesc(txn.raw_particulars);
              const isCoded = txn.status !== "UNREVIEWED";
              return (
                <SectionCard key={txn.id} className="overflow-hidden p-0">
                  <button type="button" onClick={() => openRow(txn)} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-white/5">
                    <div className="w-28 flex-shrink-0 text-sm text-slate-400">{fmtDate(txn.date)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-slate-100">{txn.payee || "—"}</p>
                      <p className="truncate text-sm text-slate-500">{desc}</p>
                    </div>
                    <div className={`flex-shrink-0 text-base font-semibold tabular-nums ${txn.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {txn.amount >= 0 ? "+" : ""}{fmt.format(txn.amount)}
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                      {isCoded ? (
                        <>
                          {txn.account_code && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">{txn.account_code}</span>}
                          {txn.property_id && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300">{propName(txn.property_id)}</span>}
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">Coded</span>
                        </>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">To code</span>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-slate-500">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="grid border-t border-white/10 lg:grid-cols-[2fr_3fr]">
                      {/* Left: statement details */}
                      <div className="border-r border-white/10 p-5 text-base">
                        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Statement Line</p>
                        <div className="space-y-2 text-slate-300">
                          <Row label="Date" value={fmtDate(txn.date)} />
                          <Row label="Payee" value={txn.payee || "—"} bold />
                          <Row label="Description" value={desc} />
                          {txn.reference && <Row label="REF" value={txn.reference} mono />}
                          {txn.transaction_number && <Row label="TXN" value={txn.transaction_number} mono />}
                        </div>
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="flex justify-between text-base">
                            <div>
                              <p className="text-sm text-slate-500">Received</p>
                              <p className="font-semibold text-emerald-400">{txn.deposit > 0 ? fmt.format(txn.deposit) : "—"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-500">Spent</p>
                              <p className="font-semibold text-rose-400">{txn.withdrawal > 0 ? fmt.format(txn.withdrawal) : "—"}</p>
                            </div>
                          </div>
                          {txn.balance != null && (
                            <div className="mt-2 border-t border-white/10 pt-2 text-right">
                              <p className="text-sm text-slate-500">Running balance</p>
                              <p className="font-semibold text-slate-200">{fmt.format(txn.balance)}</p>
                            </div>
                          )}
                        </div>
                        {txn.raw_particulars && (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">Raw particulars</summary>
                            <p className="mt-2 break-all font-mono text-xs text-slate-600">{txn.raw_particulars}</p>
                          </details>
                        )}
                      </div>

                      {/* Right: coding form */}
                      <div className="p-5 text-base">
                        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Code This Transaction</p>
                        <div className="space-y-3">
                          <FormField label="Who">
                            <input type="text" value={codingForm.who}
                              onChange={e => setCodingForm(f => ({ ...f, who: e.target.value }))}
                              placeholder="Tenant name or payer"
                              className="w-full rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none" />
                          </FormField>
                          <FormField label="What (account)">
                            <select value={codingForm.account_code}
                              onChange={e => setCodingForm(f => ({ ...f, account_code: e.target.value }))}
                              className="w-full rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none">
                              {coa.length === 0 && <option>Loading…</option>}
                              {["INCOME", "LIABILITY", "ASSET", "EQUITY", "EXPENSE"].map(cat => {
                                const entries = coa.filter(c => c.category === cat);
                                if (!entries.length) return null;
                                return (
                                  <optgroup key={cat} label={cat}>
                                    {entries.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                                  </optgroup>
                                );
                              })}
                            </select>
                          </FormField>
                          <FormField label="Property">
                            <select value={codingForm.property_id}
                              onChange={e => setCodingForm(f => ({ ...f, property_id: e.target.value, unit_id: "" }))}
                              className="w-full rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none">
                              <option value="">— No property —</option>
                              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </FormField>
                          {codingForm.property_id && (
                            <FormField label="Unit">
                              <select value={codingForm.unit_id}
                                onChange={e => setCodingForm(f => ({ ...f, unit_id: e.target.value }))}
                                className="w-full rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none">
                                <option value="">— No unit —</option>
                                {units.map(u => <option key={u.id} value={u.id}>Unit {u.unit}</option>)}
                              </select>
                            </FormField>
                          )}
                          <FormField label="Why (description)">
                            <input type="text" value={codingForm.notes}
                              onChange={e => setCodingForm(f => ({ ...f, notes: e.target.value }))}
                              placeholder="e.g. March rent — Unit 12"
                              className="w-full rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none" />
                          </FormField>
                          <FormField label="Tax rate">
                            <select value={codingForm.tax_rate}
                              onChange={e => setCodingForm(f => ({ ...f, tax_rate: e.target.value }))}
                              className="rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none">
                              {TAX_RATES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </FormField>
                        </div>
                        {codingForm.account_code && (
                          <p className="mt-3 text-sm text-slate-500">
                            {[coa.find(c => c.code === codingForm.account_code)?.name, codingForm.property_id ? propName(codingForm.property_id) : null].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <div className="mt-4 flex items-center gap-3">
                          <button type="button" onClick={() => saveCoding(txn)} disabled={saving}
                            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                            {saving ? "Saving…" : "OK"}
                          </button>
                          {isCoded && (
                            <button type="button" onClick={() => removeCoding(txn)} disabled={saving}
                              className="text-sm text-slate-500 hover:text-rose-300">Remove coding</button>
                          )}
                          <button type="button" onClick={() => setExpandedId(null)} className="text-sm text-slate-500 hover:text-slate-300">▲ Close</button>
                        </div>
                      </div>
                    </div>
                  )}
                </SectionCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bank Statements Tab ── */}
      {activeTab === "statements" && (
        <div className="p-6">
          <SectionCard className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th><th className="px-4 py-3">Payee</th>
                  <th className="px-4 py-3">Particulars</th><th className="px-4 py-3">REF</th>
                  <th className="px-4 py-3 text-right">Received</th><th className="px-4 py-3 text-right">Spent</th>
                </tr>
              </thead>
              <tbody>
                {loadingTxns && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>}
                {!loadingTxns && txns.map(txn => (
                  <tr key={txn.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-slate-500">{fmtDate(txn.date)}</td>
                    <td className="px-4 py-3 text-slate-100">{txn.payee || "—"}</td>
                    <td className="max-w-xs px-4 py-3"><span className="line-clamp-1 text-xs text-slate-400">{extractDesc(txn.raw_particulars)}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{txn.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">{txn.deposit > 0 ? fmt.format(txn.deposit) : ""}</td>
                    <td className="px-4 py-3 text-right text-rose-400 tabular-nums">{txn.withdrawal > 0 ? fmt.format(txn.withdrawal) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}

      {/* ── Account Transactions Tab ── */}
      {activeTab === "transactions" && (
        <div className="p-6">
          <SectionCard className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th><th className="px-4 py-3">Payee</th>
                  <th className="px-4 py-3">Account</th><th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Notes</th><th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingTxns && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>}
                {!loadingTxns && txns.map(txn => (
                  <tr key={txn.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-slate-500">{fmtDate(txn.date)}</td>
                    <td className="px-4 py-3 text-slate-100">{txn.payee || "—"}</td>
                    <td className="px-4 py-3">
                      {txn.account_code ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">{txn.account_code}</span> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{txn.property_id ? propName(txn.property_id) : "—"}</td>
                    <td className="max-w-[180px] px-4 py-3"><span className="line-clamp-1 text-xs text-slate-400">{txn.alloc_notes || "—"}</span></td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${txn.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {txn.amount >= 0 ? "+" : ""}{fmt.format(txn.amount)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={txn.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}

      {/* ── Summary Tab ── */}
      {activeTab === "summary" && (
        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total In" value={fmt.format(totalIn)} color="text-emerald-400" />
            <KpiCard label="Total Out" value={fmt.format(totalOut)} color="text-rose-400" />
            <KpiCard label="Coded" value={String(reviewed.length)} color="text-emerald-400" />
            <KpiCard label="To Code" value={String(unreviewed.length)} color={unreviewed.length > 0 ? "text-amber-400" : "text-slate-400"} />
          </div>
          <SectionCard className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">By Account Code</p>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-600">
                <tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Transactions</th><th className="px-4 py-3 text-right">Total</th></tr>
              </thead>
              <tbody>
                {Array.from(
                  txns.filter(t => t.account_code).reduce((map, t) => {
                    const code = t.account_code!;
                    const ex = map.get(code) ?? { count: 0, total: 0 };
                    map.set(code, { count: ex.count + 1, total: ex.total + t.amount });
                    return map;
                  }, new Map<string, { count: number; total: number }>())
                ).map(([code, data]) => {
                  const entry = coa.find(c => c.code === code);
                  return (
                    <tr key={code} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-slate-100">{entry?.name ?? code}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{entry?.category ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{data.count}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${data.total >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {data.total >= 0 ? "+" : ""}{fmt.format(data.total)}
                      </td>
                    </tr>
                  );
                })}
                {txns.filter(t => t.account_code).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-600">No coded transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "text-slate-100" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`ml-2 font-semibold ${color}`}>{value}</span>
    </div>
  );
}
function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`max-w-[60%] text-right ${bold ? "font-medium text-slate-100" : ""} ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-400">{label}</span>
      {children}
    </label>
  );
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <SectionCard className="p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
    </SectionCard>
  );
}
function StatusBadge({ status }: { status: string }) {
  if (status === "REVIEWED") return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">Coded</span>;
  if (status === "RECONCILED") return <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">Reconciled</span>;
  return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">To code</span>;
}
