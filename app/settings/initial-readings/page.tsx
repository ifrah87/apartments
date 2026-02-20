"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronLeft } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

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

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function InitialReadingsPage() {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [readingDate, setReadingDate] = useState(() => todayISO());
  const [waterValue, setWaterValue] = useState("");
  const [electricityValue, setElectricityValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

  const tenantByUnit = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach((tenant) => {
      if (!tenant.unit || !tenant.name) return;
      if (!map.has(tenant.unit)) map.set(tenant.unit, tenant.name);
    });
    return map;
  }, [tenants]);

  const unitOptions = useMemo<UnitOption[]>(() => {
    if (units.length) return units;
    const map = new Map<string, UnitOption>();
    tenants.forEach((tenant) => {
      if (!tenant.unit) return;
      if (map.has(tenant.unit)) return;
      map.set(tenant.unit, {
        id: `tenant-${tenant.id}`,
        unit: tenant.unit,
        property_id: tenant.property_id ?? tenant.building ?? null,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.unit.localeCompare(b.unit));
  }, [tenants, units]);

  const baselinePeriod = useMemo(() => {
    if (!readingDate) return "—";
    return new Date(readingDate).toLocaleString("en", { month: "long", year: "numeric" });
  }, [readingDate]);

  const handleSave = async () => {
    setNotice(null);
    if (!selectedUnit) {
      setNotice({ type: "error", message: "Select an apartment first." });
      return;
    }
    if (!readingDate) {
      setNotice({ type: "error", message: "Select a baseline date." });
      return;
    }
    if (!waterValue && !electricityValue) {
      setNotice({ type: "error", message: "Enter at least one baseline meter value." });
      return;
    }

    const payloads = [
      waterValue
        ? {
            unit: selectedUnit,
            meter_type: "water",
            reading_date: readingDate,
            reading_value: waterValue,
            baseline: true,
          }
        : null,
      electricityValue
        ? {
            unit: selectedUnit,
            meter_type: "electricity",
            reading_date: readingDate,
            reading_value: electricityValue,
            baseline: true,
          }
        : null,
    ].filter(Boolean) as Array<Record<string, unknown>>;

    setSaving(true);
    try {
      const results = await Promise.all(
        payloads.map(async (payload) => {
          const res = await fetch("/api/meter-readings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok || body?.ok === false) {
            throw new Error(body?.error || "Failed to save initial readings.");
          }
          return body;
        }),
      );
      if (results.length) {
        setNotice({ type: "success", message: "Initial readings saved." });
      }
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to save initial readings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-slate-400 hover:text-accent"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-semibold text-slate-100">Setup Initial Readings</h1>
        <p className="text-sm text-slate-400">Establish baseline meter values for new deployments.</p>
      </div>

      {notice ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-rose-400/30 bg-rose-400/10 text-rose-200"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="flex justify-center">
        <SectionCard className="w-full max-w-xl p-6">
          <div className="space-y-5 text-sm text-slate-300">
            <div className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-xs text-slate-100">
              Use this form for new deployments where meters already have a value. This sets the baseline.
              No usage/bill will be generated for these numbers.
            </div>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Apartment</span>
              <select
                value={selectedUnit}
                onChange={(event) => setSelectedUnit(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Select apartment</option>
                {unitOptions.map((entry) => {
                  const tenantName = tenantByUnit.get(entry.unit);
                  const label = tenantName ? `${entry.unit} - ${tenantName}` : entry.unit;
                  return (
                    <option key={entry.id} value={entry.unit}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {!unitOptions.length && !unitsLoading && !tenantsLoading ? (
                <p className="text-xs text-slate-500">No apartments found yet. Add units to enable selection.</p>
              ) : null}
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Baseline Date</span>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-slate-100">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={readingDate}
                  onChange={(event) => setReadingDate(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none"
                />
              </div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Baseline period: {baselinePeriod}
              </p>
            </label>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Initial Meter Values</p>
              <label className="space-y-2">
                <span className="text-xs text-slate-400">Baseline Water Billing (m³)</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={waterValue}
                  onChange={(event) => setWaterValue(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs text-slate-400">Baseline Electricity Billing (kWh)</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={electricityValue}
                  onChange={(event) => setElectricityValue(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save Initial Values"}
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
