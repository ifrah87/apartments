"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import type { TxnDTO } from "@/src/types/transactions";

type BankAccount = {
  id: string; name: string; bank_name: string; account_number: string | null;
  currency: string; color: string; is_default: boolean;
};
type CoaEntry = { code: string; name: string; category: string };
type Property = { id: string; name: string };
type Unit = { id: string; unit: string };
type InvoiceOption = { id: string; period: string; total: number; outstanding: number; status: string; invoiceNumber: string };
type CodingForm = {
  who: string; account_code: string; property_id: string;
  unit_id: string; notes: string; invoice_id: string;
};
type SplitLine = {
  key: string; amount: string; account_code: string; unit_id: string; notes: string; invoice_id: string;
};
type SuggestedMatch = {
  invoiceId: string;
  invoiceNumber: string | null;
  period: string | null;
  tenantId: string | null;
  unitId: string | null;
  tenantName: string | null;
  status: string | null;
  total: number;
  amountPaid: number;
  outstanding: number;
  score: number;
  reasonSummary: string;
};
type ReconciliationHistory = {
  allocations: Array<{
    id: string;
    invoice_id: string;
    allocated_amount: number;
    created_by: string | null;
    created_at: string;
    invoice_number: string | null;
  }>;
  events: Array<{
    id: string;
    action: string;
    details: Record<string, unknown> | null;
    created_by: string | null;
    created_at: string;
  }>;
};
type TxnWithBalance = TxnDTO & { displayBalance: number };
type ActiveTab = "reconcile" | "statements" | "transactions" | "summary";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
function extractDesc(p: string) {
  return p?.match(/#EX:\d+#([^#]+)#/)?.[1]?.trim() ?? p ?? "";
}
const EMPTY_FORM: CodingForm = { who: "", account_code: "4010", property_id: "", unit_id: "", notes: "", invoice_id: "" };
let splitKeyCounter = 0;
const newKey = () => String(++splitKeyCounter);
const normalizeInvoiceStatus = (value: unknown) => String(value ?? "").trim().toLowerCase();

export default function BankReconciliationPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [txns, setTxns] = useState<TxnDTO[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [txnError, setTxnError] = useState<string | null>(null);
  const [coa, setCoa] = useState<CoaEntry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("reconcile");
  const [subTab, setSubTab] = useState<"tocode" | "coded">("tocode");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [codingForm, setCodingForm] = useState<CodingForm>(EMPTY_FORM);
  const [splitMode, setSplitMode] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [splitInvoiceOptions, setSplitInvoiceOptions] = useState<Record<string, InvoiceOption[]>>({});
  const [suggestionsByTxn, setSuggestionsByTxn] = useState<Record<string, SuggestedMatch[]>>({});
  const [loadingSuggestionTxnId, setLoadingSuggestionTxnId] = useState<string | null>(null);
  const [historyByTxn, setHistoryByTxn] = useState<Record<string, ReconciliationHistory>>({});
  const [loadingHistoryTxnId, setLoadingHistoryTxnId] = useState<string | null>(null);

  async function fetchInvoiceOptionsForReconciliation(unitId?: string, tenantName?: string): Promise<InvoiceOption[]> {
    const normalizedTenant = String(tenantName || "").trim().toLowerCase();
    const byUnitUrl = unitId ? `/api/invoices?unit_id=${encodeURIComponent(unitId)}` : "";
    const byTenantUrl = !unitId && normalizedTenant ? `/api/invoices?tenant_name=${encodeURIComponent(tenantName || "")}` : "";
    const primaryUrl = byUnitUrl || byTenantUrl;
    if (!primaryUrl) return [];
    const primary = await fetch(primaryUrl).then(r => r.json()).catch(() => ({ ok: false }));
    const rows = (primary.ok ? primary.data : []) as any[];
    return rows.map((r: any) => {
      const total = Number(r.total || 0);
      const amountPaid = Number(r.amount_paid || 0);
      return {
        id: r.id,
        period: r.period || "—",
        total,
        outstanding: Math.max(0, total - amountPaid),
        status: normalizeInvoiceStatus(r.status),
        invoiceNumber: r.invoiceNumber || r.invoice_number || r.id,
      };
    });
  }

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
      const arr: Unit[] = p.ok ? p.data : Array.isArray(p) ? p : [];
      arr.sort((a, b) => {
        const na = parseInt(a.unit, 10), nb = parseInt(b.unit, 10);
        return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.unit.localeCompare(b.unit);
      });
      setUnits(arr);
    }).catch(() => {});
  }, [codingForm.property_id]);

  useEffect(() => {
    const unitId = codingForm.unit_id;
    const tenantName = codingForm.who.trim();
    if (!unitId && !tenantName) { setInvoiceOptions([]); return; }
    setLoadingInvoices(true);
    fetchInvoiceOptionsForReconciliation(unitId, tenantName)
      .then((rows) => setInvoiceOptions(rows))
      .catch(() => setInvoiceOptions([]))
      .finally(() => setLoadingInvoices(false));
    setCodingForm(f => ({ ...f, invoice_id: "" }));
  }, [codingForm.unit_id, codingForm.who]);

  const loadTxns = useCallback(() => {
    setLoadingTxns(true); setTxnError(null);
    const params = new URLSearchParams({ status: "all" });
    params.set("limit", "500");
    if (selectedAccountId) params.set("bank_account_id", selectedAccountId);
    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then((p) => {
        if (!p?.ok) throw new Error(p?.error ?? "Failed to load transactions");
        const rows: TxnDTO[] = Array.isArray(p.data) ? p.data : [];
        setTxns(rows.map((t) => ({
          ...t,
          amount: Number(t.amount),
          deposit: Number(t.deposit),
          withdrawal: Number(t.withdrawal),
          balance: t.balance != null ? Number(t.balance) : null,
        })));
      })
      .catch((err) => setTxnError(err instanceof Error ? err.message : "Network error"))
      .finally(() => setLoadingTxns(false));
  }, [selectedAccountId]);

  useEffect(() => { loadTxns(); }, [loadTxns]);

  async function openRow(txn: TxnDTO) {
    if (expandedId === txn.id) { setExpandedId(null); setSplitMode(false); return; }
    setExpandedId(txn.id);
    setCodingForm({
      who: txn.tenant_id ?? txn.payee ?? "",
      account_code: txn.account_code ?? "4010",
      property_id: txn.property_id ?? "",
      unit_id: txn.unit_id ?? "",
      notes: txn.alloc_notes ?? extractDesc(txn.raw_particulars),
      invoice_id: "",
    });
    // Load existing splits if this transaction was previously split
    if (txn.alloc_notes?.startsWith("Split:")) {
      try {
        const res = await fetch(`/api/transactions/splits?transaction_id=${txn.id}`);
        const p = await res.json();
        if (p.ok && p.data.length > 0) {
          const lines = p.data.map((s: { id: string; amount: string; account_code: string; unit_id: string | null; notes: string }) => ({
            key: newKey(),
            amount: String(Number(s.amount)),
            account_code: s.account_code ?? "4010",
            unit_id: s.unit_id ?? "",
            notes: s.notes ?? "",
            invoice_id: "",
          }));
          setSplitLines(lines);
          setSplitInvoiceOptions({});
          setSplitMode(true);
          return;
        }
      } catch { /* ignore */ }
    }
    // Always start in split mode with one line pre-filled from existing coding
    const firstKey = newKey();
    const unitId = txn.unit_id ?? "";
    setSplitLines([{
      key: firstKey,
      amount: String(txn.amount),
      account_code: txn.account_code ?? "4010",
      unit_id: unitId,
      notes: txn.alloc_notes?.startsWith("Split:") ? "" : (txn.alloc_notes ?? extractDesc(txn.raw_particulars)),
      invoice_id: "",
    }]);
    setSplitInvoiceOptions({});
    setSplitMode(true);
    loadSuggestions(txn.id);
    loadHistory(txn.id);
    // Auto-load and auto-select outstanding invoice for this unit
    if (unitId) {
      loadSplitInvoices(firstKey, unitId, true);
    }
  }

  async function loadHistory(transactionId: string) {
    setLoadingHistoryTxnId(transactionId);
    try {
      const res = await fetch(`/api/transactions/history?transaction_id=${encodeURIComponent(transactionId)}`);
      const payload = await res.json();
      setHistoryByTxn((prev) => ({ ...prev, [transactionId]: payload.ok ? payload.data : { allocations: [], events: [] } }));
    } catch {
      setHistoryByTxn((prev) => ({ ...prev, [transactionId]: { allocations: [], events: [] } }));
    } finally {
      setLoadingHistoryTxnId((current) => (current === transactionId ? null : current));
    }
  }

  async function loadSuggestions(transactionId: string) {
    setLoadingSuggestionTxnId(transactionId);
    try {
      const res = await fetch(`/api/transactions/suggestions?transaction_id=${encodeURIComponent(transactionId)}`);
      const payload = await res.json();
      setSuggestionsByTxn((prev) => ({ ...prev, [transactionId]: payload.ok ? (payload.data ?? []) : [] }));
    } catch {
      setSuggestionsByTxn((prev) => ({ ...prev, [transactionId]: [] }));
    } finally {
      setLoadingSuggestionTxnId((current) => (current === transactionId ? null : current));
    }
  }

  async function loadSplitInvoices(lineKey: string, unitId: string, autoSelect = false) {
    if (!unitId) { setSplitInvoiceOptions(prev => ({ ...prev, [lineKey]: [] })); return; }
    const rows = await fetchInvoiceOptionsForReconciliation(unitId);
    setSplitInvoiceOptions(prev => ({ ...prev, [lineKey]: rows }));
    // Auto-select the first unpaid/partially_paid invoice when opening
    if (autoSelect) {
      const first = rows.find(r => {
        const status = normalizeInvoiceStatus(r.status);
        return status === "unpaid" || status === "partially_paid" || status === "partially paid";
      });
      if (first) {
        setSplitLines(ls => ls.map(l => l.key === lineKey ? { ...l, invoice_id: first.id } : l));
      }
    }
  }

  async function saveCoding(txn: TxnDTO) {
    setSaving(true);
    try {
      let body: Record<string, unknown>;

      if (splitMode) {
        const totalSplit = splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
        if (Math.abs(totalSplit - txn.amount) > 0.01) {
          setTxnError(`Split lines total ${fmt.format(totalSplit)} must equal ${fmt.format(txn.amount)}`);
          setSaving(false);
          return;
        }
        body = {
          id: txn.id,
          splits: splitLines.map(l => ({
            amount: parseFloat(l.amount) || 0,
            account_code: l.account_code || null,
            tenant_id: codingForm.who.trim() || null,
            property_id: codingForm.property_id || null,
            unit_id: l.unit_id || null,
            notes: l.notes.trim() || null,
            invoice_id: l.invoice_id || null,
          })),
        };
      } else {
        body = {
          id: txn.id,
          tenant_id: codingForm.who.trim() || null,
          property_id: codingForm.property_id || null,
          unit_id: codingForm.unit_id || null,
          account_code: codingForm.account_code || null,
          notes: codingForm.notes.trim() || null,
          invoice_id: codingForm.invoice_id || null,
          status: "REVIEWED",
        };
      }

      const res = await fetch("/api/transactions/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error ?? "Failed");

      const allocNotes = splitMode
        ? `Split: ${splitLines.length} lines`
        : codingForm.notes || null;

      setTxns(prev => prev.map(t => t.id !== txn.id ? t : {
        ...t, status: "REVIEWED",
        tenant_id: codingForm.who || null,
        property_id: codingForm.property_id || null,
        unit_id: codingForm.unit_id || null,
        account_code: splitMode ? null : (codingForm.account_code || null),
        alloc_notes: allocNotes,
      }));

      // Auto-advance to next unreconciled transaction
      const idx = txns.findIndex(t => t.id === txn.id);
      const next = txns.slice(idx + 1).find(t => t.status === "UNREVIEWED");
      if (next && subTab === "tocode") {
        setExpandedId(next.id);
        setSplitMode(false);
        setCodingForm({ who: next.tenant_id ?? next.payee ?? "", account_code: next.account_code ?? "4010", property_id: next.property_id ?? "", unit_id: next.unit_id ?? "", notes: next.alloc_notes ?? extractDesc(next.raw_particulars), invoice_id: "" });
      } else {
        setExpandedId(null);
        setSplitMode(false);
      }
      setToast(splitMode ? `Reconcile as ${splitLines.length} lines` : "Reconcile");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setTxnError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  }

  async function confirmSuggestedMatch(txn: TxnDTO, suggestion: SuggestedMatch) {
    setSaving(true);
    setTxnError(null);
    try {
      const res = await fetch("/api/transactions/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: txn.id,
          tenant_id: suggestion.tenantId ?? (codingForm.who.trim() || null),
          property_id: codingForm.property_id || null,
          unit_id: suggestion.unitId ?? (codingForm.unit_id || null),
          account_code: codingForm.account_code || "4010",
          notes: suggestion.reasonSummary
            ? `Auto-match: ${suggestion.reasonSummary}`
            : "Auto-match from suggestion",
          invoice_id: suggestion.invoiceId,
          status: "REVIEWED",
        }),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error ?? "Failed to confirm match");

      await loadTxns();
      setExpandedId(null);
      setSplitMode(false);
      setToast("Suggested match confirmed");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setTxnError(err instanceof Error ? err.message : "Failed to confirm suggested match");
    } finally {
      setSaving(false);
    }
  }

  async function removeCoding(txn: TxnDTO) {
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
      setSplitMode(false);
    } catch (err) { setTxnError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  // Compute running balance for every transaction.
  // Use the real `balance` column if populated; otherwise compute a cumulative
  // running total starting from 0 (oldest → newest).
  const txnsWithBal: TxnWithBalance[] = (() => {
    const asc = [...txns].reverse(); // oldest first
    let running = 0;
    const mapped = asc.map(t => {
      running += t.amount;
      return { ...t, displayBalance: t.balance ?? running };
    });
    return mapped.reverse(); // newest first
  })();

  const unreviewed = txnsWithBal.filter(t => t.status === "UNREVIEWED");
  const reviewed   = txnsWithBal.filter(t => t.status !== "UNREVIEWED");
  const totalIn    = txnsWithBal.reduce((s, t) => s + (t.deposit > 0 ? t.deposit : 0), 0);
  const totalOut   = txnsWithBal.reduce((s, t) => s + (t.withdrawal > 0 ? t.withdrawal : 0), 0);
  const openingBal = txnsWithBal.length > 0 ? (txnsWithBal[txnsWithBal.length - 1].displayBalance - txnsWithBal[txnsWithBal.length - 1].amount) : null;
  const closingBal = txnsWithBal[0]?.displayBalance ?? null;
  const visibleTxns = subTab === "tocode" ? unreviewed : reviewed;
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
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: selectedAccount.color }} />
              )}
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="min-w-[200px] rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:outline-none"
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
            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                try {
                  const res = await fetch("/api/admin/spaces-sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ force: true }),
                  });
                  const p = await res.json();
                  if (p.ok) {
                    setToast("Balances backfilled from Spaces");
                    loadTxns();
                  } else {
                    setTxnError(p.error ?? "Backfill failed");
                  }
                } catch {
                  setTxnError("Backfill failed");
                } finally {
                  setSyncing(false);
                }
              }}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              {syncing ? "…" : "↺ Backfill balances"}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
          <Stat label="Opening balance" value={openingBal != null ? fmt.format(openingBal) : "—"} />
          <Stat label="Total in" value={fmt.format(totalIn)} color="text-emerald-400" />
          <Stat label="Total out" value={fmt.format(totalOut)} color="text-rose-400" />
          <Stat label="Closing balance" value={closingBal != null ? fmt.format(closingBal) : "—"} />
          <Stat label="Statement lines" value={String(txns.length)} />
          <Stat label="Unreconciled" value={String(unreviewed.length)} color={unreviewed.length > 0 ? "text-amber-400" : "text-slate-400"} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-white/10 px-6">
        {(["reconcile", "statements", "transactions", "summary"] as ActiveTab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`-mb-px border-b-2 px-4 py-3 text-xs font-semibold capitalize transition ${activeTab === tab ? "border-accent text-accent" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            {tab === "reconcile"
              ? <>Reconcile {unreviewed.length > 0 && <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">{unreviewed.length}</span>}</>
              : tab === "statements" ? "Bank Statements"
              : tab === "transactions" ? "Account Transactions"
              : "Summary"}
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
        <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-400">
          <span>{txnError}</span>
          <button onClick={() => setTxnError(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ── Reconcile Tab ── */}
      {activeTab === "reconcile" && (
        <div className="px-6 py-4">
          <div className="mb-4 flex items-center gap-2">
            <button type="button" onClick={() => setSubTab("tocode")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${subTab === "tocode" ? "bg-amber-500/20 text-amber-300" : "border border-white/10 text-slate-400 hover:text-slate-200"}`}>
              Unreconciled ({unreviewed.length})
            </button>
            <button type="button" onClick={() => setSubTab("coded")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${subTab === "coded" ? "bg-emerald-500/20 text-emerald-300" : "border border-white/10 text-slate-400 hover:text-slate-200"}`}>
              Reconcile ({reviewed.length})
            </button>
          </div>
          {loadingTxns && <p className="py-8 text-center text-sm text-slate-500">Loading transactions…</p>}
          {!loadingTxns && !visibleTxns.length && (
            <SectionCard className="p-8 text-center text-sm text-slate-500">
              {subTab === "tocode" ? "All transactions are Reconcile. Great work!" : "No Reconcile transactions yet."}
            </SectionCard>
          )}
          <div className="space-y-2">
            {visibleTxns.map(txn => {
              const isExpanded = expandedId === txn.id;
              const desc = extractDesc(txn.raw_particulars);
              const isCoded = txn.status !== "UNREVIEWED";
              const isSplit = txn.alloc_notes?.startsWith("Split:");
              const splitTotal = splitMode && isExpanded
                ? splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
                : 0;
              const remaining = txn.amount - splitTotal;
              const splitBalanced = Math.abs(remaining) < 0.01;

              return (
                <SectionCard key={txn.id} className="overflow-hidden p-0">
                  <button type="button" onClick={() => openRow(txn)} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-white/5">
                    <div className="w-28 flex-shrink-0 text-sm text-slate-400">{fmtDate(txn.date)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-slate-100">{txn.payee || "—"}</p>
                      <p className="truncate text-sm text-slate-500">{desc}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-base font-semibold tabular-nums ${txn.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {txn.amount >= 0 ? "+" : ""}{fmt.format(txn.amount)}
                      </p>
                      <p className="text-xs tabular-nums text-slate-500">{fmt.format(txn.displayBalance)}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                      {isCoded ? (
                        <>
                          {isSplit
                            ? <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300">Split</span>
                            : txn.account_code && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">{txn.account_code}</span>
                          }
                          {txn.property_id && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300">{propName(txn.property_id)}</span>}
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">Reconcile</span>
                        </>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">Unreconciled</span>
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
                        <div className="mb-3">
                          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Reconcile This Transaction
                          </p>
                        </div>

                        <div className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">
                            Suggested Matches
                          </p>
                          {loadingSuggestionTxnId === txn.id ? (
                            <p className="text-xs text-slate-500">Finding suggestions…</p>
                          ) : (suggestionsByTxn[txn.id] ?? []).length === 0 ? (
                            <p className="text-xs text-slate-500">No high-confidence suggestions. You can still reconcile manually below.</p>
                          ) : (
                            <div className="space-y-2">
                              {(suggestionsByTxn[txn.id] ?? []).map((s) => (
                                <div key={s.invoiceId} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/10 px-2.5 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-slate-200">
                                      {s.invoiceNumber || s.period || s.invoiceId}
                                      <span className="ml-2 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-200">
                                        {Math.round(s.score * 100)}%
                                      </span>
                                    </p>
                                    <p className="truncate text-[11px] text-slate-400">
                                      {s.tenantName || "Unknown tenant"} - Outstanding {fmt.format(s.outstanding)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => confirmSuggestedMatch(txn, s)}
                                    className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
                                  >
                                    Confirm match
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-violet-300">
                            Transaction History
                          </p>
                          {loadingHistoryTxnId === txn.id ? (
                            <p className="text-xs text-slate-500">Loading history…</p>
                          ) : (
                            <div className="space-y-2">
                              {(historyByTxn[txn.id]?.events ?? []).map((event) => (
                                <div key={event.id} className="rounded-md border border-white/10 bg-black/10 px-2.5 py-2">
                                  <p className="text-[11px] font-semibold text-slate-200">
                                    {event.action.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {event.created_by || "unknown user"} · {event.created_at ? new Date(event.created_at).toLocaleString() : "unknown time"}
                                  </p>
                                </div>
                              ))}
                              {(historyByTxn[txn.id]?.allocations ?? []).map((alloc) => (
                                <div key={alloc.id} className="rounded-md border border-white/10 bg-black/10 px-2.5 py-2">
                                  <p className="text-[11px] text-slate-200">
                                    Matched {fmt.format(Number(alloc.allocated_amount || 0))} to{" "}
                                    {alloc.invoice_number || alloc.invoice_id}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {alloc.created_by || "unknown user"} · {alloc.created_at ? new Date(alloc.created_at).toLocaleString() : "unknown time"}
                                  </p>
                                </div>
                              ))}
                              {(historyByTxn[txn.id]?.events ?? []).length === 0 && (historyByTxn[txn.id]?.allocations ?? []).length === 0 && (
                                <p className="text-xs text-slate-500">No reconciliation history yet.</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Shared fields (who, property, unit) */}
                        <div className="mb-4 grid grid-cols-2 gap-3">
                          <FormField label="Who (tenant / payer)">
                            <input type="text" value={codingForm.who}
                              onChange={e => setCodingForm(f => ({ ...f, who: e.target.value }))}
                              placeholder="Tenant name"
                              className="w-full rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none" />
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
                        </div>

                        {/* Invoice link */}
                        {(codingForm.unit_id || codingForm.who.trim()) && (
                          <div className="mb-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-400">
                              Link to Invoice
                            </p>
                            {loadingInvoices ? (
                              <p className="text-xs text-slate-500">Loading invoices…</p>
                            ) : invoiceOptions.length === 0 ? (
                              <p className="text-xs text-slate-500">No invoices found for this unit.</p>
                            ) : (
                              <select
                                value={codingForm.invoice_id}
                                onChange={e => setCodingForm(f => ({ ...f, invoice_id: e.target.value }))}
                                className="w-full rounded-lg border border-white/10 bg-panel/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400/50 focus:outline-none"
                              >
                                <option value="">— Don't link to an invoice —</option>
                                {invoiceOptions.map(inv => {
                                  const isPartial = inv.status === "partially_paid";
                                  const displayAmt = isPartial ? inv.outstanding : inv.total;
                                  const label = isPartial
                                    ? `${inv.period} · ${fmt.format(displayAmt)} outstanding of ${fmt.format(inv.total)} · Partial`
                                    : `${inv.period} · ${fmt.format(inv.total)} · ${inv.status}`;
                                  return <option key={inv.id} value={inv.id}>{label}</option>;
                                })}
                              </select>
                            )}
                            {codingForm.invoice_id && (() => {
                              const linked = invoiceOptions.find(inv => inv.id === codingForm.invoice_id);
                              const owed = linked ? (linked.status === "partially_paid" ? linked.outstanding : linked.total) : 0;
                              const diff = linked ? txn.amount - owed : 0;
                              const overpaid = diff > 0.01;
                              const underpaid = diff < -0.01;
                              return (
                                <>
                                  {overpaid && (
                                    <p className="mt-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold text-rose-300">
                                      🚫 Payment is <strong>{fmt.format(diff)} more</strong> than the outstanding balance ({fmt.format(owed)}). Use <strong>Split</strong> to separate the excess — e.g. send it to 2050 Suspense or 2010 Deposits.
                                    </p>
                                  )}
                                  {underpaid && (
                                    <p className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300">
                                      ⚠ Payment covers {fmt.format(txn.amount)} of {fmt.format(owed)} outstanding. Invoice will be marked <strong>Partially Paid</strong> — {fmt.format(Math.abs(diff))} still owed.
                                    </p>
                                  )}
                                  {!overpaid && !underpaid && (
                                    <p className="mt-1.5 text-xs text-indigo-300">✓ Amount matches — invoice will be marked <strong>Paid</strong> when you save.</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {/* Split lines */}
                        {(
                          <div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-slate-500">
                                  <th className="pb-2 pr-2">Amount</th>
                                  <th className="pb-2 pr-2">Account</th>
                                  {codingForm.property_id && <th className="pb-2 pr-2">Unit</th>}
                                  <th className="pb-2 pr-2">Invoice</th>
                                  <th className="pb-2 pr-2">Description</th>
                                  <th className="pb-2 w-6"></th>
                                </tr>
                              </thead>
                              <tbody className="space-y-2">
                                {splitLines.map((line, idx) => (
                                  <tr key={line.key}>
                                    <td className="pr-2 pb-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={line.amount}
                                        onChange={e => setSplitLines(ls => ls.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))}
                                        className="w-24 rounded-lg border border-white/10 bg-panel/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent/50 focus:outline-none tabular-nums"
                                      />
                                    </td>
                                    <td className="pr-2 pb-2">
                                      <select
                                        value={line.account_code}
                                        onChange={e => setSplitLines(ls => ls.map((l, i) => i === idx ? { ...l, account_code: e.target.value } : l))}
                                        className="w-full rounded-lg border border-white/10 bg-panel/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent/50 focus:outline-none"
                                      >
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
                                    </td>
                                    {codingForm.property_id && (
                                      <td className="pr-2 pb-2">
                                        <select
                                          value={line.unit_id}
                                          onChange={e => {
                                            const uid = e.target.value;
                                            setSplitLines(ls => ls.map((l, i) => i === idx ? { ...l, unit_id: uid, invoice_id: "" } : l));
                                            loadSplitInvoices(line.key, uid);
                                          }}
                                          className="w-28 rounded-lg border border-white/10 bg-panel/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent/50 focus:outline-none"
                                        >
                                          <option value="">— Any —</option>
                                          {units.map(u => <option key={u.id} value={u.id}>Unit {u.unit}</option>)}
                                        </select>
                                      </td>
                                    )}
                                    <td className="pr-2 pb-2">
                                      <select
                                        value={line.invoice_id}
                                        onChange={e => setSplitLines(ls => ls.map((l, i) => i === idx ? { ...l, invoice_id: e.target.value } : l))}
                                        className="w-40 rounded-lg border border-white/10 bg-panel/80 px-2 py-1.5 text-sm text-slate-100 focus:border-indigo-400/50 focus:outline-none"
                                      >
                                        <option value="">— No invoice —</option>
                                        {(splitInvoiceOptions[line.key] ?? []).map(inv => (
                                          <option key={inv.id} value={inv.id}>
                                            {inv.period} · ${inv.total} · {inv.status}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="pr-2 pb-2">
                                      <input
                                        type="text"
                                        value={line.notes}
                                        onChange={e => setSplitLines(ls => ls.map((l, i) => i === idx ? { ...l, notes: e.target.value } : l))}
                                        placeholder="e.g. March rent"
                                        className="w-full rounded-lg border border-white/10 bg-panel/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent/50 focus:outline-none"
                                      />
                                    </td>
                                    <td className="pb-2">
                                      {splitLines.length > 1 && (
                                        <button type="button" onClick={() => setSplitLines(ls => ls.filter((_, i) => i !== idx))}
                                          className="text-slate-600 hover:text-rose-400">
                                          <X className="h-4 w-4" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="mt-2 flex items-center justify-between">
                              <button type="button"
                                onClick={() => setSplitLines(ls => [...ls, { key: newKey(), amount: "0", account_code: "4010", unit_id: "", notes: "", invoice_id: "" }])}
                                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
                                <Plus className="h-3.5 w-3.5" /> Add line
                              </button>
                              <span className={`text-sm font-semibold tabular-nums ${splitBalanced ? "text-emerald-400" : "text-amber-400"}`}>
                                {splitBalanced ? "✓ Balanced" : `Remaining: ${fmt.format(remaining)}`}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => saveCoding(txn)}
                            disabled={saving || !splitBalanced}
                            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {saving ? "Saving…" : "OK"}
                          </button>
                          {isCoded && (
                            <button type="button" onClick={() => removeCoding(txn)} disabled={saving}
                              className="text-sm text-slate-500 hover:text-rose-300">Mark Unreconciled</button>
                          )}
                          <button type="button" onClick={() => { setExpandedId(null); setSplitMode(false); }}
                            className="text-sm text-slate-500 hover:text-slate-300">▲ Close</button>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Payee</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-right">Spent</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTxns && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>}
                  {!loadingTxns && txnsWithBal.map(txn => (
                    <tr key={txn.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">{fmtDate(txn.date)}</td>
                      <td className="px-4 py-3">
                        {txn.deposit > 0
                          ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">Credit</span>
                          : <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-400">Debit</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">{txn.payee || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{txn.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-400">{txn.withdrawal > 0 ? fmt.format(txn.withdrawal) : ""}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-400">{txn.deposit > 0 ? fmt.format(txn.deposit) : ""}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{fmt.format(txn.displayBalance)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{txn.source_bank ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={txn.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                {!loadingTxns && txnsWithBal.map(txn => (
                  <tr key={txn.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-slate-500">{fmtDate(txn.date)}</td>
                    <td className="px-4 py-3 text-slate-100">{txn.payee || "—"}</td>
                    <td className="px-4 py-3">
                      {txn.account_code
                        ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">{txn.account_code}</span>
                        : txn.alloc_notes?.startsWith("Split:")
                          ? <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300">Split</span>
                          : <span className="text-slate-600">—</span>}
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
            <KpiCard label="Reconcile" value={String(reviewed.length)} color="text-emerald-400" />
            <KpiCard label="Unreconciled" value={String(unreviewed.length)} color={unreviewed.length > 0 ? "text-amber-400" : "text-slate-400"} />
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
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-600">No Reconcile transactions yet.</td></tr>
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
  if (status === "REVIEWED") return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">Reconcile</span>;
  if (status === "RECONCILED") return <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">Reconcile</span>;
  return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">Unreconciled</span>;
}
