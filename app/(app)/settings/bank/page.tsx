"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import SettingsShell from "@/components/settings/SettingsShell";
import SettingsTable from "@/components/settings/SettingsTable";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import SectionCard from "@/components/ui/SectionCard";
import { fetchSettings, saveSettings } from "@/lib/settings/client";
import type { BankSettings } from "@/lib/settings/types";
import { DEFAULT_BANK } from "@/lib/settings/defaults";

type BankAccount = {
  id: string;
  name: string;
  bank_name: string;
  account_number: string | null;
  currency: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
};

type AccountForm = {
  name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  color: string;
  notes: string;
  is_default: boolean;
};

const COLOR_SWATCHES = [
  { hex: "#13c2c2", label: "Teal" },
  { hex: "#1677ff", label: "Blue" },
  { hex: "#fa8c16", label: "Amber" },
  { hex: "#722ed1", label: "Purple" },
  { hex: "#f5222d", label: "Red" },
  { hex: "#52c41a", label: "Green" },
  { hex: "#eb2f96", label: "Pink" },
  { hex: "#8c8c8c", label: "Slate" },
];

const CURRENCIES = ["USD", "GBP", "EUR", "KES", "SOS", "AED"];

const EMPTY_FORM: AccountForm = {
  name: "",
  bank_name: "Salaam Bank",
  account_number: "",
  currency: "USD",
  color: "#13c2c2",
  notes: "",
  is_default: false,
};

export default function BankSettingsPage() {
  const confirm = useConfirm();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [instructions, setInstructions] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadAccounts() {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/bank-accounts");
      const payload = await res.json();
      if (payload.ok) setAccounts(payload.data ?? []);
    } catch { /* ignore */ } finally {
      setLoadingAccounts(false);
    }
  }

  useEffect(() => {
    loadAccounts();
    fetchSettings<BankSettings>("bank", DEFAULT_BANK).then((data) => {
      setInstructions(data.tenantInstructions ?? "");
    });
  }, []);

  async function saveInstructions() {
    setSavingInstructions(true);
    const settings = await fetchSettings<BankSettings>("bank", DEFAULT_BANK);
    const response = await saveSettings("bank", { ...settings, tenantInstructions: instructions });
    setSavingInstructions(false);
    setToast(response.ok
      ? { type: "success", message: "Instructions saved." }
      : { type: "error", message: "Failed to save instructions." });
  }

  function openNew() {
    setEditingId(null);
    setFormErrors({});
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(account: BankAccount) {
    setEditingId(account.id);
    setFormErrors({});
    setForm({
      name: account.name,
      bank_name: account.bank_name,
      account_number: account.account_number ?? "",
      currency: account.currency,
      color: account.color,
      notes: account.notes ?? "",
      is_default: account.is_default,
    });
    setDrawerOpen(true);
  }

  async function saveAccount() {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Account name is required.";
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const url = editingId ? `/api/bank-accounts/${editingId}` : "/api/bank-accounts";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          bank_name: form.bank_name.trim() || "Salaam Bank",
          account_number: form.account_number.trim() || null,
          currency: form.currency,
          color: form.color,
          notes: form.notes.trim() || null,
          is_default: form.is_default,
        }),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error ?? "Failed to save");
      setDrawerOpen(false);
      setToast({ type: "success", message: editingId ? "Account updated." : "Account created." });
      await loadAccounts();
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to save." });
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error);
      await loadAccounts();
      setToast({ type: "success", message: "Default account updated." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed." });
    }
  }

  async function deactivate(account: BankAccount) {
    if (account.is_default) {
      setToast({ type: "error", message: "Cannot deactivate the default account." });
      return;
    }
    const confirmed = await confirm({
      title: "Deactivate Bank Account",
      message: `Deactivate "${account.name}"? Transactions are kept.`,
      confirmLabel: "Deactivate",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/bank-accounts/${account.id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error);
      await loadAccounts();
      setToast({ type: "success", message: "Account deactivated." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed." });
    }
  }

  const defaultAccount = accounts.find((a) => a.is_default);

  return (
    <SettingsShell
      title="Bank Info"
      description="Manage bank accounts and tenant-facing payment instructions."
      saving={savingInstructions}
      toast={toast}
      onDismissToast={() => setToast(null)}
      onSave={saveInstructions}
      onReset={() => setInstructions("")}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SettingsTable
            title="Bank Accounts"
            description="One account must be the default at all times."
            action={
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900"
              >
                <Plus className="h-4 w-4" />
                Add Account
              </button>
            }
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Bank</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Default</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                {loadingAccounts && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Loading…</td></tr>
                )}
                {!loadingAccounts && !accounts.length && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No bank accounts yet.</td></tr>
                )}
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: account.color }} />
                        <span className="font-semibold text-slate-100">{account.name}</span>
                        {account.account_number && (
                          <span className="text-xs text-slate-500">{account.account_number}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{account.bank_name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs">{account.currency}</span>
                    </td>
                    <td className="px-4 py-3">
                      {account.is_default ? (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">Default</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDefault(account.id)}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:border-white/20 hover:text-slate-200"
                        >
                          Set default
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(account)}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:border-white/20"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deactivate(account)}
                          disabled={account.is_default}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-rose-200 hover:border-rose-300/50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SettingsTable>

          <SectionCard className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tenant Payment Instructions</p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Please transfer rent to Salaam Bank Current Account. Reference: your unit number."
              className="min-h-[120px] w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            />
            <p className="mt-2 text-xs text-slate-500">Shown on invoices and tenant communications. Save using the button below.</p>
          </SectionCard>
        </div>

        <SectionCard className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Default Account</p>
          {defaultAccount ? (
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: defaultAccount.color }} />
                <p className="text-base font-semibold text-slate-100">{defaultAccount.name}</p>
              </div>
              <p>{defaultAccount.bank_name}</p>
              {defaultAccount.account_number && <p className="font-mono text-xs">{defaultAccount.account_number}</p>}
              <p className="text-xs text-slate-500">{defaultAccount.currency}</p>
              {defaultAccount.notes && <p className="text-xs text-slate-500">{defaultAccount.notes}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No default account set.</p>
          )}
        </SectionCard>
      </div>

      <SettingsDrawer
        open={drawerOpen}
        title={editingId ? "Edit Account" : "Add Account"}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveAccount}
              disabled={saving}
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Account"}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-300">
          <label className="block">
            Account name *
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Current Account"
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
            {formErrors.name && <p className="mt-1 text-xs text-rose-300">{formErrors.name}</p>}
          </label>
          <label className="block">
            Bank name
            <input
              value={form.bank_name}
              onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block">
            Account number
            <input
              value={form.account_number}
              onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
              placeholder="e.g. •••• 4821"
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block">
            Currency
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div>
            <p className="mb-2">Colour</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((s) => (
                <button
                  key={s.hex}
                  type="button"
                  title={s.label}
                  onClick={() => setForm((f) => ({ ...f, color: s.hex }))}
                  className={`h-7 w-7 rounded-full border-2 transition ${form.color === s.hex ? "border-white scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: s.hex }}
                />
              ))}
            </div>
          </div>
          <label className="block">
            Notes (optional)
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Used for rent collection"
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
            />
            Set as default account
          </label>
        </div>
      </SettingsDrawer>
    </SettingsShell>
  );
}
