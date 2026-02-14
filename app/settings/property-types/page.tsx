"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import SettingsShell from "@/components/settings/SettingsShell";
import SettingsTable from "@/components/settings/SettingsTable";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import { DEFAULT_PROPERTY_TYPES } from "@/lib/settings/defaults";
import type { PropertyType, PropertyTypesSettings } from "@/lib/settings/types";
import { fetchSettings, saveSettings } from "@/lib/settings/client";

const EMPTY_TYPE: PropertyType = { id: "", name: "", code: "", glCategory: "" };

export default function PropertyTypesPage() {
  const [form, setForm] = useState<PropertyTypesSettings>(DEFAULT_PROPERTY_TYPES);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyType>(EMPTY_TYPE);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings<PropertyTypesSettings>("property-types", DEFAULT_PROPERTY_TYPES).then(setForm);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const response = await saveSettings("property-types", form);
    setSaving(false);
    if (!response.ok) {
      setToast({ type: "error", message: response.error || "Failed to save property types." });
      return;
    }
    setForm(response.data || form);
    setToast({ type: "success", message: "Property types saved." });
  };

  const handleReset = () => {
    setForm(DEFAULT_PROPERTY_TYPES);
    setToast({ type: "success", message: "Reset to defaults." });
  };

  const openNew = () => {
    setErrors({});
    setEditing({ ...EMPTY_TYPE, id: crypto.randomUUID() });
    setDrawerOpen(true);
  };

  const openEdit = (type: PropertyType) => {
    setErrors({});
    setEditing({ ...type });
    setDrawerOpen(true);
  };

  const saveType = () => {
    const nextErrors: Record<string, string> = {};
    if (!editing.name.trim()) nextErrors.name = "Name is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setForm((prev) => {
      const types = prev.types.some((item) => item.id === editing.id)
        ? prev.types.map((item) => (item.id === editing.id ? editing : item))
        : [...prev.types, editing];
      return { ...prev, types };
    });
    setDrawerOpen(false);
  };

  const deleteType = (id: string) => {
    if (!confirm("Delete this property type?")) return;
    setForm((prev) => ({ ...prev, types: prev.types.filter((item) => item.id !== id) }));
  };

  return (
    <SettingsShell
      title="Property Types"
      description="Manage allowed unit categories for properties."
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      <SettingsTable
        title="Property Types"
        description="Used across units and property records."
        action={
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add Type
          </button>
        }
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">GL Mapping</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            {form.types.map((type) => (
              <tr key={type.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 font-semibold text-slate-100">{type.name}</td>
                <td className="px-4 py-3">{type.code || "—"}</td>
                <td className="px-4 py-3">{type.glCategory || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(type)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:border-white/20"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteType(type.id)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-rose-200 hover:border-rose-300/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!form.types.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                  No property types created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SettingsTable>

      <SettingsDrawer
        open={drawerOpen}
        title={editing.name ? "Edit Property Type" : "Add Property Type"}
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
              onClick={saveType}
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900"
            >
              Save Type
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-300">
          <label>
            Name *
            <input
              value={editing.name}
              onChange={(event) => setEditing((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
            {errors.name ? <p className="mt-1 text-xs text-rose-300">{errors.name}</p> : null}
          </label>
          <label>
            Code
            <input
              value={editing.code || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, code: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label>
            Default GL mapping
            <input
              value={editing.glCategory || ""}
              onChange={(event) => setEditing((prev) => ({ ...prev, glCategory: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
      </SettingsDrawer>
    </SettingsShell>
  );
}
