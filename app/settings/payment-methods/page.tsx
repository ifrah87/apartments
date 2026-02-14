"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import SettingsShell from "@/components/settings/SettingsShell";
import SettingsTable from "@/components/settings/SettingsTable";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/settings/defaults";
import type { PaymentMethod, PaymentMethodsSettings } from "@/lib/settings/types";
import { fetchSettings, saveSettings } from "@/lib/settings/client";

const EMPTY_METHOD: PaymentMethod = {
  id: "",
  name: "",
  enabled: true,
  requiresProof: false,
  autoMatchEligible: false,
  notes: "",
};

export default function PaymentMethodsPage() {
  const [form, setForm] = useState<PaymentMethodsSettings>(DEFAULT_PAYMENT_METHODS);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod>(EMPTY_METHOD);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings<PaymentMethodsSettings>("payment-methods", DEFAULT_PAYMENT_METHODS).then(setForm);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const response = await saveSettings("payment-methods", form);
    setSaving(false);
    if (!response.ok) {
      setToast({ type: "error", message: response.error || "Failed to save payment methods." });
      return;
    }
    setForm(response.data || form);
    setToast({ type: "success", message: "Payment methods saved." });
  };

  const handleReset = () => {
    setForm(DEFAULT_PAYMENT_METHODS);
    setToast({ type: "success", message: "Reset to defaults." });
  };

  const openNew = () => {
    setErrors({});
    setEditing({ ...EMPTY_METHOD, id: crypto.randomUUID() });
    setDrawerOpen(true);
  };

  const openEdit = (method: PaymentMethod) => {
    setErrors({});
    setEditing({ ...method });
    setDrawerOpen(true);
  };

  const saveMethod = () => {
    const nextErrors: Record<string, string> = {};
    if (!editing.name.trim()) nextErrors.name = "Method name is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setForm((prev) => {
      const methods = prev.methods.some((item) => item.id === editing.id)
        ? prev.methods.map((item) => (item.id === editing.id ? editing : item))
        : [...prev.methods, editing];
      return { ...prev, methods };
    });
    setDrawerOpen(false);
  };

  const deleteMethod = (id: string) => {
    if (!confirm("Delete this payment method?")) return;
    setForm((prev) => ({ ...prev, methods: prev.methods.filter((item) => item.id !== id) }));
  };

  return (
    <SettingsShell
      title="Payment Methods"
      description="Manage accepted payment channels and validation rules."
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      <SettingsTable
        title="Payment Methods"
        description="Used for manual payments and tenant portal options."
        action={
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add Method
          </button>
        }
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Requires Proof</th>
              <th className="px-4 py-3">Auto Match</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            {form.methods.map((method) => (
              <tr key={method.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 font-semibold text-slate-100">{method.name}</td>
                <td className="px-4 py-3">{method.enabled ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{method.requiresProof ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{method.autoMatchEligible ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(method)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:border-white/20"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMethod(method.id)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-rose-200 hover:border-rose-300/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!form.methods.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  No payment methods defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SettingsTable>

      <SettingsDrawer
        open={drawerOpen}
        title={editing.name ? "Edit Method" : "Add Method"}
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
              onClick={saveMethod}
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900"
            >
              Save Method
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-300">
          <label>
            Method name *
            <input
              value={editing.name}
              onChange={(event) => setEditing((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
            {errors.name ? <p className="mt-1 text-xs text-rose-300">{errors.name}</p> : null}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editing.enabled}
              onChange={(event) => setEditing((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            Enabled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editing.requiresProof}
              onChange={(event) => setEditing((prev) => ({ ...prev, requiresProof: event.target.checked }))}
            />
            Requires proof upload
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editing.autoMatchEligible}
              onChange={(event) => setEditing((prev) => ({ ...prev, autoMatchEligible: event.target.checked }))}
            />
            Auto-match eligible
          </label>
          <label>
            Notes
            <textarea
              value={editing.notes || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-2 min-h-[100px] w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
      </SettingsDrawer>
    </SettingsShell>
  );
}
