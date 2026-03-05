"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import type { PropertySummary } from "@/lib/repos/propertiesRepo";

type Props = {
  summaries?: PropertySummary[];
  initialNotice?: string | null;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

export default function PropertiesClient({ summaries: initialSummaries = [], initialNotice = null }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PropertySummary[]>(initialSummaries);
  const [loading, setLoading] = useState(initialSummaries.length === 0);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [saving, setSaving] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    setLoading(true);
    fetch("/api/properties/summaries", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.ok && Array.isArray(payload.data)) {
          setItems(payload.data);
          setNotice(null);
        }
      })
      .catch(() => {
        if (items.length === 0) setNotice("We couldn't load properties right now. Please try again shortly.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((summary) => {
      const name = summary.name.toLowerCase();
      const code = (summary.code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [query, items]);
  const hasSearchQuery = query.trim().length > 0;

  const generateCode = (name: string) =>
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const handleCreate = async () => {
    setError(null);
    setNotice(null);
    const name = form.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    const code = form.code.trim() || generateCode(name);
    setSaving(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to create property.");
      }
      const created = payload?.ok ? payload.data : payload;
      setItems((prev) => [
        {
          id: String(created.id),
          name: created.name || name,
          code: created.code ?? code,
          status: created.status === "archived" ? "archived" : "active",
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          monthlyRent: 0,
        },
        ...prev,
      ]);
      setForm({ name: "", code: "" });
      setShowModal(false);
      setNotice("Property created.");
    } catch (err: any) {
      setError(err?.message || "Failed to create property.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (summary: PropertySummary) => {
    const message = `Delete ${summary.name}? This will remove all units and related leases/payments.`;
    const confirmed = await confirm({
      title: "Delete Property",
      message,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    setError(null);
    setNotice(null);
    startDelete(async () => {
      try {
        const res = await fetch(`/api/properties/${summary.id}?force=1`, {
          method: "DELETE",
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Failed to delete property.");
        }
        setItems((prev) => prev.filter((item) => item.id !== summary.id));
        setNotice("Property deleted.");
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Failed to delete property.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle="Overview, units, and tenants per building."
        actions={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 sm:w-auto"
          >
            Add Property
          </button>
        }
      />

      {error ? (
        <SectionCard className="border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </SectionCard>
      ) : null}

      {notice ? (
        <SectionCard className="border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </SectionCard>
      ) : null}

      <SectionCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 w-full flex-1 items-center gap-3 rounded-xl border border-white/10 bg-panel/60 px-4 py-3 text-sm text-slate-400 sm:min-w-[240px]">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search property name or code"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <p className="w-full text-xs text-slate-400 sm:w-auto">
            {loading ? "Loading..." : `${items.length} properties loaded`}
          </p>
        </div>
      </SectionCard>

      <div className="space-y-4">
        {filtered.map((summary) => (
          <SectionCard key={summary.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{summary.name}</h2>
                <p className="text-xs text-slate-400">
                  {summary.totalUnits} units • {summary.occupiedUnits} occupied • {summary.vacantUnits} vacant
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <Link
                  href={`/properties/${summary.id}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Overview
                </Link>
                <Link
                  href={`/units?propertyId=${encodeURIComponent(summary.id)}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Units
                </Link>
                <Link
                  href={`/tenants?propertyId=${encodeURIComponent(summary.id)}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Tenants
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(summary)}
                  className="rounded-full border border-rose-400/40 px-3 py-1 text-xs font-semibold text-rose-200 hover:border-rose-400/70"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-panel/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Total Units</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{summary.totalUnits}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-panel/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Occupied</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{summary.occupiedUnits}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-panel/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Vacant</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{summary.vacantUnits}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-panel/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Monthly Rent</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{formatMoney(summary.monthlyRent)}</p>
              </div>
            </div>
          </SectionCard>
        ))}

        {!filtered.length && (
          <SectionCard className="p-6 text-center text-sm text-slate-400">
            {hasSearchQuery ? "No properties match your search." : "No properties available right now."}
          </SectionCard>
        )}
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Add Property</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:border-white/20"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Name (required)"
                className="w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
              />
              <input
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="Code (optional)"
                className="w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
