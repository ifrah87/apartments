"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";

type UnitRecord = {
  id: string;
  property_id?: string | null;
  unit: string;
  floor?: string | null;
  type?: string | null;
  beds?: string | null;
  rent?: number | null;
  status?: string | null;
};

type TenantRecord = {
  id: string;
  name: string;
  property_id?: string;
  building?: string;
  unit?: string;
  monthly_rent?: string;
};

type PropertyRecord = {
  property_id: string;
  name?: string;
  building?: string;
};

type UnitServiceRecord = {
  id: string;
  unitId: string;
  propertyId?: string;
  serviceId: string;
  startDate: string;
};

type BuildingServiceRecord = {
  id: string;
  propertyId: string;
  serviceId: string;
  startDate: string;
};

type PropertyType = {
  id: string;
  name: string;
  code?: string;
};

type PropertyTypesSettings = {
  types: PropertyType[];
};

type UnitFormState = {
  id?: string;
  unit: string;
  type: string;
  propertyId: string;
};

const EMPTY_FORM: UnitFormState = { unit: "", type: "", propertyId: "" };

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitRecord[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [unitServices, setUnitServices] = useState<UnitServiceRecord[]>([]);
  const [buildingServices, setBuildingServices] = useState<BuildingServiceRecord[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<UnitFormState>(EMPTY_FORM);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unitInputRef = useRef<HTMLInputElement | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    try {
      const [unitsRes, tenantsRes, propertiesRes, unitServicesRes, buildingServicesRes, typesRes] = await Promise.all([
        fetch("/api/units", { cache: "no-store" }),
        fetch("/api/tenants", { cache: "no-store" }),
        fetch("/api/properties", { cache: "no-store" }),
        fetch("/api/unit-services", { cache: "no-store" }),
        fetch("/api/building-services", { cache: "no-store" }),
        fetch("/api/settings/property-types", { cache: "no-store" }),
      ]);

      const unitsPayload = await unitsRes.json().catch(() => null);
      const tenantsPayload = await tenantsRes.json().catch(() => null);
      const propertiesPayload = await propertiesRes.json().catch(() => null);
      const unitServicesPayload = await unitServicesRes.json().catch(() => null);
      const buildingServicesPayload = await buildingServicesRes.json().catch(() => null);
      const typesPayload = await typesRes.json().catch(() => null);

      setUnits(unitsPayload?.ok === false ? [] : (unitsPayload?.ok ? unitsPayload.data : unitsPayload) || []);
      setTenants(
        tenantsPayload?.ok === false ? [] : (tenantsPayload?.ok ? tenantsPayload.data : tenantsPayload) || [],
      );
      setProperties(
        propertiesPayload?.ok === false ? [] : (propertiesPayload?.ok ? propertiesPayload.data : propertiesPayload) || [],
      );
      setUnitServices(
        unitServicesPayload?.ok === false
          ? []
          : (unitServicesPayload?.ok ? unitServicesPayload.data : unitServicesPayload) || [],
      );
      setBuildingServices(
        buildingServicesPayload?.ok === false
          ? []
          : (buildingServicesPayload?.ok ? buildingServicesPayload.data : buildingServicesPayload) || [],
      );
      const typesValue = (typesPayload?.ok ? typesPayload.data : typesPayload) as PropertyTypesSettings | undefined;
      setPropertyTypes(typesValue?.types || []);
    } catch (err) {
      console.error("Failed to load units data", err);
      setUnits([]);
      setTenants([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedPropertyId && properties.length) {
      setSelectedPropertyId(properties[0].property_id);
      setForm((prev) => ({ ...prev, propertyId: properties[0].property_id }));
    }
  }, [properties, selectedPropertyId]);

  const tenantIndex = useMemo(() => {
    const map = new Map<string, TenantRecord>();
    tenants.forEach((tenant) => {
      const property = tenant.property_id || tenant.building || "";
      const unit = tenant.unit || "";
      const key = `${property}::${unit}`.toLowerCase();
      if (property && unit) map.set(key, tenant);
    });
    return map;
  }, [tenants]);

  const unitServiceCounts = useMemo(() => {
    const map = new Map<string, number>();
    unitServices.forEach((entry) => {
      map.set(entry.unitId, (map.get(entry.unitId) || 0) + 1);
    });
    return map;
  }, [unitServices]);

  const buildingServiceCounts = useMemo(() => {
    const map = new Map<string, number>();
    buildingServices.forEach((entry) => {
      map.set(entry.propertyId, (map.get(entry.propertyId) || 0) + 1);
    });
    return map;
  }, [buildingServices]);

  const propertyUnitsCount = useMemo(() => {
    if (!selectedPropertyId) return units.length;
    return units.filter((unit) => unit.property_id === selectedPropertyId).length;
  }, [units, selectedPropertyId]);

  const propertyLabels = useMemo(() => {
    const map = new Map<string, string>();
    properties.forEach((property) => {
      const label = property.name || property.building || property.property_id;
      if (label) map.set(property.property_id, label);
    });
    return map;
  }, [properties]);

  const occupiedCount = useMemo(() => {
    if (!selectedPropertyId) return 0;
    return units.filter((unit) => {
      if (unit.property_id !== selectedPropertyId) return false;
      const key = `${unit.property_id || ""}::${unit.unit}`.toLowerCase();
      return tenantIndex.has(key);
    }).length;
  }, [units, selectedPropertyId, tenantIndex]);

  const grossTarget = useMemo(() => {
    if (!selectedPropertyId) return 0;
    return units
      .filter((unit) => unit.property_id === selectedPropertyId)
      .reduce((sum, unit) => {
        const key = `${unit.property_id || ""}::${unit.unit}`.toLowerCase();
        const tenant = tenantIndex.get(key);
        const rent = tenant?.monthly_rent ?? unit.rent ?? 0;
        return sum + Number(rent || 0);
      }, 0);
  }, [units, selectedPropertyId, tenantIndex]);

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((unit) => {
      if (selectedPropertyId && unit.property_id && unit.property_id !== selectedPropertyId) return false;
      if (!q) return true;
      const property = unit.property_id || "";
      const tenant = tenantIndex.get(`${property}::${unit.unit}`.toLowerCase());
      const haystack = `${unit.unit} ${unit.type || ""} ${tenant?.name || ""} ${property}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [units, selectedPropertyId, search, tenantIndex]);

  const startEdit = (unit: UnitRecord) => {
    setMode("edit");
    setForm({
      id: unit.id,
      unit: unit.unit || "",
      type: unit.type || "",
      propertyId: unit.property_id || selectedPropertyId || "",
    });
    setError(null);
    setShowModal(true);
    requestAnimationFrame(() => unitInputRef.current?.focus());
  };

  const resetForm = () => {
    setMode("create");
    setForm({
      ...EMPTY_FORM,
      propertyId: selectedPropertyId || properties[0]?.property_id || "",
    });
    setError(null);
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
    requestAnimationFrame(() => unitInputRef.current?.focus());
  };

  const closeModal = () => {
    setShowModal(false);
    setError(null);
  };

  const saveUnit = async () => {
    if (!form.unit.trim()) {
      setError("Unit number is required.");
      return;
    }
    const propertyId = form.propertyId || selectedPropertyId || undefined;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: form.id,
        unit: form.unit.trim(),
        type: form.type || undefined,
        property_id: propertyId || undefined,
        status: "Vacant",
      };
      const res =
        mode === "edit"
          ? await fetch("/api/units", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/units", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to save unit.");
      }
      await loadData();
      resetForm();
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save unit.");
    } finally {
      setSaving(false);
    }
  };

  const vacantCount = Math.max(propertyUnitsCount - occupiedCount, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-2 sm:px-3 lg:px-4">
      <PageHeader
        title="Units"
        subtitle="Manage your property inventory"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200"
            >
              <FileText className="h-3.5 w-3.5" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={openModal}
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900"
            >
              Add Apartment
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Units" value={propertyUnitsCount.toString()} tone="accent" />
        <StatCard label="Occupied" value={occupiedCount.toString()} tone="success" />
        <StatCard label="Vacant" value={vacantCount.toString()} tone="danger" />
        <StatCard label="Gross Target" value={formatCurrency(grossTarget)} tone="warning" />
      </div>

      <SectionCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Units</h2>
            <p className="text-xs text-slate-400">{filteredUnits.length} units shown</p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search unit, tenant, or type"
            className="w-full rounded-full border border-white/10 bg-panel-2/60 px-3 py-2 text-xs text-slate-100 sm:w-64"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-2">Unit</th>
                <th className="py-2">Type</th>
                <th className="py-2">Tenant</th>
                <th className="py-2">Rent</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((unit) => {
                const propertyId = unit.property_id || selectedPropertyId || "";
                const tenantKey = `${propertyId}::${unit.unit}`.toLowerCase();
                const tenant = tenantIndex.get(tenantKey);
                const occupied = Boolean(tenant);
                const unitCount = unitServiceCounts.get(unit.id) || 0;
                const buildingCount = propertyId ? buildingServiceCounts.get(propertyId) || 0 : 0;
                const serviceCount = unitCount + buildingCount;
                const propertyLabel = propertyLabels.get(propertyId) || propertyId;
                return (
                  <tr key={unit.id} className="border-t border-white/10">
                    <td className="py-3 text-slate-100">{unit.unit}</td>
                    <td className="py-3 text-slate-300">{unit.type || "—"}</td>
                    <td className="py-3 text-slate-300">
                      {tenant ? (
                        <span className="inline-flex items-center gap-2 text-slate-100">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          {tenant.name}
                        </span>
                      ) : (
                        "No Tenant"
                      )}
                    </td>
                    <td className="py-3 text-slate-100">
                      {tenant?.monthly_rent ? `$${Number(tenant.monthly_rent).toLocaleString()}` : "—"}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            occupied ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"
                          }`}
                        >
                          {occupied ? "Occupied" : "Vacant"}
                        </span>
                        {serviceCount ? (
                          <Link
                            href={`/units/${unit.id}/services`}
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            Services {serviceCount}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(unit)}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/units/${unit.id}/services`}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                        >
                          Services
                        </Link>
                        {!occupied ? (
                          <Link
                            href={`/leases?open=1&property=${encodeURIComponent(
                              propertyLabel,
                            )}&unit=${encodeURIComponent(unit.unit)}`}
                            className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-slate-900"
                          >
                            Lease
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredUnits.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                    No units found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8">
          <SectionCard className="w-full max-w-2xl space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {mode === "edit" ? "Edit Apartment" : "New Apartment"}
                </h2>
                <p className="text-xs text-slate-400">
                  {mode === "edit"
                    ? "Update the unit details below."
                    : "Creating a lease will automatically update the apartment's occupancy status and rent amount."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                Unit Number
                <input
                  value={form.unit}
                  onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                  ref={unitInputRef}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-400">
                Property Type
                <select
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select Type...</option>
                  {propertyTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveUnit}
                disabled={saving}
                className="flex-1 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60"
              >
                {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Save"}
              </button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "success" | "danger" | "warning";
}) {
  const tones: Record<typeof tone, { border: string; text: string }> = {
    accent: { border: "border-accent/50", text: "text-accent" },
    success: { border: "border-emerald-400/40", text: "text-emerald-200" },
    danger: { border: "border-rose-400/40", text: "text-rose-200" },
    warning: { border: "border-amber-400/40", text: "text-amber-200" },
  };
  const style = tones[tone];
  return (
    <div
      className={`min-w-[200px] rounded-2xl border bg-panel/60 px-6 py-3.5 shadow-card-soft ${style.border}`}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${style.text}`}>{value}</p>
    </div>
  );
}
