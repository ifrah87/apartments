"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import SettingsShell from "@/components/settings/SettingsShell";
import SettingsTable from "@/components/settings/SettingsTable";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import SectionCard from "@/components/ui/SectionCard";
import { DEFAULT_BANK } from "@/lib/settings/defaults";
import type { BankAccount, BankSettings } from "@/lib/settings/types";
import { fetchSettings, saveSettings } from "@/lib/settings/client";

const EMPTY_ACCOUNT: BankAccount = {
  id: "",
  nickname: "",
  bankName: "",
  holder: "",
  accountNumber: "",
  iban: "",
  swift: "",
  currency: "USD",
  isDefault: false,
};

export default function BankSettingsPage() {
  const [form, setForm] = useState<BankSettings>(DEFAULT_BANK);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount>(EMPTY_ACCOUNT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings<BankSettings>("bank", DEFAULT_BANK).then((data) => setForm(data));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const response = await saveSettings("bank", form);
    setSaving(false);
    if (!response.ok) {
      setToast({ type: "error", message: response.error || "Failed to save bank info." });
      return;
    }
    setForm(response.data || form);
    setToast({ type: "success", message: "Bank info saved." });
  };

  const handleReset = () => {
    setForm(DEFAULT_BANK);
    setToast({ type: "success", message: "Reset to defaults." });
  };

  const openNew = () => {
    setErrors({});
    setEditing({ ...EMPTY_ACCOUNT, id: crypto.randomUUID() });
    setDrawerOpen(true);
  };

  const openEdit = (account: BankAccount) => {
    setErrors({});
    setEditing({ ...account });
    setDrawerOpen(true);
  };

  const saveAccount = () => {
    const nextErrors: Record<string, string> = {};
    if (!editing.nickname.trim()) nextErrors.nickname = "Nickname is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setForm((prev) => {
      const nextAccounts = prev.accounts.some((acct) => acct.id === editing.id)
        ? prev.accounts.map((acct) => (acct.id === editing.id ? editing : acct))
        : [...prev.accounts, editing];

      let hasDefault = nextAccounts.some((acct) => acct.isDefault);
      const normalized = nextAccounts.map((acct, index) => {
        if (editing.isDefault && acct.id !== editing.id) return { ...acct, isDefault: false };
        if (!hasDefault && index === 0) return { ...acct, isDefault: true };
        return acct;
      });

      return { ...prev, accounts: normalized };
    });

    setDrawerOpen(false);
  };

  const deleteAccount = (accountId: string) => {
    if (!confirm("Delete this bank account?")) return;
    setForm((prev) => {
      const remaining = prev.accounts.filter((acct) => acct.id !== accountId);
      if (!remaining.length) return { ...prev, accounts: [] };
      if (!remaining.some((acct) => acct.isDefault)) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      return { ...prev, accounts: [...remaining] };
    });
  };

  const defaultAccount = form.accounts.find((acct) => acct.isDefault);

  return (
    <SettingsShell
      title="Bank Info"
      description="Manage tenant-facing payment instructions and internal bank accounts."
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SettingsTable
            title="Bank Accounts"
            description="Maintain bank accounts and set the default."
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
                  <th className="px-4 py-3">Nickname</th>
                  <th className="px-4 py-3">Bank</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Default</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                {form.accounts.map((account) => (
                  <tr key={account.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-slate-100">{account.nickname}</td>
                    <td className="px-4 py-3">{account.bankName || "—"}</td>
                    <td className="px-4 py-3">{account.currency || "USD"}</td>
                    <td className="px-4 py-3">{account.isDefault ? "Yes" : "—"}</td>
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
                          onClick={() => deleteAccount(account.id)}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs text-rose-200 hover:border-rose-300/50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!form.accounts.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      No bank accounts added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </SettingsTable>

          <SectionCard className="p-6">
            <label className="text-sm text-slate-300">
              Tenant payment instructions
              <textarea
                value={form.tenantInstructions}
                onChange={(event) => setForm((prev) => ({ ...prev, tenantInstructions: event.target.value }))}
                className="mt-2 min-h-[120px] w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          </SectionCard>
        </div>

        <SectionCard className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Default account</p>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p className="text-base font-semibold text-slate-100">{defaultAccount?.nickname || "—"}</p>
            <p>{defaultAccount?.bankName || "Add a bank name"}</p>
            <p>{defaultAccount?.accountNumber || "Account number"}</p>
            <p className="text-xs text-slate-500">{defaultAccount?.currency || "USD"}</p>
          </div>
        </SectionCard>
      </div>

      <SettingsDrawer
        open={drawerOpen}
        title={editing.nickname ? "Edit Account" : "Add Account"}
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
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900"
            >
              Save Account
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-300">
          <label>
            Account nickname *
            <input
              value={editing.nickname}
              onChange={(event) => setEditing((prev) => ({ ...prev, nickname: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
            {errors.nickname ? <p className="mt-1 text-xs text-rose-300">{errors.nickname}</p> : null}
          </label>
          <label>
            Bank name
            <input
              value={editing.bankName || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, bankName: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label>
            Account holder
            <input
              value={editing.holder || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, holder: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label>
            Account number
            <input
              value={editing.accountNumber || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, accountNumber: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label>
            IBAN
            <input
              value={editing.iban || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, iban: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label>
            SWIFT / BIC
            <input
              value={editing.swift || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, swift: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label>
            Currency
            <input
              value={editing.currency || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, currency: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editing.isDefault}
              onChange={(event) => setEditing((prev) => ({ ...prev, isDefault: event.target.checked }))}
            />
            Set as default account
          </label>
        </div>
      </SettingsDrawer>
    </SettingsShell>
  );
}
