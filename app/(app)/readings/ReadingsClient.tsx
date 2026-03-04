"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { useTranslations } from "@/components/LanguageProvider";
import { BarChart2, Calendar, Plus, X } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentPropertyId } from "@/lib/currentProperty";
import { dateOnlyToUtcTimestamp, formatDateOnly, formatDateOnlyMonthYear, todayDateOnly } from "@/lib/dateOnly";

type ApiReading = {
  id: string;
  unit: string;
  description: string;
  meter_type?: string;
  reading_date?: string;
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
  name?: string | null;
};

type TenantOption = {
  id: string;
  name?: string;
  unit?: string | null;
  property_id?: string | null;
  building?: string | null;
};

type LeaseOption = {
  id: string;
  unit: string;
  property?: string;
  tenantName?: string;
  status?: string;
  startDate?: string;
};

function todayISO() {
  return todayDateOnly();
}

function formatDateUK(value: string | null | undefined) {
  if (!value) return "—";
  return formatDateOnly(value, "en-GB", { day: "2-digit", month: "short", year: "numeric" }) || String(value);
}

export default function ReadingsPage() {
  const confirm = useConfirm();
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ApiReading[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meterType, setMeterType] = useState<"water" | "electricity">("electricity");
  const [meterValue, setMeterValue] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPropertyId, setUnitPropertyId] = useState<string | null>(null);
  const [readingDate, setReadingDate] = useState(() => todayISO());
  const [showForm, setShowForm] = useState(false);
  const selectedPropertyId = useMemo(() => {
    const fromUrl = searchParams.get("propertyId")?.trim();
    return fromUrl || getCurrentPropertyId() || "";
  }, [searchParams]);

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
    const params = new URLSearchParams({ ts: String(Date.now()) });
    if (selectedPropertyId) {
      params.set("propertyId", selectedPropertyId);
    }
    fetch(`/api/units?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) =>
        setUnits(payload?.ok === false ? [] : (payload?.ok ? payload.data : payload) || []),
      )
      .catch(() => setUnits([]))
      .finally(() => setUnitsLoading(false));
  }, [selectedPropertyId]);

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

  useEffect(() => {
    fetch(`/api/lease-agreements?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => setLeases(payload?.ok === false ? [] : (payload?.ok ? payload.data : payload) || []))
      .catch(() => setLeases([]));
  }, []);

  const leaseNameByKey = useMemo(() => {
    const map = new Map<string, { name: string; start: number }>();
    leases
      .filter((lease) => String(lease.status || "").toLowerCase() === "active")
      .forEach((lease) => {
        if (!lease.unit || !lease.tenantName) return;
        const unitKey = lease.unit.trim();
        const propertyKey = (lease.property || "").trim();
        const start = lease.startDate ? new Date(lease.startDate).getTime() : 0;
        const keys = [
          `${unitKey}||${propertyKey}`,
          `${unitKey}||`,
        ];
        keys.forEach((key) => {
          const existing = map.get(key);
          if (!existing || start >= existing.start) {
            map.set(key, { name: lease.tenantName as string, start });
          }
        });
      });
    return map;
  }, [leases]);

  const unitOptions = useMemo<UnitOption[]>(() => {
    const hasScopedProperty = Boolean(selectedPropertyId);
    const map = new Map<string, UnitOption>();
    units.forEach((unit) => {
      if (!unit.unit) return;
      const key = hasScopedProperty ? unit.unit : `${unit.unit}||${unit.property_id ?? ""}`;
      map.set(key, {
        id: unit.id,
        unit: unit.unit,
        property_id: unit.property_id ?? null,
      });
    });
    tenants.forEach((tenant) => {
      if (!tenant.unit) return;
      if (hasScopedProperty && tenant.property_id && tenant.property_id !== selectedPropertyId) return;
      const propertyId = tenant.property_id ?? tenant.building ?? null;
      const key = hasScopedProperty ? tenant.unit : `${tenant.unit}||${propertyId ?? ""}`;
      const existing = map.get(key);
      if (hasScopedProperty && !existing) return;
      map.set(key, {
        id: existing?.id ?? `tenant-${tenant.id}`,
        unit: tenant.unit,
        property_id: existing?.property_id ?? propertyId,
        name: tenant.name ?? existing?.name ?? null,
      });
    });
    const enriched = Array.from(map.values()).map((entry) => {
      const key = `${entry.unit}||${entry.property_id ?? ""}`;
      const leaseName =
        leaseNameByKey.get(key)?.name || leaseNameByKey.get(`${entry.unit}||`)?.name || null;
      return {
        ...entry,
        name: leaseName ?? entry.name ?? null,
      };
    });
    const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
    return enriched.sort((a, b) => collator.compare(a.unit, b.unit));
  }, [selectedPropertyId, tenants, units, leaseNameByKey]);

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

  const lastReading = useMemo(() => {
    const unitKey = unit.trim().toLowerCase();
    if (!unitKey) return null;
    const match = rows.find(
      (row) => row.unit.toLowerCase() === unitKey && row.meter_type === meterType,
    );
    return match?.reading_value ?? null;
  }, [rows, unit, meterType]);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete Reading",
      message: "Delete this reading? This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch("/api/meter-readings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to delete reading.");
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete reading.");
    }
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


  const { initialRows, historyRows } = useMemo(() => {
    if (!rows.length) return { initialRows: [] as ApiReading[], historyRows: [] as ApiReading[] };
    const earliestByKey = new Map<string, ApiReading>();
    rows.forEach((row) => {
      const key = `${row.unit.toLowerCase()}||${row.meter_type || ""}`;
      const rowDate = row.reading_date ? dateOnlyToUtcTimestamp(row.reading_date) : 0;
      const existing = earliestByKey.get(key);
      if (!existing) {
        earliestByKey.set(key, row);
        return;
      }
      const existingDate = existing.reading_date ? dateOnlyToUtcTimestamp(existing.reading_date) : 0;
      if (rowDate < existingDate) {
        earliestByKey.set(key, row);
      }
    });
    const initial = Array.from(earliestByKey.values()).sort((a, b) => {
      const unitCompare = a.unit.localeCompare(b.unit, undefined, { numeric: true, sensitivity: "base" });
      if (unitCompare !== 0) return unitCompare;
      return String(a.meter_type || "").localeCompare(String(b.meter_type || ""), undefined, { sensitivity: "base" });
    });
    const initialIds = new Set(initial.map((row) => row.id));
    const history = rows.filter((row) => !initialIds.has(row.id));
    return { initialRows: initial, historyRows: history };
  }, [rows]);

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
                          {entry.name ? ` · ${entry.name}` : " · Vacant"}
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
                      ? formatDateOnlyMonthYear(readingDate, "en-GB")
                      : "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Meter Values</label>
                  <div className="rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
                    {meterType === "electricity" ? "Electricity Billing (kWh)" : "Water Billing (m³)"}
                  </div>
                  {lastReading === null ? (
                    <div className="rounded-lg border border-white/10 bg-surface/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Initial Reading</p>
                      <p className="text-xs text-slate-500">First reading for this unit.</p>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Enter initial reading"
                        value={meterValue}
                        onChange={(event) => setMeterValue(event.target.value)}
                        className="mt-3 w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-slate-500">Last Reading</label>
                        <input
                          type="number"
                          step="0.01"
                          value={String(lastReading)}
                          disabled
                          className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 disabled:opacity-70"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-slate-500">Current Reading</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Enter reading value"
                          value={meterValue}
                          onChange={(event) => setMeterValue(event.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  )}
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
          {initialRows.length ? (
            <SectionCard className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Initial Meter Readings</h2>
                  <p className="text-sm text-slate-400">Baseline readings for each meter.</p>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Meter</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Reading</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-400">
                    {initialRows.map((row) => (
                      <tr key={row.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 font-semibold text-slate-100">{row.unit}</td>
                        <td className="px-4 py-3 capitalize">{row.meter_type || "—"}</td>
                        <td className="px-4 py-3">{formatDateUK(row.reading_date)}</td>
                        <td className="px-4 py-3">{row.reading_value.toFixed(2)}</td>
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
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

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
                  {historyRows.map((row) => (
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
                  {!historyRows.length && !loadingRows && (
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

      </div>
    </div>
  );
}
