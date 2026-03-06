"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import ExportButton from "@/components/ExportButton";
import { resolveCurrentPropertyId, setCurrentPropertyId } from "@/lib/currentProperty";
import type { TenantRecord } from "@/src/lib/repos/tenantsRepo";

type UnitRecord = {
  id: string;
  property_id: string | null;
  unit: string;
  floor?: string | null;
  type?: string | null;
  beds?: string | null;
  rent?: number | null;
  status?: string | null;
};

type LeaseAgreement = {
  id: string;
  property?: string;
  unit: string;
  tenantName: string;
  status?: string;
  rent?: number;
};

type PropertyRecord = {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
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

export default function UnitsClient() {
  const confirm = useConfirm();
  const [units, setUnits] = useState<UnitRecord[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [leases, setLeases] = useState<LeaseAgreement[]>([]);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [unitServices, setUnitServices] = useState<UnitServiceRecord[]>([]);
  const [buildingServices, setBuildingServices] = useState<BuildingServiceRecord[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<UnitFormState>(EMPTY_FORM);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unitInputRef = useRef<HTMLInputElement | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadProperties = async () => {
    try {
      const res = await fetch("/api/properties?includeArchived=1", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      const data = (payload?.ok ? payload.data : payload) as PropertyRecord[];
      if (Array.isArray(data)) {
        setProperties(data);
        const resolved = resolveCurrentPropertyId(data);
        if (resolved) {
          setSelectedPropertyId(resolved);
          setForm((prev) => ({ ...prev, propertyId: resolved }));
        }
      } else {
        setProperties([]);
      }
    } catch (err) {
      console.error("Failed to load properties", err);
      setProperties([]);
    }
  };

  const loadData = async (propertyId?: string) => {
    try {
      const unitsUrl = propertyId ? `/api/units?propertyId=${encodeURIComponent(propertyId)}` : "/api/units";
      const [
        unitsRes,
        tenantsRes,
        leasesRes,
        unitServicesRes,
        buildingServicesRes,
        typesRes,
      ] = await Promise.all([
        fetch(unitsUrl, { cache: "no-store" }),
        fetch("/api/tenants", { cache: "no-store" }),
        fetch("/api/lease-agreements", { cache: "no-store" }),
        fetch("/api/unit-services", { cache: "no-store" }),
        fetch("/api/building-services", { cache: "no-store" }),
        fetch("/api/settings/property-types", { cache: "no-store" }),
      ]);

      const unitsPayload = await unitsRes.json().catch(() => null);
      const tenantsPayload = await tenantsRes.json().catch(() => null);
      const leasesPayload = await leasesRes.json().catch(() => null);
      const unitServicesPayload = await unitServicesRes.json().catch(() => null);
      const buildingServicesPayload = await buildingServicesRes.json().catch(() => null);
      const typesPayload = await typesRes.json().catch(() => null);

      setUnits(unitsPayload?.ok === false ? [] : (unitsPayload?.ok ? unitsPayload.data : unitsPayload) || []);
      setTenants(
        tenantsPayload?.ok === false ? [] : (tenantsPayload?.ok ? tenantsPayload.data : tenantsPayload) || [],
      );
      setLeases(leasesPayload?.ok === false ? [] : (leasesPayload?.ok ? leasesPayload.data : leasesPayload) || []);
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
      setLeases([]);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    loadData(selectedPropertyId || undefined);
  }, [selectedPropertyId]);

  useEffect(() => {
    const paramId = new URLSearchParams(window.location.search).get("propertyId");
    if (!paramId) return;
    setCurrentPropertyId(paramId);
    setSelectedPropertyId(paramId);
    setForm((prev) => ({ ...prev, propertyId: paramId }));
  }, []);

  const tenantIndex = useMemo(() => {
    const map = new Map<string, TenantRecord>();
    tenants.forEach((tenant) => {
      const property = tenant.property_id || tenant.building || "";
      const unit = tenant.unit || "";
      if (property && unit) {
        const key = `${property}::${unit}`.toLowerCase();
        map.set(key, tenant);
      }
      if (unit) {
        const fallbackKey = `::${unit}`.toLowerCase();
        if (!map.has(fallbackKey)) map.set(fallbackKey, tenant);
      }
    });
    return map;
  }, [tenants]);

  const activeLeaseIndex = useMemo(() => {
    const map = new Map<string, LeaseAgreement>();
    leases
      .filter((lease) => (lease.status || "Active").toLowerCase() === "active")
      .forEach((lease) => {
        const unit = (lease.unit || "").trim();
        if (!unit) return;
        const unitKey = unit.toLowerCase();
        const property = (lease.property || "").trim();
        if (property) {
          map.set(`${property.toLowerCase()}::${unitKey}`, lease);
        }
        map.set(`::${unitKey}`, lease);
      });
    return map;
  }, [leases]);

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

  const scopedUnits = useMemo(
    () => (selectedPropertyId ? units.filter((unit) => unit.property_id === selectedPropertyId) : units),
    [units, selectedPropertyId],
  );

  const propertyUnitsCount = scopedUnits.length;

  const propertyLabels = useMemo(() => {
    const map = new Map<string, string>();
    properties.forEach((property) => {
      const label = property.name || property.code || property.id;
      if (label) map.set(property.id, label);
    });
    return map;
  }, [properties]);

  const findActiveLease = (unit: UnitRecord) => {
    const unitKey = (unit.unit || "").toLowerCase();
    if (!unitKey) return null;
    const propertyId = unit.property_id || "";
    const propertyLabel = propertyLabels.get(propertyId) || "";
    const keys = [];
    if (propertyId) keys.push(`${propertyId.toLowerCase()}::${unitKey}`);
    if (propertyLabel) keys.push(`${propertyLabel.toLowerCase()}::${unitKey}`);
    keys.push(`::${unitKey}`);
    for (const key of keys) {
      const lease = activeLeaseIndex.get(key);
      if (lease) return lease;
    }
    return null;
  };

  const hasLeaseData = leases.length > 0;

  const occupiedCount = useMemo(() => {
    return scopedUnits.filter((unit) => {
      if (hasLeaseData) return Boolean(findActiveLease(unit));
      const propertyKey = (unit.property_id || "").toLowerCase();
      const label = propertyLabels.get(unit.property_id || "")?.toLowerCase();
      const key = `${propertyKey}::${unit.unit}`.toLowerCase();
      const labelKey = label ? `${label}::${unit.unit}`.toLowerCase() : null;
      return (
        tenantIndex.has(key) ||
        (labelKey ? tenantIndex.has(labelKey) : false) ||
        tenantIndex.has(`::${unit.unit}`.toLowerCase())
      );
    }).length;
  }, [scopedUnits, tenantIndex, hasLeaseData, activeLeaseIndex, propertyLabels]);

  const grossTarget = useMemo(() => {
    return scopedUnits.reduce((sum, unit) => {
      if (hasLeaseData) {
        const lease = findActiveLease(unit);
        const leaseRent = Number(lease?.rent ?? 0);
        const rent = leaseRent > 0 ? leaseRent : Number(unit.rent ?? 0);
        return sum + Number(rent || 0);
      }
      const propertyKey = (unit.property_id || "").toLowerCase();
      const label = propertyLabels.get(unit.property_id || "")?.toLowerCase();
      const key = `${propertyKey}::${unit.unit}`.toLowerCase();
      const labelKey = label ? `${label}::${unit.unit}`.toLowerCase() : null;
      const tenant =
        tenantIndex.get(key) ||
        (labelKey ? tenantIndex.get(labelKey) : undefined) ||
        tenantIndex.get(`::${unit.unit}`.toLowerCase());
      const tenantRent = Number(tenant?.monthly_rent ?? 0);
      const rent = tenantRent > 0 ? tenantRent : Number(unit.rent ?? 0);
      return sum + Number(rent || 0);
    }, 0);
  }, [scopedUnits, tenantIndex, hasLeaseData, activeLeaseIndex, propertyLabels]);

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((unit) => {
      if (selectedPropertyId && unit.property_id && unit.property_id !== selectedPropertyId) return false;
      if (!q) return true;
      const property = unit.property_id || "";
      const propertyLabel = propertyLabels.get(property) || "";
      const key = `${property}::${unit.unit}`.toLowerCase();
      const labelKey = propertyLabel ? `${propertyLabel}::${unit.unit}`.toLowerCase() : "";
      const tenant = tenantIndex.get(key) || (labelKey ? tenantIndex.get(labelKey) : undefined);
      const haystack = `${unit.unit} ${unit.type || ""} ${tenant?.name || ""} ${property} ${propertyLabel}`.toLowerCase();
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
      propertyId: selectedPropertyId || properties[0]?.id || "",
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
    if (!propertyId) {
      setError("Select a property before adding a unit.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: form.id,
        unit: form.unit.trim(),
        type: form.type || undefined,
        property_id: propertyId || undefined,
        status: "vacant",
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

  const deleteUnit = async (unit: UnitRecord, occupied: boolean) => {
    const confirmed = await confirm(
      occupied
        ? {
            title: "Force Delete Unit",
            message:
              `Unit ${unit.unit} has an active lease or tenant. Delete anyway? This will remove related tenants, leases, deposits, and charges.`,
            confirmLabel: "Delete",
            tone: "danger",
          }
        : {
            title: "Delete Unit",
            message: `Delete unit ${unit.unit}?`,
            confirmLabel: "Delete",
            tone: "danger",
          },
    );
    if (!confirmed) return;
    setDeletingId(unit.id);
    setError(null);
    try {
      const res = await fetch("/api/units", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unit.id, force: occupied }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to delete unit.");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete unit.");
    } finally {
      setDeletingId(null);
    }
  };

  const vacantCount = Math.max(propertyUnitsCount - occupiedCount, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-0 sm:px-2 lg:px-4">
      <PageHeader
        title="Units"
        subtitle="Manage your property inventory"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <ExportButton
              filename="units"
              getData={() =>
                filteredUnits.map((u) => ({
                  Unit: u.unit,
                  Type: u.type ?? "",
                  Beds: u.beds ?? "",
                  Floor: u.floor ?? "",
                  Rent: u.rent ?? 0,
                  Status: u.status ?? "",
                  Property: u.property_id ?? "",
                }))
              }
            />
            <button
              type="button"
              onClick={openModal}
              className="w-full rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 sm:w-auto"
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

      <SectionCard className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Units</h2>
            <p className="text-xs text-slate-400">{filteredUnits.length} units shown</p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search unit, tenant, or type"
            className="w-full rounded-full border border-white/10 bg-panel-2/60 px-3 py-2 text-xs text-slate-100 sm:w-72"
          />
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {filteredUnits.map((unit) => {
            const propertyId = unit.property_id || selectedPropertyId || "";
            const tenantKey = `${propertyId}::${unit.unit}`.toLowerCase();
            const tenant = tenantIndex.get(tenantKey) || tenantIndex.get(`::${unit.unit}`.toLowerCase());
            const lease = hasLeaseData ? findActiveLease(unit) : null;
            const occupied = hasLeaseData ? Boolean(lease) : Boolean(tenant);
            const unitCount = unitServiceCounts.get(unit.id) || 0;
            const buildingCount = propertyId ? buildingServiceCounts.get(propertyId) || 0 : 0;
            const serviceCount = unitCount + buildingCount;
            return (
              <div key={unit.id} className="rounded-2xl border border-white/10 bg-panel/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Unit</p>
                    <p className="text-lg font-semibold text-slate-100">{unit.unit}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      occupied ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"
                    }`}
                  >
                    {occupied ? "Occupied" : "Vacant"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Type</p>
                    <p className="mt-1 text-sm text-slate-200">{unit.type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Rent</p>
                    <p className="mt-1 text-sm text-slate-100">
                      {lease?.rent
                        ? `$${Number(lease.rent).toLocaleString()}`
                        : tenant?.monthly_rent
                        ? `$${Number(tenant.monthly_rent).toLocaleString()}`
                        : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500">Tenant</p>
                    <p className="mt-1 text-sm text-slate-100">{lease?.tenantName || tenant?.name || "No Tenant"}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(unit)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-white/20"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteUnit(unit, occupied)}
                    disabled={deletingId === unit.id}
                    className="rounded-full border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:border-rose-400/70 disabled:opacity-60"
                  >
                    {deletingId === unit.id ? "Deleting..." : "Delete"}
                  </button>
                  <Link
                    href={`/units/${unit.id}/services`}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-center text-xs font-semibold text-slate-200 hover:border-white/20"
                  >
                    Services{serviceCount ? ` (${serviceCount})` : ""}
                  </Link>
                  {!occupied ? (
                    <Link
                      href={`/leases?open=1&property=${encodeURIComponent(propertyId)}&unit=${encodeURIComponent(unit.unit)}`}
                      className="rounded-full bg-accent px-3 py-1.5 text-center text-xs font-semibold text-slate-900"
                    >
                      Lease
                    </Link>
                  ) : (
                    <span className="rounded-full border border-white/10 px-3 py-1.5 text-center text-xs font-semibold text-slate-500">
                      Occupied
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {!filteredUnits.length ? (
            <p className="rounded-xl border border-white/10 bg-panel/40 px-4 py-6 text-center text-sm text-slate-400">
              No units found yet.
            </p>
          ) : null}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
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
                const tenant = tenantIndex.get(tenantKey) || tenantIndex.get(`::${unit.unit}`.toLowerCase());
                const lease = hasLeaseData ? findActiveLease(unit) : null;
                const occupied = hasLeaseData ? Boolean(lease) : Boolean(tenant);
                const unitCount = unitServiceCounts.get(unit.id) || 0;
                const buildingCount = propertyId ? buildingServiceCounts.get(propertyId) || 0 : 0;
                const serviceCount = unitCount + buildingCount;
                return (
                  <tr key={unit.id} className="border-t border-white/10">
                    <td className="py-3 text-slate-100">{unit.unit}</td>
                    <td className="py-3 text-slate-300">{unit.type || "—"}</td>
                    <td className="py-3 text-slate-300">
                      {occupied ? (
                        <span className="inline-flex items-center gap-2 text-slate-100">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          {lease?.tenantName || tenant?.name || "Occupied"}
                        </span>
                      ) : (
                        "No Tenant"
                      )}
                    </td>
                    <td className="py-3 text-slate-100">
                      {lease?.rent
                        ? `$${Number(lease.rent).toLocaleString()}`
                        : tenant?.monthly_rent
                        ? `$${Number(tenant.monthly_rent).toLocaleString()}`
                        : "—"}
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
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(unit)}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteUnit(unit, occupied)}
                          disabled={deletingId === unit.id}
                          className="rounded-full border border-rose-400/40 px-3 py-1 text-xs font-semibold text-rose-200 hover:border-rose-400/70 disabled:opacity-60"
                        >
                          {deletingId === unit.id ? "Deleting..." : "Delete"}
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
                              propertyId,
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
          <SectionCard className="w-full max-w-2xl space-y-4 p-4 sm:p-6">
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
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={closeModal}
                className="w-full rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 sm:flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveUnit}
                disabled={saving}
                className="w-full rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60 sm:flex-1"
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
      className={`w-full rounded-2xl border bg-panel/60 px-5 py-3.5 shadow-card-soft sm:px-6 ${style.border}`}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${style.text}`}>{value}</p>
    </div>
  );
}
