"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import SettingsShell from "@/components/settings/SettingsShell";
import SettingsTable from "@/components/settings/SettingsTable";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/settings/defaults";
import type { ExpenseCategory, ExpenseCategoriesSettings } from "@/lib/settings/types";
import { fetchSettings, saveSettings } from "@/lib/settings/client";

const EMPTY_CATEGORY: ExpenseCategory = {
  id: "",
  code: "",
  name: "",
  type: "expense",
  taxRate: "No Tax",
  description: "",
  active: true,
  showOnPurchases: true,
};

const TAX_RATES = [
  "No Tax",
  "Exempt",
  "VAT 5%",
  "VAT 10%",
  "VAT 15%",
  "GST 5%",
  "GST 10%",
  "GST 15%",
  "Sales Tax 7.5%",
];

export default function ExpenseCategoriesPage() {
  const [form, setForm] = useState<ExpenseCategoriesSettings>(DEFAULT_EXPENSE_CATEGORIES);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory>(EMPTY_CATEGORY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings<ExpenseCategoriesSettings>("expense-categories", DEFAULT_EXPENSE_CATEGORIES).then(setForm);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const response = await saveSettings("expense-categories", form);
    setSaving(false);
    if (!response.ok) {
      setToast({ type: "error", message: response.error || "Failed to save expense categories." });
      return;
    }
    setForm(response.data || form);
    setToast({ type: "success", message: "Expense categories saved." });
  };

  const handleReset = () => {
    setForm(DEFAULT_EXPENSE_CATEGORIES);
    setToast({ type: "success", message: "Reset to defaults." });
  };

  const openNew = () => {
    setErrors({});
    setEditing({ ...EMPTY_CATEGORY, id: crypto.randomUUID() });
    setDrawerOpen(true);
  };

  const openEdit = (category: ExpenseCategory) => {
    setErrors({});
    setEditing({ ...category });
    setDrawerOpen(true);
  };

  const saveCategory = () => {
    const nextErrors: Record<string, string> = {};
    if (!editing.name.trim()) nextErrors.name = "Category name is required.";
    if (!editing.code.trim()) nextErrors.code = "Account code is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setForm((prev) => {
      const categories = prev.categories.some((item) => item.id === editing.id)
        ? prev.categories.map((item) => (item.id === editing.id ? editing : item))
        : [...prev.categories, editing];
      return { ...prev, categories };
    });
    setDrawerOpen(false);
  };

  const deleteCategory = (id: string) => {
    if (!confirm("Delete this expense category?")) return;
    setForm((prev) => ({ ...prev, categories: prev.categories.filter((item) => item.id !== id) }));
  };

  return (
    <SettingsShell
      title="Expense Accounts"
      description="Manage purchases and expense accounts in an Xero-style chart."
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      <SettingsTable
        title="Expense & Purchases Accounts"
        description="Use these accounts when recording bills, purchases, and expenses."
        action={
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        }
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Tax Rate</th>
              <th className="px-4 py-3">Purchases</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            {form.categories.map((category) => (
              <tr key={category.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 font-semibold text-slate-100">{category.code || "—"}</td>
                <td className="px-4 py-3">{category.name}</td>
                <td className="px-4 py-3 capitalize">{category.type.replace("_", " ")}</td>
                <td className="px-4 py-3">{category.taxRate || "—"}</td>
                <td className="px-4 py-3">{category.showOnPurchases ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      category.active
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {category.active ? "Active" : "Archived"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:border-white/20"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(category.id)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-rose-200 hover:border-rose-300/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!form.categories.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  No expense categories defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SettingsTable>

      <SettingsDrawer
        open={drawerOpen}
        title={editing.name ? "Edit Category" : "Add Category"}
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
              onClick={saveCategory}
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900"
            >
              Save Category
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-300">
          <label>
            Account code *
            <input
              value={editing.code}
              onChange={(event) => setEditing((prev) => ({ ...prev, code: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
            {errors.code ? <p className="mt-1 text-xs text-rose-300">{errors.code}</p> : null}
          </label>
          <label>
            Account name *
            <input
              value={editing.name}
              onChange={(event) => setEditing((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
            {errors.name ? <p className="mt-1 text-xs text-rose-300">{errors.name}</p> : null}
          </label>
          <label>
            Account type
            <select
              value={editing.type}
              onChange={(event) =>
                setEditing((prev) => ({
                  ...prev,
                  type: event.target.value as ExpenseCategory["type"],
                }))
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            >
              <option value="expense">Expense</option>
              <option value="cost_of_sales">Cost of Sales</option>
              <option value="overhead">Overhead</option>
            </select>
          </label>
          <label>
            Tax rate
            <select
              value={editing.taxRate || "No Tax"}
              onChange={(event) => setEditing((prev) => ({ ...prev, taxRate: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            >
              {TAX_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editing.showOnPurchases}
              onChange={(event) => setEditing((prev) => ({ ...prev, showOnPurchases: event.target.checked }))}
            />
            Show on purchases
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(event) => setEditing((prev) => ({ ...prev, active: event.target.checked }))}
            />
            Active
          </label>
          <label>
            Description
            <textarea
              value={editing.description || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, description: event.target.value }))}
              className="mt-2 min-h-[90px] w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
      </SettingsDrawer>
    </SettingsShell>
  );
}
