"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PencilLine, Trash2 } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

type UnitRecord = {
  id: string;
  property_id?: string | null;
  unit: string;
};

type TenantRecord = {
  name: string;
  property_id?: string;
  building?: string;
  unit?: string;
};

type PropertyRecord = {
  property_id: string;
  name?: string;
};

type ServiceRecord = {
  id: string;
  name: string;
  type: "metered" | "flat";
  unit: string;
  rate: number;
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

function formatRate(rate: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(rate || 0);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function UnitServicesPage() {
  const params = useParams();
  const unitId = Array.isArray(params?.unitId) ? params.unitId[0] : params?.unitId;
  const [unit, setUnit] = useState<UnitRecord | null>(null);
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [property, setProperty] = useState<PropertyRecord | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [unitServices, setUnitServices] = useState<UnitServiceRecord[]>([]);
  const [buildingServices, setBuildingServices] = useState<BuildingServiceRecord[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [startDate, setStartDate] = useState(isoToday());
  const [applyToBuilding, setApplyToBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState("");

  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceRecord>();
    services.forEach((service) => map.set(service.id, service));
    return map;
  }, [services]);

  const loadAssignments = async (propertyId?: string | null) => {
    const [unitServicesRes, buildingServicesRes] = await Promise.all([
      fetch(`/api/unit-services?unitId=${unitId}`, { cache: "no-store" }),
      propertyId
        ? fetch(`/api/building-services?propertyId=${propertyId}`, { cache: "no-store" })
        : Promise.resolve(null),
    ]);
    const unitServicesPayload = await unitServicesRes.json().catch(() => null);
    const buildingServicesPayload = buildingServicesRes
      ? await buildingServicesRes.json().catch(() => null)
      : null;

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
  };

  useEffect(() => {
    if (!unitId) return;
    const load = async () => {
      try {
        const [unitsRes, tenantsRes, servicesRes, propertiesRes] = await Promise.all([
          fetch("/api/units", { cache: "no-store" }),
          fetch("/api/tenants", { cache: "no-store" }),
          fetch("/api/services", { cache: "no-store" }),
          fetch("/api/properties", { cache: "no-store" }),
        ]);

        const unitsPayload = await unitsRes.json().catch(() => null);
        const tenantsPayload = await tenantsRes.json().catch(() => null);
        const servicesPayload = await servicesRes.json().catch(() => null);
        const propertiesPayload = await propertiesRes.json().catch(() => null);

        const unitsList: UnitRecord[] =
          unitsPayload?.ok === false ? [] : (unitsPayload?.ok ? unitsPayload.data : unitsPayload) || [];
        const tenantsList: TenantRecord[] =
          tenantsPayload?.ok === false ? [] : (tenantsPayload?.ok ? tenantsPayload.data : tenantsPayload) || [];
        const servicesList: ServiceRecord[] =
          servicesPayload?.ok === false ? [] : (servicesPayload?.ok ? servicesPayload.data : servicesPayload) || [];
        const propertiesList: PropertyRecord[] =
          propertiesPayload?.ok === false
            ? []
            : (propertiesPayload?.ok ? propertiesPayload.data : propertiesPayload) || [];

        const match = unitsList.find((entry) => entry.id === unitId);
        setUnit(match || null);
        const propertyId = match?.property_id || undefined;
        const propertyMatch = propertyId
          ? propertiesList.find((entry) => entry.property_id === propertyId) || null
          : null;
        setProperty(propertyMatch);
        const tenantMatch = match
          ? tenantsList.find(
              (entry) =>
                (entry.property_id || entry.building || "") === (match.property_id || "") &&
                (entry.unit || "") === match.unit,
            ) || null
          : null;
        setTenant(tenantMatch);
        setServices(servicesList);
        await loadAssignments(propertyId);
      } catch (err) {
        console.error("Failed to load unit services", err);
        setError("Failed to load services.");
      }
    };
    load();
  }, [unitId]);

  const assignService = async () => {
    if (!serviceId) {
      setError("Select a service first.");
      return;
    }
    if (!startDate) {
      setError("Select a start date.");
      return;
    }
    if (applyToBuilding && !unit?.property_id) {
      setError("Unit property is missing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const endpoint = applyToBuilding ? "/api/building-services" : "/api/unit-services";
      const payload = applyToBuilding
        ? { propertyId: unit?.property_id, serviceId, startDate }
        : { unitId, propertyId: unit?.property_id, serviceId, startDate };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to assign service.");
      }
      setServiceId("");
      setStartDate(isoToday());
      setApplyToBuilding(false);
      await loadAssignments(unit?.property_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign service.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUnitService = async (id: string) => {
    await fetch("/api/unit-services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAssignments(unit?.property_id);
  };

  const deleteBuildingService = async (id: string) => {
    await fetch("/api/building-services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAssignments(unit?.property_id);
  };

  const startEdit = (service: UnitServiceRecord) => {
    setEditingId(service.id);
    setEditingDate(service.startDate);
  };

  const saveEdit = async (id: string) => {
    await fetch("/api/unit-services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, startDate: editingDate }),
    });
    setEditingId(null);
    setEditingDate("");
    await loadAssignments(unit?.property_id);
  };

  const heading = unit ? `Unit ${unit.unit}${tenant ? ` – ${tenant.name}` : ""}` : "Unit services";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-400">Manage Services</p>
          <h1 className="text-2xl font-semibold text-slate-100">{heading}</h1>
          {property ? (
            <p className="text-xs text-slate-400">{property.name || property.property_id}</p>
          ) : null}
        </div>
        <Link
          href="/units"
          className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200"
        >
          Back to Apartments
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SectionCard>
          <h2 className="text-sm font-semibold text-slate-100">Assigned Flat Services</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2">Service Name</th>
                  <th className="py-2">Start Date</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {unitServices.map((entry) => {
                  const service = serviceMap.get(entry.serviceId);
                  return (
                    <tr key={entry.id} className="border-t border-white/10">
                      <td className="py-3 text-slate-100">
                        {service?.name || "Unknown service"}
                        {service ? (
                          <span className="ml-2 text-xs text-slate-400">
                            {formatRate(service.rate)} / {service.unit || "Unit"}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 text-slate-300">
                        {editingId === entry.id ? (
                          <input
                            type="date"
                            value={editingDate}
                            onChange={(event) => setEditingDate(event.target.value)}
                            className="rounded-md border border-white/10 bg-panel-2/60 px-2 py-1 text-xs text-slate-100"
                          />
                        ) : (
                          entry.startDate
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {editingId === entry.id ? (
                            <button
                              type="button"
                              onClick={() => saveEdit(entry.id)}
                              className="rounded-md border border-emerald-400/40 px-2 py-1 text-xs text-emerald-200"
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:border-white/20"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteUnitService(entry.id)}
                            className="rounded-md border border-rose-400/40 px-2 py-1 text-xs text-rose-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!unitServices.length && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-slate-400">
                      No assigned services yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Assign Service</h2>
              <Link href="/services" className="text-xs font-semibold text-accent hover:underline">
                + New Type
              </Link>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <label className="text-xs text-slate-400">
                Service Type
                <select
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select a service...</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Starting From
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={applyToBuilding}
                  onChange={(event) => setApplyToBuilding(event.target.checked)}
                />
                Apply to entire building
              </label>
              {error ? <p className="text-xs text-rose-300">{error}</p> : null}
              <button
                type="button"
                onClick={assignService}
                disabled={saving}
                className="w-full rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60"
              >
                {saving ? "Assigning..." : "Assign Service"}
              </button>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="text-sm font-semibold text-slate-100">Building-Wide Services</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {buildingServices.map((entry) => {
                const service = serviceMap.get(entry.serviceId);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {service?.name || "Unknown service"}
                      </p>
                      {service ? (
                        <p className="text-xs text-slate-400">
                          {formatRate(service.rate)} / {service.unit || "Unit"}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteBuildingService(entry.id)}
                      className="rounded-md border border-rose-400/40 px-2 py-1 text-xs text-rose-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {!buildingServices.length && (
                <p className="text-xs text-slate-400">No building-wide services assigned.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
