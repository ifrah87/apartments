"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

type TenantRecord = {
  id: string;
  name: string;
  building?: string;
  property_id?: string;
  unit?: string;
  monthly_rent?: string;
  due_day?: string;
  reference?: string;
};

export default function TenantPortalPage() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);

  useEffect(() => {
    fetch(`/api/tenants?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        const data = payload?.ok === false ? [] : payload?.ok ? payload.data : payload;
        setTenants(data || []);
        if (data?.length) {
          setSelectedTenant(data[0]);
        }
      })
      .catch(() => setTenants([]));
  }, []);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((tenant) => {
      return (
        tenant.name?.toLowerCase().includes(q) ||
        tenant.unit?.toLowerCase().includes(q) ||
        tenant.property_id?.toLowerCase().includes(q)
      );
    });
  }, [tenants, search]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">Tenants</p>
        <h1 className="text-3xl font-semibold text-slate-900">Tenant Directory</h1>
        <p className="text-sm text-slate-500">Search and review tenant profiles for each unit.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-slate-500">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenant or unit"
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none"
            />
            <span className="text-xs text-slate-400">{filteredTenants.length}/{tenants.length}</span>
          </div>
          <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {filteredTenants.map((tenant) => {
              const active = tenant.id === selectedTenant?.id;
              return (
                <button
                  key={tenant.id}
                  onClick={() => setSelectedTenant(tenant)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50 ${
                    active ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="font-semibold text-slate-900">{tenant.name}</p>
                  <p className="text-xs text-slate-500">
                    {(tenant.building || tenant.property_id || "").toUpperCase()} · Unit {tenant.unit || "—"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(Number(tenant.monthly_rent || 0))} / mo
                  </p>
                </button>
              );
            })}
            {!filteredTenants.length && (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No tenants match that search.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-6">
          {selectedTenant ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Selected tenant</p>
                    <h2 className="text-2xl font-semibold text-slate-900">{selectedTenant.name}</h2>
                    <p className="text-sm text-slate-500">
                      {selectedTenant.building || selectedTenant.property_id} · Unit {selectedTenant.unit || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Monthly rent</p>
                    <p className="text-2xl font-semibold text-slate-900">
                      {formatCurrency(Number(selectedTenant.monthly_rent || 0))}
                    </p>
                    <p className="text-xs text-slate-500">Due day {selectedTenant.due_day || "1"}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference</p>
                    <p className="mt-2 text-sm text-slate-900">{selectedTenant.reference || "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property</p>
                    <p className="mt-2 text-sm text-slate-900">
                      {selectedTenant.building || selectedTenant.property_id || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              Select a tenant from the list to load the portal view.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}
