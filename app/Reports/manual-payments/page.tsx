"use client";

import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { useEffect, useState } from "react";

type Tenant = { id: string; name: string; unit?: string };
type ManualPayment = { id: string; tenant_id: string; amount: number; date: string; description?: string };

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ManualPaymentsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [tRes, pRes] = await Promise.all([
      fetch("/api/tenants", { cache: "no-store" }),
      fetch("/api/manual-payments", { cache: "no-store" }),
    ]);
    const tData = await tRes.json().catch(() => null);
    const pData = await pRes.json().catch(() => null);
    setTenants((tData?.ok ? tData.data : tData) ?? []);
    setPayments((pData?.ok ? pData.data : pData) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!tenantId || !amount || !date) {
      setError("Tenant, amount, and date are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/manual-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, amount: Number(amount), date, description }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to save payment.");
      return;
    }
    setAmount("");
    setDescription("");
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment?")) return;
    await fetch(`/api/manual-payments?id=${id}`, { method: "DELETE" });
    await load();
  }

  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">Reports</Link> / Manual Payments
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Manual Payments</h1>
        <p className="text-sm text-slate-500">Record a payment received outside of bank imports.</p>
      </header>

      <SectionCard className="p-4">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-5">
          <label className="md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant</span>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.unit ? ` · ${t.unit}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount ($)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Cash payment"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="md:col-span-5 text-sm text-red-600">{error}</p>}
          <div className="md:col-span-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Recorded Payments ({payments.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const tenant = tenantMap[p.tenant_id];
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-600">{formatDate(p.date)}</td>
                    <td className="px-4 py-2 text-slate-900">
                      {tenant ? `${tenant.name}${tenant.unit ? ` · ${tenant.unit}` : ""}` : p.tenant_id}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{p.description || "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-600">
                      {currency.format(p.amount)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!payments.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No manual payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
