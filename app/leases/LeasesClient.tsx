"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { DEFAULT_LEASES, LeaseAgreement, LeaseBillingCycle, LeaseAgreementStatus } from "@/lib/leases";
import { DEFAULT_LEASE_TEMPLATE } from "@/lib/settings/defaults";
import type { LeaseTemplateSettings } from "@/lib/settings/types";
import { FileDown, Plus, Search, PencilLine, Eye, Trash2, X, Info } from "lucide-react";

type LeaseFormState = {
  property: string;
  unit: string;
  tenantName: string;
  tenantPhone: string;
  rent: string;
  deposit: string;
  cycle: LeaseBillingCycle;
  startDate: string;
  endDate: string;
  leaseDuration: string;
  status: LeaseAgreementStatus;
};

const MONTHS = [
  "All Months",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const YEARS = ["2026", "2025", "2024", "All Years"];

const CYCLE_OPTIONS: LeaseBillingCycle[] = ["Monthly", "Quarterly", "Semi-Annually", "Annually"];

const DURATION_OPTIONS = ["Manual Date / Open", "6 Months", "12 Months", "24 Months"];

const DURATION_MONTHS: Record<string, number> = {
  "6 Months": 6,
  "12 Months": 12,
  "24 Months": 24,
};

const STATUS_VARIANTS: Record<LeaseAgreementStatus, "success" | "warning" | "danger" | "info"> = {
  Active: "success",
  Terminated: "danger",
  Pending: "warning",
};

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("en-GB");

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCurrency(value: number) {
  return formatter.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "Open Ended";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function addMonthsToIso(startDate: string, months: number) {
  const match = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return "";
  const totalMonths = monthIndex + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  const target = new Date(Date.UTC(targetYear, targetMonth, targetDay));
  return target.toISOString().slice(0, 10);
}

function getPeriod(lease: LeaseAgreement) {
  const start = formatDate(lease.startDate);
  const end = lease.endDate ? formatDate(lease.endDate) : "Open Ended";
  return `${start} - ${end}`;
}

function buildDefaultForm(): LeaseFormState {
  const today = new Date();
  const iso = today.toISOString().split("T")[0] ?? "";
  return {
    property: "",
    unit: "",
    tenantName: "",
    tenantPhone: "",
    rent: "",
    deposit: "",
    cycle: "Monthly",
    startDate: iso,
    endDate: "",
    leaseDuration: "Manual Date / Open",
    status: "Active",
  };
}

export default function LeasesClient() {
  const [leases, setLeases] = useState<LeaseAgreement[]>([]);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("All Months");
  const [yearFilter, setYearFilter] = useState("2026");
  const [showModal, setShowModal] = useState(false);
  const [viewingLease, setViewingLease] = useState<LeaseAgreement | null>(null);
  const [leaseTemplate, setLeaseTemplate] = useState<LeaseTemplateSettings>(DEFAULT_LEASE_TEMPLATE);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Array<{ id: string; label: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; unit: string; property_id?: string | null }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LeaseFormState>(buildDefaultForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prefillDone, setPrefillDone] = useState(false);
  const [lockUnitSelection, setLockUnitSelection] = useState(false);
  const [customUnit, setCustomUnit] = useState("");
  const searchParams = useSearchParams();

  const loadLeases = async () => {
    try {
      const res = await fetch("/api/lease-agreements", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.ok !== false) {
        const data = (payload?.ok ? payload.data : payload) as LeaseAgreement[];
        if (Array.isArray(data) && data.length) {
          setLeases(data);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to load lease agreements", err);
    }
    setLeases([]);
  };

  const loadTemplate = async () => {
    try {
      const res = await fetch("/api/settings/lease-template", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to load lease template.");
      }
      const data = (payload?.ok ? payload.data : payload) as LeaseTemplateSettings;
      if (data) {
        setLeaseTemplate(data);
      }
      setTemplateLoaded(true);
      setTemplateError(null);
    } catch (err) {
      console.error(err);
      setTemplateLoaded(true);
      setTemplateError("Lease template unavailable. Configure it in Settings → Lease Template.");
    }
  };

  const loadProperties = async () => {
    try {
      const res = await fetch("/api/properties", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.ok !== false) {
        const data = (payload?.ok ? payload.data : payload) as Array<{ name?: string; building?: string; property_id?: string }>;
        if (Array.isArray(data) && data.length) {
          const options = data
            .map((item) => {
              const label = item.name || item.building || item.property_id;
              const id = item.property_id || label;
              return label && id ? { id, label } : null;
            })
            .filter(Boolean) as Array<{ id: string; label: string }>;
          if (options.length) {
            const deduped = new Map<string, { id: string; label: string }>();
            options.forEach((option) => {
              if (!deduped.has(option.id)) {
                deduped.set(option.id, option);
              }
            });
            setProperties(Array.from(deduped.values()));
            return;
          }
        }
      }
    } catch (err) {
      console.error("Failed to load properties", err);
    }
    const fallback = leases
      .map((lease) => lease.property)
      .filter(Boolean)
      .map((label) => ({ id: label, label })) as Array<{ id: string; label: string }>;
    const deduped = new Map<string, { id: string; label: string }>();
    fallback.forEach((option) => {
      if (!deduped.has(option.id)) {
        deduped.set(option.id, option);
      }
    });
    setProperties(Array.from(deduped.values()));
  };

  const loadUnits = async () => {
    try {
      const res = await fetch("/api/units", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.ok !== false) {
        const data = (payload?.ok ? payload.data : payload) as Array<{
          id: string;
          unit: string;
          property_id?: string | null;
        }>;
        if (Array.isArray(data)) {
          setUnits(data);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to load units", err);
    }
    setUnits([]);
  };

  useEffect(() => {
    loadLeases();
    loadUnits();
  }, []);

  useEffect(() => {
    loadProperties();
  }, [leases]);

  useEffect(() => {
    if (prefillDone) return;
    const open = searchParams?.get("open") || searchParams?.get("new");
    const unit = searchParams?.get("unit") || "";
    const property = searchParams?.get("property") || "";
    if (open || unit || property) {
      setEditingId(null);
      setForm((prev) => ({
        ...buildDefaultForm(),
        property: property || prev.property,
        unit: unit || prev.unit,
      }));
      setFormError(null);
      setNotice(null);
      setLockUnitSelection(Boolean(unit));
      setCustomUnit("");
      setShowModal(true);
      setPrefillDone(true);
    }
  }, [prefillDone, searchParams]);

  const activeLeases = useMemo(() => leases.filter((lease) => lease.status === "Active"), [leases]);
  const securityDeposits = useMemo(
    () => activeLeases.reduce((sum, lease) => sum + (lease.deposit || 0), 0),
    [activeLeases],
  );
  const grossMonthlyRent = useMemo(
    () => activeLeases.reduce((sum, lease) => sum + (lease.rent || 0), 0),
    [activeLeases],
  );
  const expiringSoon = useMemo(() => {
    const now = new Date();
    const limit = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90);
    return activeLeases.filter((lease) => {
      if (!lease.endDate) return false;
      const end = new Date(lease.endDate);
      if (Number.isNaN(end.getTime())) return false;
      return end >= now && end <= limit;
    }).length;
  }, [activeLeases]);

  const visibleLeases = useMemo(() => {
    const query = search.trim().toLowerCase();
    const monthIndex = MONTHS.indexOf(monthFilter);
    const targetMonth = monthIndex > 0 ? monthIndex - 1 : null;
    return leases.filter((lease) => {
      const matchesQuery =
        !query ||
        lease.unit.toLowerCase().includes(query) ||
        lease.tenantName.toLowerCase().includes(query) ||
        (lease.tenantPhone || "").toLowerCase().includes(query);

      if (!matchesQuery) return false;

      const date = new Date(lease.startDate);
      const hasValidDate = !Number.isNaN(date.getTime());
      const matchesMonth =
        targetMonth === null || !hasValidDate ? true : date.getMonth() === targetMonth;
      const matchesYear =
        yearFilter === "All Years" || !hasValidDate ? true : date.getFullYear().toString() === yearFilter;
      return matchesMonth && matchesYear;
    });
  }, [leases, search, monthFilter, yearFilter]);

  const propertyLabel = form.property.trim();
  const normalizedPropertyLabel = propertyLabel.toLowerCase();
  const selectedPropertyId = useMemo(() => {
    if (!normalizedPropertyLabel) return "";
    const match =
      properties.find((property) => property.label.toLowerCase() === normalizedPropertyLabel) ||
      properties.find((property) => property.id.toLowerCase() === normalizedPropertyLabel);
    return match?.id || "";
  }, [properties, normalizedPropertyLabel]);
  const hasSelectedProperty = Boolean(selectedPropertyId);
  const hasPropertyValue = Boolean(propertyLabel);

  const unitOptions = useMemo(() => {
    if (lockUnitSelection && form.unit) {
      return [form.unit];
    }
    if (!units.length) {
      return form.unit ? [form.unit] : [];
    }
    const normalizedProperty = normalizedPropertyLabel;
    let filtered = [] as Array<{ unit: string }>;
    if (hasSelectedProperty) {
      filtered = units.filter((unit) => unit.property_id === selectedPropertyId);
      if (!filtered.length) {
        filtered = units;
      }
    } else if (normalizedProperty) {
      filtered = units.filter((unit) => {
        const prop = (unit.property_id || "").toLowerCase();
        if (!prop) return true;
        return prop === normalizedProperty;
      });
      if (!filtered.length) {
        filtered = units;
      }
    } else {
      filtered = units;
    }
    const set = new Set(filtered.map((unit) => unit.unit).filter(Boolean));
    if (form.unit) set.add(form.unit);
    return Array.from(set);
  }, [lockUnitSelection, form.unit, hasSelectedProperty, normalizedPropertyLabel, selectedPropertyId, units]);

  useEffect(() => {
    if (lockUnitSelection) return;
    if (!form.unit) return;
    if (unitOptions.includes(form.unit)) return;
    if (!customUnit) {
      setCustomUnit(form.unit);
    }
  }, [lockUnitSelection, form.unit, unitOptions, customUnit]);

  const isEditing = editingId !== null;

  const startCreate = () => {
    setEditingId(null);
    setForm(buildDefaultForm());
    setFormError(null);
    setNotice(null);
    setLockUnitSelection(false);
    setCustomUnit("");
    setShowModal(true);
  };

  const startEdit = (lease: LeaseAgreement) => {
    setEditingId(lease.id);
    setForm({
      property: lease.property ?? "",
      unit: lease.unit,
      tenantName: lease.tenantName,
      tenantPhone: lease.tenantPhone ?? "",
      rent: lease.rent ? String(lease.rent) : "",
      deposit: lease.deposit ? String(lease.deposit) : "",
      cycle: lease.cycle,
      startDate: lease.startDate,
      endDate: lease.endDate ?? "",
      leaseDuration: lease.leaseDuration ?? "Manual Date / Open",
      status: lease.status,
    });
    setFormError(null);
    setNotice(null);
    setLockUnitSelection(false);
    setCustomUnit("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormError(null);
    setEditingId(null);
    setLockUnitSelection(false);
    setCustomUnit("");
  };

  const closePreview = () => {
    setViewingLease(null);
  };

  const openPreview = async (lease: LeaseAgreement) => {
    setViewingLease(lease);
    if (!templateLoaded) {
      await loadTemplate();
    }
  };

  const renderTemplate = (lease: LeaseAgreement) => {
    const replacements: Record<string, string> = {
      property: lease.property || "",
      tenantName: lease.tenantName || "",
      tenantPhone: lease.tenantPhone || "",
      unit: lease.unit,
      status: lease.status,
      rent: formatCurrency(lease.rent),
      deposit: formatCurrency(lease.deposit),
      cycle: lease.cycle,
      startDate: formatDate(lease.startDate),
      endDate: lease.endDate ? formatDate(lease.endDate) : "Open Ended",
      leaseDuration: lease.leaseDuration || "Manual Date / Open",
      today: formatDate(new Date().toISOString()),
    };

    let html = leaseTemplate.htmlTemplate || "";
    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replaceAll(`{{${key}}}`, value);
    });
    return html;
  };

  const handleSaveLease = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const propertyId =
      properties.find((property) => property.label.toLowerCase() === propertyLabel.toLowerCase())?.id || "";

    if (!propertyLabel) {
      setFormError("Property / Building is required.");
      return;
    }
    const unitValue = customUnit.trim() || form.unit.trim();
    if (!unitValue) {
      setFormError("Apartment / Unit is required.");
      return;
    }
    if (!form.tenantName.trim()) {
      setFormError("Tenant name is required.");
      return;
    }
    if (!form.startDate) {
      setFormError("Start date is required.");
      return;
    }

    const cleanedPropertyLabel = propertyLabel.trim();
    const payload: LeaseAgreement = {
      id: editingId ?? `lease-${Date.now()}`,
      property: cleanedPropertyLabel,
      unit: unitValue,
      tenantName: form.tenantName.trim(),
      tenantPhone: form.tenantPhone.trim(),
      status: form.status,
      cycle: form.cycle,
      rent: Number(form.rent) || 0,
      deposit: Number(form.deposit) || 0,
      startDate: form.startDate,
      endDate: form.endDate,
      leaseDuration: form.leaseDuration,
    };

    setSaving(true);
    try {
      const resolvedPropertyId = (propertyId || cleanedPropertyLabel).trim();
      const tenantId = `tenant-${slugify(resolvedPropertyId)}-${slugify(payload.unit)}`;
      const tenantRes = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tenantId,
          name: payload.tenantName,
          unit: payload.unit,
          property_id: resolvedPropertyId,
          building: propertyLabel,
          monthly_rent: payload.rent,
        }),
      });
      const tenantData = await tenantRes.json().catch(() => null);
      if (!tenantRes.ok || tenantData?.ok === false) {
        throw new Error(tenantData?.error || "Failed to save tenant.");
      }

      if (!isEditing) {
        let latestUnits = units;
        try {
          const unitsRes = await fetch(`/api/units?ts=${Date.now()}`, { cache: "no-store" });
          const unitsPayload = await unitsRes.json().catch(() => null);
          if (unitsRes.ok && unitsPayload?.ok !== false) {
            latestUnits = (unitsPayload?.ok ? unitsPayload.data : unitsPayload) as Array<{
              id: string;
              unit: string;
              property_id?: string | null;
            }>;
          }
        } catch (err) {
          console.warn("Failed to refresh units list", err);
        }

        const unitName = payload.unit.trim().toLowerCase();
        const normalizedPropertyId = resolvedPropertyId.toLowerCase();
        const normalizedPropertyLabel = cleanedPropertyLabel.toLowerCase();
        const matchedUnit = latestUnits.find((unit) => {
          const existingUnit = (unit.unit || "").trim().toLowerCase();
          if (!existingUnit || existingUnit !== unitName) return false;
          const existingProperty = (unit.property_id || "").trim().toLowerCase();
          if (!existingProperty) return true;
          return (
            existingProperty === normalizedPropertyId ||
            existingProperty === normalizedPropertyLabel
          );
        });

        if (matchedUnit) {
          if (!matchedUnit.property_id && resolvedPropertyId) {
            await fetch("/api/units", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: matchedUnit.id, property_id: resolvedPropertyId }),
            });
            await loadUnits();
          }
        } else {
          const unitRes = await fetch("/api/units", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unit: payload.unit,
              property_id: resolvedPropertyId,
              status: "Vacant",
            }),
          });
          const unitData = await unitRes.json().catch(() => null);
          if (!unitRes.ok || unitData?.ok === false) {
            throw new Error(unitData?.error || "Failed to create the apartment unit.");
          }
          await loadUnits();
        }
      }
      const res = await fetch("/api/lease-agreements", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to save lease.");
      }
      const updated = (data?.ok ? data.data : data) as LeaseAgreement[];
      if (Array.isArray(updated)) {
        setLeases(updated);
      } else {
        setLeases((prev) => [...prev, payload]);
      }
      setShowModal(false);
      setEditingId(null);
      return;
    } catch (err) {
      console.error(err);
      if (isEditing) {
        setNotice("API unavailable. Lease updated locally only.");
        setLeases((prev) => prev.map((item) => (item.id === payload.id ? payload : item)));
      } else {
        setNotice("API unavailable. Lease saved locally only.");
        setLeases((prev) => [...prev, payload]);
      }
      setShowModal(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLease = async (lease: LeaseAgreement) => {
    if (!confirm(`Delete lease for Unit ${lease.unit}?`)) return;
    setNotice(null);
    try {
      const res = await fetch("/api/lease-agreements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lease.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to delete lease.");
      }
      const updated = (data?.ok ? data.data : data) as LeaseAgreement[];
      if (Array.isArray(updated)) {
        setLeases(updated);
      } else {
        setLeases((prev) => prev.filter((item) => item.id !== lease.id));
      }
    } catch (err) {
      console.error(err);
      setNotice("API unavailable. Lease removed locally only.");
      setLeases((prev) => prev.filter((item) => item.id !== lease.id));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lease Agreements"
        subtitle="Manage tenant contracts and financial obligations."
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20">
              <FileDown className="h-4 w-4" />
              Export PDF
            </button>
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong"
            >
              <Plus className="h-4 w-4" />
              New Lease
            </button>
          </div>
        }
      />

      {notice ? (
        <SectionCard className="flex items-center gap-3 border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <Info className="h-4 w-4" />
          <span>{notice}</span>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <SectionCard className="border-l-2 border-l-accent/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active Leases</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{activeLeases.length}</p>
          <p className="mt-1 text-sm text-slate-400">Currently occupied units</p>
        </SectionCard>
        <SectionCard className="border-l-2 border-l-violet-400/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Security Deposits</p>
          <p className="mt-2 text-2xl font-semibold text-violet-200">{formatCurrency(securityDeposits)}</p>
          <p className="mt-1 text-sm text-slate-400">Security deposits</p>
        </SectionCard>
        <SectionCard className="border-l-2 border-l-amber-400/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Expiring Soon</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">{expiringSoon}</p>
          <p className="mt-1 text-sm text-slate-400">Within 90 days</p>
        </SectionCard>
        <SectionCard className="border-l-2 border-l-emerald-400/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Gross Monthly Rent</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-200">{formatCurrency(grossMonthlyRent)}</p>
          <p className="mt-1 text-sm text-slate-400">Active leases only</p>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-white/10 bg-panel-2/60 px-4 py-3 text-sm text-slate-400">
            <Search className="h-4 w-4" />
            <input
              placeholder="Search unit or tenant..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-2">
              Month
              <select
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200"
              >
                {MONTHS.map((month) => (
                  <option key={month}>{month}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Year
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200"
              >
                {YEARS.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Rent</th>
                <th className="px-4 py-3">Deposit</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              {visibleLeases.map((lease) => (
                <tr key={lease.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[lease.status]}>{lease.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-100">{lease.unit}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-100">{lease.tenantName}</div>
                    {lease.tenantPhone ? <div className="text-xs text-slate-400">{lease.tenantPhone}</div> : null}
                  </td>
                  <td className="px-4 py-3">{getPeriod(lease)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                      {lease.cycle}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-100">{formatCurrency(lease.rent)}</td>
                  <td className="px-4 py-3 text-slate-100">{formatCurrency(lease.deposit)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20"
                        aria-label={`View lease for Unit ${lease.unit}`}
                        onClick={() => openPreview(lease)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20"
                        aria-label={`Edit lease for Unit ${lease.unit}`}
                        onClick={() => startEdit(lease)}
                      >
                        <PencilLine className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-rose-200 hover:border-rose-400/60"
                        aria-label={`Delete lease for Unit ${lease.unit}`}
                        onClick={() => handleDeleteLease(lease)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleLeases.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    No leases found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                {isEditing ? "Edit Lease Agreement" : "+ New Lease Agreement"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-full border border-white/10 p-2 text-slate-200 hover:border-white/20"
                aria-label="Close new lease form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              <Info className="mt-0.5 h-4 w-4 text-accent" />
              <p>Creating a lease will automatically update the apartment&apos;s occupancy status and rent amount.</p>
            </div>

            <form onSubmit={handleSaveLease} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Property / Building</label>
                <input
                  list="lease-properties"
                  value={form.property}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      property: event.target.value,
                      unit: lockUnitSelection ? prev.unit : "",
                    }));
                    if (!lockUnitSelection) {
                      setCustomUnit("");
                    }
                  }}
                  disabled={lockUnitSelection}
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="Select or type a property..."
                />
                <datalist id="lease-properties">
                  {properties.map((property) => (
                    <option key={property.id} value={property.label} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Apartment / Unit</label>
                {lockUnitSelection ? (
                  <input
                    value={form.unit}
                    disabled
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                ) : (
                  <>
                    {unitOptions.length ? (
                      <select
                        value={unitOptions.includes(form.unit) && !customUnit ? form.unit : ""}
                        onChange={(event) => {
                          setForm((prev) => ({ ...prev, unit: event.target.value }));
                          setCustomUnit("");
                        }}
                        disabled={!hasPropertyValue}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <option value="">Select an apartment...</option>
                        {unitOptions.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      value={customUnit}
                      onChange={(event) => setCustomUnit(event.target.value)}
                      disabled={!hasPropertyValue}
                      autoComplete="off"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                      placeholder={unitOptions.length ? "Or type a new apartment..." : "Type a new apartment..."}
                    />
                  </>
                )}
                {!lockUnitSelection && !hasPropertyValue ? (
                  <p className="mt-2 text-xs text-slate-500">Select a property to add or choose a unit.</p>
                ) : null}
                {!lockUnitSelection && hasPropertyValue && !hasSelectedProperty ? (
                  <p className="mt-2 text-xs text-slate-500">
                    This property isn’t in the list yet. Showing units without a property, or type a new unit.
                  </p>
                ) : null}
                {!lockUnitSelection && hasSelectedProperty && !unitOptions.length ? (
                  <p className="mt-2 text-xs text-slate-500">No units found yet. Type a new one to add it.</p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tenant Name</label>
                  <input
                    value={form.tenantName}
                    onChange={(event) => setForm((prev) => ({ ...prev, tenantName: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                    placeholder="Tenant name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tenant Phone</label>
                  <input
                    value={form.tenantPhone}
                    onChange={(event) => setForm((prev) => ({ ...prev, tenantPhone: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                    placeholder="+252..."
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rent Amount (USD)</label>
                  <input
                    type="number"
                    value={form.rent}
                    onChange={(event) => setForm((prev) => ({ ...prev, rent: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Security Deposit (USD)
                  </label>
                  <input
                    type="number"
                    value={form.deposit}
                    onChange={(event) => setForm((prev) => ({ ...prev, deposit: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billing Cycle</label>
                  <select
                    value={form.cycle}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, cycle: event.target.value as LeaseBillingCycle }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                  >
                    {CYCLE_OPTIONS.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {cycle}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => {
                        const next = { ...prev, startDate: value };
                        const months = DURATION_MONTHS[prev.leaseDuration];
                        if (months && value) {
                          next.endDate = addMonthsToIso(value, months);
                        }
                        return next;
                      });
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lease Duration</label>
                  <select
                    value={form.leaseDuration}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => {
                        const next = { ...prev, leaseDuration: value };
                        const months = DURATION_MONTHS[value];
                        if (months && prev.startDate) {
                          next.endDate = addMonthsToIso(prev.startDate, months);
                        }
                        return next;
                      });
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">End Date (Target)</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>

              {formError ? <p className="text-sm text-rose-200">{formError}</p> : null}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-white/10 px-6 py-2 text-sm font-semibold text-slate-200 hover:border-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-accent px-6 py-2 text-sm font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save Changes" : "Create Lease"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewingLease ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Lease Preview</h2>
                <p className="text-xs text-slate-400">Unit {viewingLease.unit} · {viewingLease.tenantName}</p>
              </div>
              <button
                onClick={closePreview}
                className="rounded-full border border-white/10 p-2 text-slate-200 hover:border-white/20"
                aria-label="Close lease preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {templateError ? (
              <SectionCard className="mt-4 border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {templateError}
              </SectionCard>
            ) : !templateLoaded ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
                Loading lease template...
              </div>
            ) : leaseTemplate.mode === "html" ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white">
                <iframe
                  title="Lease template"
                  srcDoc={renderTemplate(viewingLease)}
                  className="h-[70vh] w-full"
                />
              </div>
            ) : leaseTemplate.mode === "pdf" ? (
              leaseTemplate.pdfDataUrl ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white">
                  <iframe title="Lease PDF" src={leaseTemplate.pdfDataUrl} className="h-[70vh] w-full" />
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
                  Upload a PDF template in Settings → Lease Template to preview it here.
                </div>
              )
            ) : (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
                {leaseTemplate.externalUrl ? (
                  <a
                    href={leaseTemplate.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-accent underline"
                  >
                    Open lease template in a new tab
                  </a>
                ) : (
                  "Provide an external URL in Settings → Lease Template."
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
