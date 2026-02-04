"use client";

import { useState } from "react";

type ManualPayment = {
  id: string;
  tenant_id: string;
  amount: number;
  date: string;
  description?: string;
};

type FormState = {
  tenant_id: string;
  amount: string;
  date: string;
  description: string;
};

const defaultForm = (): FormState => ({
  tenant_id: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  description: "",
});

export default function ManualPaymentsManager({ initialPayments }: { initialPayments: ManualPayment[] }) {
  const [payments, setPayments] = useState(initialPayments);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: form.tenant_id,
          amount: Number(form.amount),
          date: form.date,
          description: form.description,
        }),
      });
      if (!res.ok) throw new Error("Failed to save payment");
      const payload = await res.json();
      if (payload?.ok === false) throw new Error(payload.error || "Failed to save payment");
      const entry: ManualPayment = payload?.ok ? payload.data : payload;
      setPayments((prev) => [entry, ...prev]);
      setForm(defaultForm());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Remove this manual payment?");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/manual-payments?id=${id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) throw new Error(payload?.error || "Failed to delete payment");
      setPayments((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Tenant ID / Reference</label>
          <input
            required
            value={form.tenant_id}
            onChange={(event) => setForm((prev) => ({ ...prev, tenant_id: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g. 12 or T1-105"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Amount</label>
          <input
            type="number"
            step="0.01"
            required
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="1000"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Date</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">Description</label>
          <input
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Manual adjustment"
          />
        </div>
        <div className="md:col-span-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add Payment"}
          </button>
          {error && <span className="ml-3 text-sm text-rose-600">{error}</span>}
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-600">{formatDate(payment.date)}</td>
                <td className="px-4 py-2 font-medium text-slate-900">{payment.tenant_id}</td>
                <td className="px-4 py-2 text-slate-600">{payment.description || "Manual payment"}</td>
                <td className="px-4 py-2 text-right font-semibold text-emerald-600">${payment.amount.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(payment.id)}
                    className="text-sm font-medium text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!payments.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No manual payments recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}
