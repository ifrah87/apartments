"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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

const UNIT_OPTIONS = ["101", "102", "B1", "C1", "103", "11012", "1003"];

const STATUS_VARIANTS: Record<LeaseAgreementStatus, "success" | "warning" | "danger" | "info"> = {
  Active: "success",
  Terminated: "danger",
  Pending: "warning",
};

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("en-GB");

function formatCurrency(value: number) {
  return formatter.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "Open Ended";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
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

export default function LeasesPage() {
  const [leases, setLeases] = useState<LeaseAgreement[]>(DEFAULT_LEASES);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("All Months");
  const [yearFilter, setYearFilter] = useState("2026");
  const [showModal, setShowModal] = useState(false);
  const [viewingLease, setViewingLease] = useState<LeaseAgreement | null>(null);
  const [leaseTemplate, setLeaseTemplate] = useState<LeaseTemplateSettings>(DEFAULT_LEASE_TEMPLATE);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [properties, setProperties] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LeaseFormState>(buildDefaultForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    setLeases(DEFAULT_LEASES);
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
          const names = data
            .map((item) => item.name || item.building || item.property_id)
            .filter(Boolean) as string[];
          if (names.length) {
            setProperties(Array.from(new Set(names)));
            return;
          }
        }
      }
    } catch (err) {
      console.error("Failed to load properties", err);
    }
    const fallback = leases.map((lease) => lease.property).filter(Boolean) as string[];
    setProperties(Array.from(new Set(fallback)));
  };

  useEffect(() => {
    loadLeases();
  }, []);

  useEffect(() => {
    loadProperties();
  }, [leases]);

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

  const unitOptions = useMemo(() => {
    const set = new Set([...UNIT_OPTIONS, ...leases.map((lease) => lease.unit).filter(Boolean)]);
    return Array.from(set);
  }, [leases]);

  const isEditing = editingId !== null;

  const startCreate = () => {
    setEditingId(null);
    setForm(buildDefaultForm());
    setFormError(null);
    setNotice(null);
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
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormError(null);
    setEditingId(null);
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

    if (!form.unit.trim()) {
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

    const payload: LeaseAgreement = {
      id: editingId ?? `lease-${Date.now()}`,
      property: form.property.trim(),
      unit: form.unit.trim(),
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
          <p className="mt-1 text-sm text-slate-400">Held in escrow</p>
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
                  onChange={(event) => setForm((prev) => ({ ...prev, property: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                  placeholder="Select or type a property..."
                />
                <datalist id="lease-properties">
                  {properties.map((property) => (
                    <option key={property} value={property} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Apartment / Unit</label>
                <select
                  value={form.unit}
                  onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                >
                  <option value="">Select an apartment...</option>
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
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
                    onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lease Duration</label>
                  <select
                    value={form.leaseDuration}
                    onChange={(event) => setForm((prev) => ({ ...prev, leaseDuration: event.target.value }))}
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
