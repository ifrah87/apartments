"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, PowerOff, Power, Trash2 } from "lucide-react";
import SettingsShell from "@/components/settings/SettingsShell";
import SectionCard from "@/components/ui/SectionCard";

type CoaAccount = {
  code: string; name: string; category: string;
  sub_type: string; sort_order: number; active: boolean;
};

const CATEGORIES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

const EMPTY_FORM = { code: "", name: "", category: "INCOME", sub_type: "", sort_order: "" };

export default function ChartOfAccountsSettingsPage() {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<CoaAccount | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/chart-of-accounts")
      .then(r => r.json())
      .then(p => { if (p.ok) setAccounts(p.data ?? []); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditAccount(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(a: CoaAccount) {
    setEditAccount(a);
    setForm({ code: a.code, name: a.name, category: a.category, sub_type: a.sub_type ?? "", sort_order: String(a.sort_order) });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      if (editAccount) {
        const res = await fetch("/api/chart-of-accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: editAccount.code, name: form.name, sub_type: form.sub_type, active: true }),
        });
        const p = await res.json();
        if (!p.ok) throw new Error(p.error);
      } else {
        const res = await fetch("/api/chart-of-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: form.code, name: form.name, category: form.category, sub_type: form.sub_type, sort_order: parseInt(form.sort_order || "999") }),
        });
        const p = await res.json();
        if (!p.ok) throw new Error(p.error);
      }
      setShowForm(false);
      load();
      setToast(editAccount ? "Account updated" : "Account added");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  }

  async function toggleActive(a: CoaAccount) {
    try {
      await fetch("/api/chart-of-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: a.code, name: a.name, sub_type: a.sub_type, active: !a.active }),
      });
      load();
      setToast(a.active ? "Account deactivated" : "Account activated");
      setTimeout(() => setToast(null), 2000);
    } catch { /* ignore */ }
  }

  async function deleteAccount(a: CoaAccount) {
    if (!confirm(`Permanently delete ${a.code} — ${a.name}? This cannot be undone.`)) return;
    try {
      await fetch("/api/chart-of-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: a.code }),
      });
      load();
      setToast(`Deleted ${a.code}`);
      setTimeout(() => setToast(null), 2000);
    } catch { /* ignore */ }
  }

  const grouped = CATEGORIES.map(cat => ({
    cat,
    rows: accounts.filter(a => a.category === cat),
  })).filter(g => g.rows.length > 0);

  return (
    <SettingsShell title="Chart of Accounts" description="Manage the accounts used for coding bank transactions.">
      {toast && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
          {toast}
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <button onClick={openAdd}
          className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/80">
          <Plus className="h-4 w-4" /> Add Account
        </button>
      </div>

      {loading && <p className="py-8 text-center text-sm text-slate-500">Loading…</p>}

      {!loading && grouped.map(({ cat, rows }) => (
        <SectionCard key={cat} className="mb-4 overflow-hidden p-0">
          <div className="border-b border-white/10 bg-white/5 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{cat}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2 w-20">Code</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Sub-type</th>
                <th className="px-4 py-2 w-24">Status</th>
                <th className="px-4 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.code} className={`border-t border-white/5 hover:bg-white/5 ${!a.active ? "opacity-40" : ""}`}>
                  <td className="px-4 py-2.5 font-mono font-semibold text-accent">{a.code}</td>
                  <td className="px-4 py-2.5 text-slate-100">{a.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{a.sub_type || "—"}</td>
                  <td className="px-4 py-2.5">
                    {a.active
                      ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">Active</span>
                      : <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs text-slate-500">Inactive</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(a)} title="Edit"
                        className="text-slate-500 hover:text-slate-200">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleActive(a)} title={a.active ? "Deactivate" : "Activate"}
                        className={a.active ? "text-slate-500 hover:text-amber-400" : "text-slate-600 hover:text-emerald-400"}>
                        {a.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => deleteAccount(a)} title="Delete permanently"
                        className="text-slate-600 hover:text-rose-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      ))}

      {/* Add / Edit drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-[#1a1f2e] p-6 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="mb-5 text-base font-semibold text-slate-100">
              {editAccount ? `Edit ${editAccount.code} — ${editAccount.name}` : "Add Account"}
            </h2>

            <div className="space-y-4">
              {!editAccount && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Code *</span>
                    <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                      placeholder="e.g. 200"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Category *</span>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Name *</span>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rental Income"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Sub-type</span>
                <input value={form.sub_type} onChange={e => setForm(f => ({ ...f, sub_type: e.target.value }))}
                  placeholder="e.g. Revenue"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none" />
              </label>
              {!editAccount && (
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Sort order</span>
                  <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                    placeholder="999"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none" />
                </label>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button onClick={save} disabled={saving || !form.name || (!editAccount && !form.code)}
                className="flex-1 rounded-full bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : editAccount ? "Save changes" : "Add account"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="rounded-full border border-white/10 px-5 py-2 text-sm text-slate-400 hover:text-slate-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
