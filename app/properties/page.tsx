"use client";

import { useEffect, useMemo, useState } from "react";

type Property = {
  property_id: string;
  name?: string;
  total_units?: number;
};

type Tenant = {
  id: string;
  name: string;
  property_id: string;
  unit: string;
  monthly_rent?: string;
  due_day?: string;
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/properties?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setProperties(data || []))
      .catch(() => setProperties([]));
  }, []);

  useEffect(() => {
    fetch(`/api/tenants?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTenants(data || []))
      .catch(() => setTenants([]));
  }, []);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((tenant) => {
      const name = tenant.name?.toLowerCase() || "";
      const unit = tenant.unit?.toLowerCase() || "";
      const propertyId = tenant.property_id?.toLowerCase() || "";
      return name.includes(q) || unit.includes(q) || propertyId.includes(q);
    });
  }, [tenants, search]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900">Properties</h1>
        <p className="text-sm text-slate-500">
          Overview, units, and tenants per building pulled straight from the CSV data.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search building, unit, or tenant"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 sm:w-72"
        />
        <span className="text-xs text-slate-400">{tenants.length} tenants loaded</span>
      </div>

      <div className="grid gap-4">
        {properties.map((property) => {
          const tenantsForProperty = filteredTenants.filter(
            (tenant) => tenant.property_id === property.property_id
          );
          return (
            <PropertyPanel
              key={property.property_id}
              property={property}
              tenants={tenantsForProperty}
            />
          );
        })}
      </div>
    </div>
  );
}

function PropertyPanel({
  property,
  tenants,
}: {
  property: Property;
  tenants: Tenant[];
}) {
  const [tab, setTab] = useState<"overview" | "units" | "tenants">("overview");
  const [unitsOpen, setUnitsOpen] = useState(true);
  const [tenantsOpen, setTenantsOpen] = useState(true);
  const totalUnits = property.total_units ?? tenants.length;
  const occupied = tenants.length;
  const vacant = Math.max(totalUnits - occupied, 0);
  const rent = tenants.reduce((sum, tenant) => sum + Number(tenant.monthly_rent || 0), 0);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {property.name || `Building ${property.property_id}`}
          </h2>
          <p className="text-sm text-slate-500">
            {totalUnits} units · {occupied} occupied · {vacant} vacant
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {(["overview", "units", "tenants"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full border px-3 py-1 font-medium transition ${
                tab === key
                  ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                  : "border-slate-200 text-slate-500"
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 px-5 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Units" value={totalUnits}>
            <span className="text-xs text-slate-500">From properties CSV</span>
          </SummaryCard>
          <SummaryCard label="Occupied" value={occupied}>
            <span className="text-xs text-green-600">{vacant} vacant</span>
          </SummaryCard>
          <SummaryCard label="Vacant" value={vacant || "0"}>
            <span className="text-xs text-slate-500">Auto-calculated</span>
          </SummaryCard>
          <SummaryCard label="Monthly Rent" value={`$${rent.toLocaleString()}`}>
            <span className="text-xs text-slate-500">Sum of tenant rent</span>
          </SummaryCard>
        </div>
      )}

      {tab === "units" && (
        <div className="px-5 py-6 space-y-3">
          <button
            onClick={() => setUnitsOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <span>Units list</span>
            <span>{unitsOpen ? "–" : "+"}</span>
          </button>
          {unitsOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Unit</th>
                    <th className="py-2">Tenant</th>
                    <th className="py-2">Rent</th>
                    <th className="py-2">Due Day</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr
                      key={`${tenant.property_id}-${tenant.unit}`}
                      className="border-t border-slate-100"
                    >
                      <td className="py-2 font-medium text-slate-900">{tenant.unit}</td>
                      <td className="py-2 text-slate-700">{tenant.name}</td>
                      <td className="py-2 text-slate-900">
                        ${Number(tenant.monthly_rent || 0).toLocaleString()}
                      </td>
                      <td className="py-2 text-slate-500">{tenant.due_day || "—"}</td>
                      <td className="py-2">
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          Occupied
                        </span>
                      </td>
                    </tr>
                  ))}
                  {vacant > 0 && (
                    <tr className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-900">—</td>
                      <td className="py-2 text-slate-500">Vacant units</td>
                      <td className="py-2 text-slate-500">—</td>
                      <td className="py-2 text-slate-500">—</td>
                      <td className="py-2">
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          {vacant} Vacant
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "tenants" && (
        <div className="px-5 py-6 space-y-3">
          <button
            onClick={() => setTenantsOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <span>Tenant list</span>
            <span>{tenantsOpen ? "–" : "+"}</span>
          </button>
          {tenantsOpen && (
            <div className="space-y-3">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                  <p className="text-xs text-slate-500">
                    Unit {tenant.unit} · Rent ${tenant.monthly_rent || "—"}
                  </p>
                </div>
              ))}
              {!tenants.length && (
                <p className="text-sm text-slate-500">
                  No tenants listed in CSV for this property.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string | number;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
