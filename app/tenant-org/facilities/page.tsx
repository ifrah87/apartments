"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import type { FacilitiesTicket } from "@/lib/commercial";

const DEFAULT_FORM = {
  category: "Other" as FacilitiesTicket["category"],
  title: "",
  description: "",
  unitId: "",
};

export default function TenantOrgFacilitiesPage() {
  const [tickets, setTickets] = useState<FacilitiesTicket[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = () => {
    fetch("/api/tenant-org/facilities", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets || []))
      .catch(() => setTickets([]));
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant-org/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          title: form.title,
          description: form.description,
          unitId: form.unitId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to submit ticket.");
      }
      setForm(DEFAULT_FORM);
      loadTickets();
    } catch (err: any) {
      setError(err?.message || "Failed to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Facilities requests</h1>
        <p className="text-sm text-slate-500">Submit maintenance or access requests for your offices.</p>
      </header>

      <SectionCard className="p-4">
        <h2 className="text-lg font-semibold text-slate-900">New request</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as FacilitiesTicket["category"] }))}
          >
            {["HVAC", "Electrical", "Plumbing", "Access", "Other"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Unit (optional)"
            value={form.unitId}
            onChange={(e) => setForm((prev) => ({ ...prev, unitId: e.target.value }))}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
          <textarea
            className="min-h-[120px] rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            placeholder="Describe the issue"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            required
          />
          {error && <p className="text-sm text-rose-600 md:col-span-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2 md:justify-self-start"
          >
            {submitting ? "Sending..." : "Submit request"}
          </button>
        </form>
      </SectionCard>

      <SectionCard className="p-4">
        <h2 className="text-lg font-semibold text-slate-900">Open tickets</h2>
        <div className="mt-3 space-y-3">
          {tickets.length ? (
            tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold text-slate-900">{ticket.title}</p>
                  <span className="text-xs text-slate-500">{ticket.status.replace("_", " ")}</span>
                </div>
                <p className="text-xs text-slate-500">{ticket.category}</p>
                <p className="mt-1 text-sm text-slate-600">{ticket.description}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No tickets yet.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
