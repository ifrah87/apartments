"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_FORM = {
  name: "",
  billingPhone: "",
  financeContactName: "",
  facilitiesContactName: "",
  facilitiesContactEmail: "",
  propertyId: "",
  unitIds: "",
  leaseStart: "",
  leaseEnd: "",
  rentAmount: "",
  serviceChargeAmount: "",
  dueDay: "1",
  graceDays: "5",
  currency: "USD",
};

export default function TenantsOnboardingNewPage() {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof typeof DEFAULT_FORM) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tenant-orgs/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          billingPhone: form.billingPhone || undefined,
          financeContactName: form.financeContactName || undefined,
          facilitiesContactName: form.facilitiesContactName || undefined,
          facilitiesContactEmail: form.facilitiesContactEmail || undefined,
          propertyId: form.propertyId,
          unitIds: form.unitIds
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          leaseStart: form.leaseStart,
          leaseEnd: form.leaseEnd,
          rentAmount: Number(form.rentAmount || 0),
          serviceChargeAmount: Number(form.serviceChargeAmount || 0) || undefined,
          dueDay: Number(form.dueDay || 1),
          graceDays: Number(form.graceDays || 0),
          currency: form.currency || "USD",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to start onboarding.");
      }
      router.push(`/tenants/onboarding/${data.orgId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to start onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Start onboarding</h1>
        <p className="text-sm text-slate-500">Capture the lease details before kicking off the checklist.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Company & Lease</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Company name"
              value={form.name}
              onChange={update("name")}
              required
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Billing phone (optional)"
              value={form.billingPhone}
              onChange={update("billingPhone")}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Finance contact name"
              value={form.financeContactName}
              onChange={update("financeContactName")}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Facilities contact name"
              value={form.facilitiesContactName}
              onChange={update("facilitiesContactName")}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Facilities contact email"
              type="email"
              value={form.facilitiesContactEmail}
              onChange={update("facilitiesContactEmail")}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Property ID"
              value={form.propertyId}
              onChange={update("propertyId")}
              required
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Unit IDs (comma separated)"
              value={form.unitIds}
              onChange={update("unitIds")}
              required
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="date"
              value={form.leaseStart}
              onChange={update("leaseStart")}
              required
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="date"
              value={form.leaseEnd}
              onChange={update("leaseEnd")}
              required
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Rent amount"
              type="number"
              min="0"
              value={form.rentAmount}
              onChange={update("rentAmount")}
              required
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Service charge amount"
              type="number"
              min="0"
              value={form.serviceChargeAmount}
              onChange={update("serviceChargeAmount")}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Due day"
              type="number"
              min="1"
              max="28"
              value={form.dueDay}
              onChange={update("dueDay")}
              required
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Grace days"
              type="number"
              min="0"
              value={form.graceDays}
              onChange={update("graceDays")}
              required
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Currency"
              value={form.currency}
              onChange={update("currency")}
              required
            />
          </div>
        </section>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Starting..." : "Create onboarding"}
        </button>
      </form>
    </div>
  );
}
