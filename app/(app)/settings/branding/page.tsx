"use client";

import { useEffect, useState } from "react";
import SettingsShell from "@/components/settings/SettingsShell";
import SectionCard from "@/components/ui/SectionCard";
import { DEFAULT_BRANDING } from "@/lib/settings/defaults";
import type { BrandingSettings } from "@/lib/settings/types";
import { fetchSettings, saveSettings } from "@/lib/settings/client";

export default function BrandingSettingsPage() {
  const [form, setForm] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSettings<BrandingSettings>("branding", DEFAULT_BRANDING).then((data) => setForm(data));
  }, []);

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.appName.trim()) nextErrors.appName = "App name is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToast({ type: "error", message: "Please fix the highlighted fields." });
      return;
    }
    setSaving(true);
    const response = await saveSettings("branding", form);
    setSaving(false);
    if (!response.ok) {
      setErrors(response.fields || {});
      setToast({ type: "error", message: response.error || "Failed to save branding." });
      return;
    }
    setToast({ type: "success", message: "Branding saved." });
  };

  const handleReset = () => {
    setForm(DEFAULT_BRANDING);
    setErrors({});
    setToast({ type: "success", message: "Reset to defaults." });
  };

  return (
    <SettingsShell
      title="Logo & Branding"
      description="Update your logo, app name, and sidebar branding mode."
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300 sm:col-span-2">
              Logo path
              <input
                value={form.logoPath}
                onChange={(event) => setForm((prev) => ({ ...prev, logoPath: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">Use a file from /public/logos.</p>
            </label>

            <label className="text-sm text-slate-300 sm:col-span-2">
              Upload logo
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setForm((prev) => ({ ...prev, logoPath: `/logos/${file.name}` }));
                  }
                }}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1 file:text-sm file:font-semibold file:text-slate-900"
              />
            </label>

            <label className="text-sm text-slate-300 sm:col-span-2">
              App name *
              <input
                value={form.appName}
                onChange={(event) => setForm((prev) => ({ ...prev, appName: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
              {errors.appName ? <p className="mt-1 text-xs text-rose-300">{errors.appName}</p> : null}
            </label>

            <label className="text-sm text-slate-300 sm:col-span-2">
              Tagline
              <input
                value={form.tagline}
                onChange={(event) => setForm((prev) => ({ ...prev, tagline: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Primary accent
              <input
                value="Cyan"
                disabled
                className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-400"
              />
            </label>

            <div className="text-sm text-slate-300">
              Sidebar brand mode
              <div className="mt-2 space-y-2">
                {[
                  { label: "Icon only", value: "icon_only" as const },
                  { label: "Icon + text", value: "icon_text" as const },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-200"
                  >
                    <input
                      type="radio"
                      name="brandMode"
                      checked={form.brandMode === option.value}
                      onChange={() => setForm((prev) => ({ ...prev, brandMode: option.value }))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <img src={form.logoPath} alt="Logo preview" className="mx-auto h-10 w-10 object-contain" />
              <p className="mt-3 text-sm font-semibold text-slate-100">{form.appName}</p>
              <p className="text-xs text-slate-400">{form.tagline}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-100/10 p-4 text-center">
              <img src={form.logoPath} alt="Logo preview" className="mx-auto h-10 w-10 object-contain" />
              <p className="mt-3 text-sm font-semibold text-slate-100">{form.appName}</p>
              <p className="text-xs text-slate-400">{form.tagline}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </SettingsShell>
  );
}
