"use client";

import { useEffect, useState } from "react";
import SettingsShell from "@/components/settings/SettingsShell";
import SectionCard from "@/components/ui/SectionCard";
import { DEFAULT_INITIAL_READINGS } from "@/lib/settings/defaults";
import type { InitialReadingsSettings } from "@/lib/settings/types";
import { fetchSettings, saveSettings } from "@/lib/settings/client";

export default function InitialReadingsPage() {
  const [form, setForm] = useState<InitialReadingsSettings>(DEFAULT_INITIAL_READINGS);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings<InitialReadingsSettings>("initial-readings", DEFAULT_INITIAL_READINGS).then(setForm);
  }, []);

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.enabledMeters.length) nextErrors.enabledMeters = "Select at least one meter type.";
    if (form.defaultReadingDay && (form.defaultReadingDay < 1 || form.defaultReadingDay > 28)) {
      nextErrors.defaultReadingDay = "Day must be between 1 and 28.";
    }
    if (form.rules.min !== undefined && form.rules.max !== undefined && form.rules.min > form.rules.max) {
      nextErrors.rules = "Min cannot be greater than max.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToast({ type: "error", message: "Please fix the highlighted fields." });
      return;
    }
    setSaving(true);
    const response = await saveSettings("initial-readings", form);
    setSaving(false);
    if (!response.ok) {
      setToast({ type: "error", message: response.error || "Failed to save settings." });
      return;
    }
    setForm(response.data || form);
    setToast({ type: "success", message: "Initial readings settings saved." });
  };

  const handleReset = () => {
    setForm(DEFAULT_INITIAL_READINGS);
    setToast({ type: "success", message: "Reset to defaults." });
  };

  const toggleMeter = (meter: "electricity" | "water") => {
    setForm((prev) => {
      const enabled = prev.enabledMeters.includes(meter)
        ? prev.enabledMeters.filter((m) => m !== meter)
        : [...prev.enabledMeters, meter];
      return { ...prev, enabledMeters: enabled };
    });
  };

  return (
    <SettingsShell
      title="Initial Readings"
      description="Configure baseline meter rules for onboarding units."
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard className="p-6">
          <div className="space-y-5 text-sm text-slate-300">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Meter types enabled</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {(["electricity", "water"] as const).map((meter) => (
                  <label
                    key={meter}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={form.enabledMeters.includes(meter)}
                      onChange={() => toggleMeter(meter)}
                    />
                    {meter === "electricity" ? "Electricity" : "Water"}
                  </label>
                ))}
              </div>
              {errors.enabledMeters ? <p className="mt-2 text-xs text-rose-300">{errors.enabledMeters}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                Electricity unit
                <input
                  value={form.units.electricity}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, units: { ...prev.units, electricity: event.target.value } }))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label>
                Water unit
                <input
                  value={form.units.water}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, units: { ...prev.units, water: event.target.value } }))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                Default electricity reading
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.initialReadings.electricity}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      initialReadings: {
                        ...prev.initialReadings,
                        electricity: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label>
                Default water reading
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.initialReadings.water}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      initialReadings: {
                        ...prev.initialReadings,
                        water: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.requireProof}
                onChange={(event) => setForm((prev) => ({ ...prev, requireProof: event.target.checked }))}
              />
              Require proof image for initial readings
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                Default reading day (1–28)
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={form.defaultReadingDay || ""}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, defaultReadingDay: Number(event.target.value) || 1 }))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
                {errors.defaultReadingDay ? <p className="mt-1 text-xs text-rose-300">{errors.defaultReadingDay}</p> : null}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.rules.allowZero}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, rules: { ...prev.rules, allowZero: event.target.checked } }))
                  }
                />
                Allow zero reading
              </label>
              <label>
                Minimum allowed
                <input
                  type="number"
                  value={form.rules.min ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      rules: { ...prev.rules, min: event.target.value === "" ? undefined : Number(event.target.value) },
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label>
                Maximum allowed
                <input
                  type="number"
                  value={form.rules.max ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      rules: { ...prev.rules, max: event.target.value === "" ? undefined : Number(event.target.value) },
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>
            {errors.rules ? <p className="text-xs text-rose-300">{errors.rules}</p> : null}
          </div>
        </SectionCard>

        <SectionCard className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Summary</p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div>
              <p className="text-xs text-slate-500">Enabled meters</p>
              <p>{form.enabledMeters.map((m) => (m === "electricity" ? "Electricity" : "Water")).join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Default units</p>
              <p>Electricity: {form.units.electricity}</p>
              <p>Water: {form.units.water}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Default initial readings</p>
              <p>Electricity: {form.initialReadings.electricity}</p>
              <p>Water: {form.initialReadings.water}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Rules</p>
              <p>Require proof: {form.requireProof ? "Yes" : "No"}</p>
              <p>Allow zero: {form.rules.allowZero ? "Yes" : "No"}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </SettingsShell>
  );
}
