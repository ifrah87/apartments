"use client";

import { useEffect, useMemo, useState } from "react";
import SettingsShell from "@/components/settings/SettingsShell";
import SectionCard from "@/components/ui/SectionCard";
import { fetchSettings, saveSettings } from "@/lib/settings/client";
import { DEFAULT_LEASE_TEMPLATE } from "@/lib/settings/defaults";
import type { LeaseTemplateSettings } from "@/lib/settings/types";

const PLACEHOLDERS = [
  "{{property}}",
  "{{tenantName}}",
  "{{tenantPhone}}",
  "{{unit}}",
  "{{status}}",
  "{{rent}}",
  "{{deposit}}",
  "{{cycle}}",
  "{{startDate}}",
  "{{endDate}}",
  "{{leaseDuration}}",
  "{{today}}",
];

export default function LeaseTemplateSettingsPage() {
  const [form, setForm] = useState<LeaseTemplateSettings>(DEFAULT_LEASE_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSettings<LeaseTemplateSettings>("lease-template", DEFAULT_LEASE_TEMPLATE).then((data) => setForm(data));
  }, []);

  const previewDoc = useMemo(() => {
    if (form.mode !== "html") return "";
    return form.htmlTemplate;
  }, [form]);

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (form.mode === "html" && !form.htmlTemplate.trim()) {
      nextErrors.htmlTemplate = "HTML template is required.";
    }
    if (form.mode === "pdf" && !form.pdfDataUrl.trim()) {
      nextErrors.pdfDataUrl = "Please upload a PDF template.";
    }
    if (form.mode === "url" && !form.externalUrl.trim()) {
      nextErrors.externalUrl = "External URL is required.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToast({ type: "error", message: "Please fix the highlighted fields." });
      return;
    }
    setSaving(true);
    const response = await saveSettings("lease-template", form);
    setSaving(false);
    if (!response.ok) {
      setErrors(response.fields || {});
      setToast({ type: "error", message: response.error || "Failed to save lease template." });
      return;
    }
    setToast({ type: "success", message: "Lease template saved." });
  };

  const handleReset = () => {
    setForm(DEFAULT_LEASE_TEMPLATE);
    setErrors({});
    setToast({ type: "success", message: "Reset to defaults." });
  };

  const handleFileUpload = (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isHtml =
      file.type === "text/html" || file.name.toLowerCase().endsWith(".html") || file.name.toLowerCase().endsWith(".htm");

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => ({
          ...prev,
          mode: "pdf",
          pdfDataUrl: String(reader.result || ""),
        }));
      };
      reader.readAsDataURL(file);
      return;
    }

    if (isHtml) {
      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => ({
          ...prev,
          mode: "html",
          htmlTemplate: String(reader.result || ""),
        }));
      };
      reader.readAsText(file);
      return;
    }

    setToast({ type: "error", message: "Upload a PDF or HTML file." });
  };

  return (
    <SettingsShell
      title="Lease Template"
      description="Upload or edit the lease agreement template used in the Leases page."
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
      toast={toast}
      onDismissToast={() => setToast(null)}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard className="space-y-5 p-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Template Source</p>
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              {[
                { label: "HTML Template", value: "html" as const },
                { label: "PDF Upload", value: "pdf" as const },
                { label: "External URL", value: "url" as const },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, mode: option.value }))}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                    form.mode === option.value
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-white/10 bg-panel/60 text-slate-300 hover:border-white/20"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="text-sm text-slate-300">
            Upload PDF or HTML file
            <input
              type="file"
              accept=".pdf,.html,.htm,application/pdf,text/html"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1 file:text-sm file:font-semibold file:text-slate-900"
            />
            {errors.pdfDataUrl ? <p className="mt-1 text-xs text-rose-300">{errors.pdfDataUrl}</p> : null}
          </label>

          <label className="text-sm text-slate-300">
            External URL
            <input
              value={form.externalUrl}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, externalUrl: event.target.value, mode: "url" }))
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
              placeholder="https://..."
            />
            {errors.externalUrl ? <p className="mt-1 text-xs text-rose-300">{errors.externalUrl}</p> : null}
          </label>

          <label className="text-sm text-slate-300">
            HTML Template
            <textarea
              rows={12}
              value={form.htmlTemplate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, htmlTemplate: event.target.value, mode: "html" }))
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-xs text-slate-100"
            />
            {errors.htmlTemplate ? <p className="mt-1 text-xs text-rose-300">{errors.htmlTemplate}</p> : null}
          </label>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Available Placeholders</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PLACEHOLDERS.map((token) => (
                <span
                  key={token}
                  className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-300"
                >
                  {token}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview</p>
            {form.mode === "html" ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white">
                <iframe title="Lease template preview" srcDoc={previewDoc} className="h-64 w-full" />
              </div>
            ) : null}
            {form.mode === "pdf" ? (
              form.pdfDataUrl ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white">
                  <iframe title="PDF template preview" src={form.pdfDataUrl} className="h-64 w-full" />
                </div>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                  Upload a PDF to preview it here.
                </div>
              )
            ) : null}
            {form.mode === "url" ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                {form.externalUrl ? form.externalUrl : "Provide a URL to preview externally."}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </SettingsShell>
  );
}
