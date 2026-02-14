"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import SettingsShell from "@/components/settings/SettingsShell";
import { DEFAULT_GENERAL } from "@/lib/settings/defaults";
import type { GeneralSettings } from "@/lib/settings/types";
import { fetchSettings, saveSettings } from "@/lib/settings/client";

const CURRENCIES = ["USD", "GBP", "EUR"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function GeneralSettingsPage() {
  const [form, setForm] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSettings<GeneralSettings>("general", DEFAULT_GENERAL).then((data) => setForm(data));
  }, []);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.orgName.trim()) next.orgName = "Organization name is required.";
    if (!form.email.trim()) next.email = "Primary email is required.";
    return next;
  };

  const handleSave = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToast({ type: "error", message: "Please fix the highlighted fields." });
      return;
    }
    setSaving(true);
    const response = await saveSettings("general", form);
    setSaving(false);
    if (!response.ok) {
      setErrors(response.fields || {});
      setToast({ type: "error", message: response.error || "Failed to save settings." });
      return;
    }
    setToast({ type: "success", message: "General info saved." });
  };

  const handleReset = () => {
    setForm(DEFAULT_GENERAL);
    setErrors({});
    setToast({ type: "success", message: "Reset to defaults." });
  };

  return (
    <SettingsShell
      title="General Info"
      description="Add your organization details and default business settings."
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Organization name *
              <input
                value={form.orgName}
                onChange={(event) => setForm((prev) => ({ ...prev, orgName: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
              {errors.orgName ? <p className="mt-1 text-xs text-rose-300">{errors.orgName}</p> : null}
            </label>

            <label className="text-sm text-slate-300">
              Display name
              <input
                value={form.displayName || ""}
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Primary email *
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
              {errors.email ? <p className="mt-1 text-xs text-rose-300">{errors.email}</p> : null}
            </label>

            <label className="text-sm text-slate-300">
              Primary phone
              <input
                value={form.phone || ""}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300 sm:col-span-2">
              Address
              <textarea
                value={form.address || ""}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="mt-2 min-h-[100px] w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Default currency
              <select
                value={form.defaultCurrency}
                onChange={(event) => setForm((prev) => ({ ...prev, defaultCurrency: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Fiscal year start month
              <select
                value={String(form.fiscalYearStartMonth)}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fiscalYearStartMonth: Number(event.target.value) }))
                }
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Timezone
              <input
                value={form.timezone}
                onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview</p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div>
              <p className="text-xs text-slate-500">Organization</p>
              <p className="text-base font-semibold text-slate-100">{form.orgName || "—"}</p>
              {form.displayName ? <p className="text-xs text-slate-400">{form.displayName}</p> : null}
            </div>
            <div>
              <p className="text-xs text-slate-500">Primary contact</p>
              <p>{form.email || "—"}</p>
              {form.phone ? <p className="text-xs text-slate-400">{form.phone}</p> : null}
            </div>
            <div>
              <p className="text-xs text-slate-500">Defaults</p>
              <p>{form.defaultCurrency} · Fiscal year starts {MONTHS[form.fiscalYearStartMonth - 1]}</p>
              <p className="text-xs text-slate-400">{form.timezone}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </SettingsShell>
  );
}
