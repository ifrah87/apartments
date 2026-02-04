"use client";

import { useEffect, useState } from "react";
import {
  Droplet,
  Zap,
  Trash2,
  PencilLine,
  ShieldCheck,
  Sparkles,
  Plus,
  X,
  DollarSign,
} from "lucide-react";
import type { ComponentType } from "react";
import SectionCard from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";

type Service = {
  id: string;
  name: string;
  type: "metered" | "flat";
  unit: string;
  rate: number;
  accent?: "cyan" | "blue" | "emerald" | "violet" | "teal" | "amber";
  icon?: "water" | "electricity" | "money" | "security" | "generic";
};

type ServiceFormState = {
  id?: string;
  name: string;
  type: "metered" | "flat";
  unit: string;
  rate: string;
  icon: "water" | "electricity" | "money" | "security" | "generic";
  accent: "cyan" | "blue" | "emerald" | "violet" | "teal" | "amber";
};

const DEFAULT_SERVICES: Service[] = [
  { id: "water", name: "Water Billing", type: "metered", unit: "m3", rate: 1.5, accent: "cyan", icon: "water" },
  {
    id: "electricity",
    name: "Electricity Billing",
    type: "metered",
    unit: "kWh",
    rate: 0.41,
    accent: "blue",
    icon: "electricity",
  },
  { id: "waste", name: "Waste Management", type: "flat", unit: "Month", rate: 7, accent: "amber", icon: "money" },
  {
    id: "cleaning",
    name: "Elevators + Cleaning",
    type: "flat",
    unit: "Month",
    rate: 13,
    accent: "amber",
    icon: "money",
  },
  { id: "security", name: "Security", type: "flat", unit: "Month", rate: 5, accent: "amber", icon: "money" },
];

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  water: Droplet,
  electricity: Zap,
  security: ShieldCheck,
  money: DollarSign,
  generic: Sparkles,
};

const ACCENT_STYLES: Record<string, { border: string; icon: string }> = {
  cyan: { border: "border-cyan-400/70", icon: "text-cyan-200" },
  blue: { border: "border-sky-400/70", icon: "text-sky-200" },
  emerald: { border: "border-emerald-400/70", icon: "text-emerald-200" },
  violet: { border: "border-violet-400/70", icon: "text-violet-200" },
  teal: { border: "border-teal-400/70", icon: "text-teal-200" },
  amber: { border: "border-amber-400/70", icon: "text-amber-200" },
};

function formatRate(rate: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(rate || 0);
}

function rateLabel(service: Service) {
  const unit = service.unit || (service.type === "flat" ? "Month" : "Unit");
  return `Rate / ${unit}`;
}

function baseUnit(service: Service) {
  return service.unit || (service.type === "flat" ? "Month" : "Unit");
}

function inferIcon(name: string, type: Service["type"]): ServiceFormState["icon"] {
  const label = name.toLowerCase();
  if (label.includes("water")) return "water";
  if (label.includes("electric")) return "electricity";
  if (type === "flat") return "money";
  return "generic";
}

function inferAccent(type: Service["type"]): ServiceFormState["accent"] {
  return type === "flat" ? "amber" : "cyan";
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [editing, setEditing] = useState<ServiceFormState>({
    name: "",
    type: "metered",
    unit: "",
    rate: "",
    icon: "water",
    accent: "cyan",
  });
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServices = async () => {
    try {
      const res = await fetch("/api/services", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.ok !== false) {
        const data = (payload?.ok ? payload.data : payload) as Service[];
        if (Array.isArray(data) && data.length) {
          setServices(data);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to load services", err);
    }
    setServices(DEFAULT_SERVICES);
  };

  useEffect(() => {
    loadServices();
  }, []);

  const startCreate = () => {
    setMode("create");
    setEditing({ name: "", type: "metered", unit: "", rate: "", icon: "water", accent: "cyan" });
    setError(null);
  };

  const startEdit = (service: Service) => {
    setMode("edit");
    setEditing({
      id: service.id,
      name: service.name,
      type: service.type,
      unit: service.unit,
      rate: service.rate.toString(),
      icon: service.icon ?? inferIcon(service.name, service.type),
      accent: service.accent ?? inferAccent(service.type),
    });
    setError(null);
  };

  const cancelEdit = () => {
    startCreate();
    setError(null);
  };

  const saveService = async () => {
    if (!editing.name.trim()) {
      setError("Service name is required.");
      return;
    }
    if (editing.rate.trim() === "" || Number.isNaN(Number(editing.rate))) {
      setError("Rate per unit must be a number.");
      return;
    }
    if (!editing.unit.trim()) {
      setError("Display unit is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: editing.id,
        name: editing.name.trim(),
        type: editing.type,
        unit: editing.unit.trim(),
        rate: Number(editing.rate),
        icon: inferIcon(editing.name, editing.type),
        accent: inferAccent(editing.type),
      };

      const res =
        mode === "edit"
          ? await fetch("/api/services", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/services", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to save service");
      }
      await loadServices();
      if (mode === "create") {
        startCreate();
      } else {
        startCreate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save service");
    } finally {
      setSaving(false);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm("Delete this service?")) return;
    try {
      const res = await fetch("/api/services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: serviceId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to delete service");
      }
      await loadServices();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete service");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services & Rates"
        subtitle="Define building-wide utilities and fixed maintenance fees."
        actions={
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_10px_20px_rgba(34,211,238,0.25)] hover:bg-cyan-300"
          >
            <Plus className="h-4 w-4" />
            Add New Service
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard className="p-6">
          <div className="space-y-4">
            {services.map((service) => {
              const accent = ACCENT_STYLES[service.accent || (service.type === "flat" ? "amber" : "cyan")] ?? ACCENT_STYLES.cyan;
              const badgeVariant = service.type === "metered" ? "info" : "warning";
              const Icon = ICON_MAP[service.icon || "generic"] ?? Sparkles;
              return (
                <div
                  key={service.id}
                  className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm transition hover:border-white/20 ${accent.border} border-l-2`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`grid h-11 w-11 place-items-center rounded-lg bg-white/5 ${accent.icon}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold text-slate-100">{service.name}</p>
                        <Badge variant={badgeVariant}>{service.type === "metered" ? "Metered" : "Flat Rate"}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">Base Unit: {baseUnit(service)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        {rateLabel(service)}
                      </p>
                      <p className="text-sm font-semibold text-cyan-200">{formatRate(service.rate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(service)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:text-white"
                      >
                        <PencilLine className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteService(service.id)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-rose-300 hover:border-rose-400/40 hover:text-rose-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!services.length && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                No services added yet.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100">
                {mode === "edit" ? "Edit Service" : "New Service"}
              </p>
            </div>
            <button
              onClick={cancelEdit}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-4 text-sm text-slate-300">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Service Name</label>
              <input
                type="text"
                placeholder="e.g. Water Monthly"
                value={editing?.name ?? ""}
                onChange={(event) => setEditing((prev) => ({ ...(prev ?? { name: "", type: "metered", unit: "", rate: "", icon: "water", accent: "cyan" }), name: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billing Strategy</label>
              <select
                value={editing?.type ?? "metered"}
                onChange={(event) => {
                  const nextType = event.target.value as "metered" | "flat";
                  setEditing((prev) => ({
                    ...(prev ?? { name: "", type: "metered", unit: "", rate: "", icon: "water", accent: "cyan" }),
                    type: nextType,
                    unit: prev?.unit || (nextType === "flat" ? "Month" : ""),
                    accent: inferAccent(nextType),
                  }));
                }}
                className="w-full rounded-lg border border-white/10 bg-surface/70 px-3 py-2 text-sm text-slate-100"
              >
                <option value="metered">Metered (Usage Based)</option>
                <option value="flat">Flat Rate (Fixed Amount)</option>
              </select>
            </div>
            <div className="grid items-end gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rate per Unit (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={editing?.rate ?? ""}
                  onChange={(event) => setEditing((prev) => ({ ...(prev ?? { name: "", type: "metered", unit: "", rate: "", icon: "water", accent: "cyan" }), rate: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-white/10 bg-surface/70 px-3 text-sm text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Display Unit</label>
                <input
                  type="text"
                  placeholder="Month"
                  value={editing?.unit ?? ""}
                  onChange={(event) => setEditing((prev) => ({ ...(prev ?? { name: "", type: "metered", unit: "", rate: "", icon: "water", accent: "cyan" }), unit: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-white/10 bg-surface/70 px-3 text-sm text-slate-100"
                />
              </div>
            </div>
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
            <button
              type="button"
              onClick={saveService}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_10px_20px_rgba(34,211,238,0.25)] hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : mode === "edit" ? "Update Service" : "Create Service"}
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
