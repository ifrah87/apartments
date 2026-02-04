"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import type { TenantOrg } from "@/lib/commercial";

export default function TenantOrgProfilePage() {
  const [org, setOrg] = useState<TenantOrg | null>(null);
  const [form, setForm] = useState({
    billingPhone: "",
    financeContactName: "",
    facilitiesContactEmail: "",
    facilitiesContactName: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant-org/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.org) return;
        setOrg(data.org);
        setForm({
          billingPhone: data.org.billingPhone || "",
          financeContactName: data.org.financeContactName || "",
          facilitiesContactEmail: data.org.facilitiesContactEmail || "",
          facilitiesContactName: data.org.facilitiesContactName || "",
        });
      })
      .catch(() => setOrg(null));
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tenant-org/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save profile.");
      }
      setMessage("Profile updated.");
    } catch (err: any) {
      setMessage(err?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Company profile</h1>
        <p className="text-sm text-slate-500">Review your company and contact details.</p>
      </header>

      <SectionCard className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Company</p>
            <p className="text-sm font-semibold text-slate-900">{org?.name || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Billing email</p>
            <p className="text-sm font-semibold text-slate-900">{org?.billingEmail || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Property</p>
            <p className="text-sm font-semibold text-slate-900">{org?.propertyId || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Units</p>
            <p className="text-sm font-semibold text-slate-900">{org?.unitIds?.join(", ") || "-"}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <h2 className="text-lg font-semibold text-slate-900">Contacts</h2>
        <form onSubmit={handleSave} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Billing phone"
            value={form.billingPhone}
            onChange={(e) => setForm((prev) => ({ ...prev, billingPhone: e.target.value }))}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Finance contact name"
            value={form.financeContactName}
            onChange={(e) => setForm((prev) => ({ ...prev, financeContactName: e.target.value }))}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Facilities contact name"
            value={form.facilitiesContactName}
            onChange={(e) => setForm((prev) => ({ ...prev, facilitiesContactName: e.target.value }))}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Facilities contact email"
            type="email"
            value={form.facilitiesContactEmail}
            onChange={(e) => setForm((prev) => ({ ...prev, facilitiesContactEmail: e.target.value }))}
          />
          {message && <p className="text-sm text-slate-600 sm:col-span-2">{message}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
