"use client";

import { useEffect, useMemo, useState } from "react";
import { createTranslator } from "@/lib/i18n";
import { BarChart2, Calendar, Plus, X } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";

type ApiReading = {
  id: string;
  unit: string;
  description: string;
  prev_value: number;
  reading_value: number;
  usage: number;
  amount: number;
  proof_url?: string | null;
};

type UnitOption = {
  id: string;
  unit: string;
  property_id?: string | null;
};

type TenantOption = {
  id: string;
  name?: string;
  unit?: string | null;
  property_id?: string | null;
  building?: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReadingsPage() {
  const t = createTranslator("en");
  const [rows, setRows] = useState<ApiReading[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meterType, setMeterType] = useState<"water" | "electricity">("electricity");
  const [meterValue, setMeterValue] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPropertyId, setUnitPropertyId] = useState<string | null>(null);
  const [readingDate, setReadingDate] = useState(() => todayISO());
  const [showForm, setShowForm] = useState(false);

  const loadReadings = async () => {
    setLoadingRows(true);
    try {
      const res = await fetch("/api/meter-readings", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to load readings");
      }
      setRows(payload?.ok ? payload.data : payload);
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    loadReadings();
  }, []);

  useEffect(() => {
    setUnitsLoading(true);
    fetch(`/api/units?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) =>
        setUnits(payload?.ok === false ? [] : (payload?.ok ? payload.data : payload) || []),
      )
      .catch(() => setUnits([]))
      .finally(() => setUnitsLoading(false));
  }, []);

  useEffect(() => {
    setTenantsLoading(true);
    fetch(`/api/dashboard/occupancy?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) =>
        setTenants(payload?.ok === false ? [] : (payload?.ok ? payload.data : payload) || []),
      )
      .catch(() => setTenants([]))
      .finally(() => setTenantsLoading(false));
  }, []);

  const unitOptions = useMemo<UnitOption[]>(() => {
    if (units.length) return units;
    const map = new Map<string, UnitOption>();
    tenants.forEach((tenant) => {
      if (!tenant.unit) return;
      const propertyId = tenant.property_id ?? tenant.building ?? null;
      const key = `${tenant.unit}||${propertyId ?? ""}`;
      if (map.has(key)) return;
      map.set(key, {
        id: `tenant-${tenant.id}`,
        unit: tenant.unit,
        property_id: propertyId,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.unit.localeCompare(b.unit));
  }, [tenants, units]);

  const selectedTenantId = useMemo(() => {
    if (!unit.trim()) return null;
    const unitKey = unit.trim().toLowerCase();
    const propertyKey = (unitPropertyId || "").trim().toLowerCase();
    const match = tenants.find((tenant) => {
      if ((tenant.unit || "").toLowerCase() !== unitKey) return false;
      if (!propertyKey) return true;
      const tenantProperty = (tenant.property_id || tenant.building || "").toLowerCase();
      return tenantProperty === propertyKey;
    });
    return match?.id ?? null;
  }, [tenants, unit, unitPropertyId]);

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleSave = async () => {
    if (!unit.trim()) {
      setError("Please enter a unit.");
      return;
    }
    if (!meterValue) {
      setError("Please enter a reading value.");
      return;
    }
    if (!readingDate) {
      setError("Please select a reading date.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/meter-readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit: unit.trim(),
          tenant_id: selectedTenantId || undefined,
          meter_type: meterType,
          reading_date: readingDate,
          reading_value: meterValue,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to save reading");
      }
      await loadReadings();
      setMeterValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reading");
    } finally {
      setSaving(false);
    }
  };

  const totalWater = useMemo(
    () =>
      rows
        .filter((row) => (row.description || "").toLowerCase().includes("water"))
        .reduce((sum, row) => sum + Number(row.usage || 0), 0),
    [rows],
  );
  const totalElectric = useMemo(
    () =>
      rows
        .filter((row) => (row.description || "").toLowerCase().includes("electricity"))
        .reduce((sum, row) => sum + Number(row.usage || 0), 0),
    [rows],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("sidebar.nav.readings")}
        subtitle="Meter readings, utility usage, and billing history."
        actions={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong"
          >
            <Plus className="h-4 w-4" />
            Enter New Reading
          </button>
        }
      />

      {showForm ? (
        <div className="fixed inset-0 z-50 flex justify-start bg-black/50 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-sm flex-col bg-panel/95 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">New Reading</p>
                <h2 className="text-base font-semibold text-slate-100">Enter Readings</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Meter Type</label>
                  <select
                    value={meterType}
                    onChange={(event) => setMeterType(event.target.value as "water" | "electricity")}
                    className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="electricity">Electricity</option>
                    <option value="water">Water</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Unit</label>
                  {unitOptions.length ? (
                    <select
                      value={unit ? `${unit}||${unitPropertyId ?? ""}` : ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!value) {
                          setUnit("");
                          setUnitPropertyId(null);
                          return;
                        }
                        const [unitValue, propertyValue] = value.split("||");
                        setUnit(unitValue);
                        setUnitPropertyId(propertyValue || null);
                      }}
                      className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="">Select unit</option>
                      {unitOptions.map((entry) => (
                        <option key={entry.id} value={`${entry.unit}||${entry.property_id ?? ""}`}>
                          {entry.unit}
                          {entry.property_id ? ` · ${entry.property_id}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter unit (e.g., 101)"
                      value={unit}
                      onChange={(event) => {
                        setUnit(event.target.value);
                        setUnitPropertyId(null);
                      }}
                      className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                  )}
                  {!unitOptions.length && !unitsLoading && !tenantsLoading ? (
                    <p className="text-xs text-slate-500">
                      No units found yet. Add units or tenants to enable selection.
                    </p>
                  ) : null}
                  {!tenantsLoading && unit && !selectedTenantId ? (
                    <p className="text-xs text-slate-500">No tenant found for this unit yet.</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reading Date</label>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-slate-100">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      value={readingDate}
                      onChange={(event) => setReadingDate(event.target.value)}
                      className="w-full bg-transparent text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Billing period:{" "}
                    {readingDate
                      ? new Date(readingDate).toLocaleString("en", { month: "long", year: "numeric" })
                      : "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Meter Values</label>
                  <div className="rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
                    {meterType === "electricity" ? "Electricity Billing (kWh)" : "Water Billing (m³)"}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Enter reading value"
                    value={meterValue}
                    onChange={(event) => setMeterValue(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Upload Proof (image)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1 file:text-sm file:font-semibold file:text-slate-900"
                  />
                </div>
                {error && <p className="text-xs text-rose-300">{error}</p>}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Plus className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Readings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
          <SectionCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-accent">
                  <BarChart2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Meter Readings History</h2>
                  <p className="text-sm text-slate-400">Unit usage and billing records.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Prev</th>
                    <th className="px-4 py-3">Cur</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Proof</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-slate-100">{row.unit}</td>
                      <td className="px-4 py-3">{row.description}</td>
                      <td className="px-4 py-3">{row.prev_value}</td>
                      <td className="px-4 py-3">{row.reading_value}</td>
                      <td className="px-4 py-3">{row.usage.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-100">{row.amount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <button className="text-accent hover:underline">View</button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="rounded-md border border-white/10 px-3 py-1 text-xs font-semibold text-slate-400 hover:border-accent/60 hover:text-slate-100"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && !loadingRows && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                        No readings yet.
                      </td>
                    </tr>
                  )}
                  {loadingRows && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                        Loading readings...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  Yearly Consumption Summary
                </p>
                <p className="text-xs text-slate-400">Fiscal year {new Date().getFullYear()} · All units</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Total water billing</div>
                <div className="text-sm font-semibold text-slate-100">{totalWater.toFixed(2)} m³</div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Total electricity billing</div>
                <div className="text-sm font-semibold text-slate-100">{totalElectric.toFixed(2)} kWh</div>
              </div>
            </div>
            <div className="mt-6 h-48 rounded-2xl border border-dashed border-white/10 bg-white/5" />
          </SectionCard>
      </div>
    </div>
  );
}
